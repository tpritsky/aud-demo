# Supabase Integration Setup Guide

This guide will help you set up Supabase for the Audiology Voice Agent application.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. Node.js and npm installed
3. Your Supabase project created

## Step 1: Install Dependencies

Run the following command to install the Supabase client:

```bash
npm install @supabase/supabase-js
```

## Step 2: Set Up Supabase Project

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the following values:
   - **Project URL** (NEXT_PUBLIC_SUPABASE_URL)
   - **anon/public key** (NEXT_PUBLIC_SUPABASE_ANON_KEY)
   - **service_role key** (SUPABASE_SERVICE_ROLE_KEY) - Keep this secret!

## Step 3: Configure Environment Variables

Create a `.env.local` file in the project root (if it doesn't exist) and add:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Eleven Labs Configuration (existing)
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret
ELEVENLABS_API_KEY=your_api_key
```

## Step 4: Run Database Migrations

You can run migrations either via the **Supabase SQL Editor** (manual) or by **linking the CLI** and using `supabase db push`.

### Option A: Link the Supabase CLI (then use `db push`)

1. **Log in to the CLI** (one-time)  
   Go to [Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens), create a token, then run:
   ```bash
   npx supabase login
   ```
   Paste the token when prompted.

2. **Get your project reference ID**  
   In the dashboard: **Project Settings** → **General** → **Reference ID** (e.g. `basyqztnwgweikoleuwh`).

3. **Link this repo to your project** (from the project root):
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
   When prompted, enter your **database password** (the one you set for the project in Supabase; find or reset it under **Settings → Database**). The CLI stores it so you don’t have to enter it every time.

4. **Push migrations**:
   ```bash
   npx supabase db push
   ```
   This applies any new migrations in `supabase/migrations/` that haven’t been applied yet.

### Option B: Run migrations manually in SQL Editor

You need to run two migrations in order:

### Migration 1: Initial Schema
1. In your Supabase dashboard, go to **SQL Editor**
2. Open the file `supabase/migrations/001_initial_schema.sql`
3. Copy the entire SQL content
4. Paste it into the SQL Editor in Supabase
5. Click **Run** to execute the migration

### Migration 2: Profiles Table
1. In the same SQL Editor, open the file `supabase/migrations/002_add_profiles_table.sql`
2. Copy the entire SQL content
3. Paste it into the SQL Editor in Supabase
4. Click **Run** to execute the migration

### Migration 3–7: Call reason/goal, triggers, clinics, vertical/role, contact form, RLS
Run the remaining migrations in order (003 through 007). **005** adds `clinics` and `profiles.clinic_id`. **006** adds `clinics.vertical`, `clinics.settings`, `profiles.role` (admin/member), and `contact_submissions`. **007** adds RLS so users can read profiles in their clinic (for the Team page).

### Auth: Password reset redirect URL
For "Forgot password" to work, add your app URL to Supabase **Authentication** → **URL Configuration** → **Redirect URLs**:
- Local: `http://localhost:3000/reset-password`
- Production: `https://your-domain.com/reset-password`

### Creating the first clinic and clinic admin

Only pre-added users can sign in. To onboard a new clinic:

1. **Create the clinic** (SQL Editor or Table Editor):
   - Table: `clinics`
   - Insert a row: `name` = your clinic name, `vertical` = `'audiology'`, `'ortho'`, `'law'`, or `'general'`. Note the `id` (UUID).

2. **Create the first user** (Supabase Dashboard):
   - Go to **Authentication** → **Users** → **Add user** → **Create new user** (or **Invite user**).
   - Enter email and a temporary password (or send invite). Note the user’s **UUID** (e.g. from the Users table).

3. **Link the user to the clinic as admin** (SQL Editor):
   - Ensure the user has a row in `profiles` (the signup trigger may have created one).
   - Update (or insert) the profile so it has:
     - `id` = the user’s UUID from step 2
     - `clinic_id` = the clinic `id` from step 1
     - `role` = `'admin'`
   - Example (replace UUIDs):
     ```sql
     INSERT INTO public.profiles (id, email, full_name, clinic_id, role)
     VALUES (
       'user-uuid-from-step-2',
       'admin@clinic.com',
       'Clinic Admin',
       'clinic-uuid-from-step-1',
       'admin'
     )
     ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, role = EXCLUDED.role;
     ```

4. The admin can then sign in via **Get started** → **Log into existing business**, and use **Team** to invite more members (who will get an email to set their password and join the same clinic).

These migrations will create:
- All necessary tables (patients, calls, sequences, callback_tasks, profiles, etc.)
- Indexes for performance
- Row Level Security (RLS) policies
- Triggers for updated_at timestamps
- Automatic profile creation on user signup

## Step 5: Enable Real-time (Optional but Recommended)

1. In Supabase dashboard, go to **Database** → **Replication**
2. Enable replication for the following tables:
   - `calls`
   - `patients`
   - `proactive_sequences`
   - `callback_tasks`
   - `scheduled_check_ins`
   - `activity_events`

## Step 6: Create Your First User

You have two options:

### Option A: Sign Up Through the App (Recommended)
1. Start your development server: `npm run dev`
2. Navigate to the login page
3. Click "Sign Up" and create an account
4. A profile will be automatically created in the `profiles` table

### Option B: Create User Manually in Supabase
1. In Supabase dashboard, go to **Authentication** → **Users**
2. Click **Add User** → **Create new user**
3. Enter an email and password
4. A profile will be automatically created via the trigger
5. You can update the profile later to add full_name, role, etc.

## Step 7: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to the login page
3. Sign in with the user you created
4. The app should now load data from Supabase

## Troubleshooting

### "Missing Supabase environment variables" error
- Make sure `.env.local` exists and contains all required variables
- Restart your development server after adding environment variables

### "Row Level Security policy violation" error
- Make sure you're signed in with a valid user
- Check that RLS policies are correctly set up in the migration

### Real-time subscriptions not working
- Verify that replication is enabled for the tables
- Check browser console for subscription errors
- Make sure you're using the anon key (not service role key) in the client

### Webhook not saving calls
- Verify that the webhook can find a patient by phone number
- Check that the patient's `user_id` matches an existing user
- Review the API route logs for errors

## Database Schema Overview

The migrations create the following tables:

- **profiles** - User profiles with additional information (name, role, clinic, etc.)
- **patients** - Patient information
- **calls** - Call records from Eleven Labs
- **proactive_sequences** - Check-in sequence templates
- **callback_tasks** - Callback task management
- **callback_attempts** - Individual call attempts (normalized)
- **scheduled_check_ins** - Proactive check-in scheduling
- **activity_events** - Activity feed
- **agent_config** - Agent configuration (one per user)

The `profiles` table:
- Automatically created when a user signs up (via trigger)
- Stores additional user information beyond what's in `auth.users`
- Can be easily queried by webhooks and API routes
- Supports roles: 'audiologist', 'admin', 'staff'

All tables include:
- `user_id` foreign key to `auth.users` for multi-user support
- Row Level Security (RLS) policies to ensure data isolation
- Appropriate indexes for query performance

## Next Steps

1. **Seed initial data** (optional): You can create a script to import existing mock data
2. **Configure agent settings**: Set up your Eleven Labs agent IDs in Settings
3. **Test webhook**: Verify that incoming calls from Eleven Labs are saved correctly
4. **Monitor performance**: Check Supabase dashboard for query performance and usage

## Security Notes

- Never commit `.env.local` to version control
- The service role key bypasses RLS - only use it in server-side API routes
- The anon key is safe to use in client-side code (protected by RLS)
- All user data is automatically isolated by RLS policies
