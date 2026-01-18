# Eleven Labs Integration

This integration allows the application to receive call data from Eleven Labs and automatically update the dashboard.

## Setup

1. **Set Environment Variables**
   - Create a `.env.local` file in the project root
   - Add the following:
     ```
     ELEVENLABS_WEBHOOK_SECRET=wsec_54bcfb274290a95acb54cc9ebe91e2f813605e0f8394690ca25cf40cdc0690ce
     ELEVENLABS_API_KEY=sk_2d643abad4cb9234e254bcbea963bfb2e4c8bd55ab69061f
     ```
   - **Important**: Never commit the `.env.local` file to version control
   - `ELEVENLABS_WEBHOOK_SECRET`: Used to verify webhook authenticity via HMAC signature
   - `ELEVENLABS_API_KEY`: Used to trigger outbound calls via Eleven Labs API

2. **Configure Eleven Labs Webhook URL**
   - In your Eleven Labs dashboard, set the webhook URL to: `https://your-domain.com/api/calls`
   - The webhook will be called with a POST request when a call ends
   - Make sure to enable HMAC authentication in Eleven Labs webhook settings

3. **Configure Agent Settings**
   - Go to Settings → Agent Configuration
   - Set your **Eleven Labs Agent ID** (e.g., `agent_6201k9fw3a3bfy2bh8enh0r20dxt`)
   - Set your **Eleven Labs Phone Number ID** (e.g., `phnum_6801k9fx8bw8fw2tftsqdt4xmj58`)
   - These are required for automatic call triggering

2. **Webhook Payload Format**
   The webhook expects the following JSON structure:
   ```json
   {
     "call_id": "call_abc123",
     "agent_id": "agent_456",
     "started_at": "2026-01-18T02:14:11Z",
     "ended_at": "2026-01-18T02:19:44Z",
     "duration_seconds": 333,
     "from_number": "+13105551234",
     "to_number": "+18005551234",
     "transcript": "...",
     "analysis": {
       "call_outcome": "appointment_booked",
       "summary": "Caller booked an appointment for Jan 22 at 2pm"
     }
   }
   ```

## How It Works

1. **API Route** (`/app/api/calls/route.ts`)
   - Receives POST requests from Eleven Labs
   - **Security**: Verifies HMAC signature using the webhook secret
   - Validates timestamp to prevent replay attacks (30-minute window)
   - Transforms the webhook payload to match the internal `Call` type
   - Maps call outcomes, infers intent and sentiment from transcript
   - Returns the transformed call data

### Security Features

- **HMAC Signature Verification**: Every webhook request is verified using SHA-256 HMAC
- **Timestamp Validation**: Prevents replay attacks by checking timestamp is within 30 minutes
- **Timing-Safe Comparison**: Uses constant-time comparison to prevent timing attacks
- **Error Handling**: Invalid signatures return 401 Unauthorized

2. **Store Integration**
   - The `addCall` action in the store automatically:
     - Adds the call to the calls list
     - Updates KPI metrics (calls today, appointments booked, escalations)
     - Creates an activity event for the dashboard feed

3. **Client-Side Sync**
   - Use the `useCallSync` hook to manually sync calls
   - Or set up polling with `useCallPolling` hook

## Usage Example

### Manual Sync (if webhook is received client-side)
```tsx
import { useCallSync } from '@/hooks/use-call-sync'

function MyComponent() {
  const { syncCall } = useCallSync()
  
  const handleWebhook = async (webhookData: unknown) => {
    const call = await syncCall(webhookData)
    if (call) {
      console.log('Call synced:', call)
    }
  }
  
  return <button onClick={() => handleWebhook(webhookData)}>Sync Call</button>
}
```

### Automatic Polling (for checking new calls)
```tsx
import { useCallPolling } from '@/hooks/use-call-sync'

function Dashboard() {
  // Poll every 30 seconds for new calls
  useCallPolling(30000)
  
  return <div>Dashboard content</div>
}
```

## Data Mapping

The integration automatically maps Eleven Labs data to internal types:

- **Call Outcome Mapping**:
  - `appointment_booked` → `resolved` (with `scheduling` intent)
  - `escalated` → `escalated`
  - `callback_scheduled` → `callback_scheduled`
  - etc.

- **Intent Inference**: Analyzes transcript and summary to determine call intent
- **Sentiment Analysis**: Infers sentiment from transcript keywords
- **Caller Name Extraction**: Attempts to extract caller name from transcript

## Dashboard Updates

When a new call is added:
- **Calls Table**: New call appears at the top
- **KPI Cards**: Automatically updated:
  - Calls Today
  - Appointments Booked (if intent is scheduling)
  - Escalations Created (if escalated)
- **Activity Feed**: New activity event created

## Automatic Call Triggering

The system automatically triggers outbound calls for:

### Callback Tasks
- When a callback task's `dueAt` time arrives
- When `nextAttemptAt` time arrives (for retry attempts)
- Calls are triggered via `/api/calls/trigger` endpoint
- Tasks are marked as `in_progress` when call is initiated
- Tasks are marked as `completed` when webhook confirms call finished

### Scheduled Check-ins
- When a scheduled check-in's `scheduledFor` time arrives
- Only for check-ins with `channel: 'call'` (SMS not yet implemented)
- Check-ins are marked as `completed` when webhook confirms call finished
- The system matches incoming webhooks to scheduled check-ins by `conversation_id`

### Configuration
- Agent ID and Phone Number ID must be configured in Settings → Agent Configuration
- API key must be set in `ELEVENLABS_API_KEY` environment variable
- Polling runs every 60 seconds to check for due items

