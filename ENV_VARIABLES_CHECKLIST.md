# Environment Variables Checklist for Vercel

Use this checklist when setting up environment variables in Vercel.

## Required Environment Variables

Copy these to Vercel Dashboard → Settings → Environment Variables:

### Supabase Configuration

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - Value: `https://basyqztnwgweikoleuwh.supabase.co`
  - Environment: Production, Preview, Development
  - Notes: Public URL, safe to expose

- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Value: `sb_publishable_9hAnsyfmKPdri7QJRyoJIg_V1rA7msa`
  - Environment: Production, Preview, Development
  - Notes: Public key, protected by RLS

- [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - Value: Get from Supabase Dashboard → Settings → API → service_role key
  - Environment: Production, Preview, Development
  - Notes: **KEEP SECRET** - Only used server-side for webhooks

### Eleven Labs Configuration

- [ ] `ELEVENLABS_WEBHOOK_SECRET`
  - Value: `wsec_54bcfb274290a95acb54cc9ebe91e2f813605e0f8394690ca25cf40cdc0690ce`
  - Environment: Production, Preview, Development
  - Notes: Used to verify webhook signatures

- [ ] `ELEVENLABS_API_KEY`
  - Value: `sk_2d643abad4cb9234e254bcbea963bfb2e4c8bd55ab69061f`
  - Environment: Production, Preview, Development
  - Notes: Used to trigger outbound calls

## Setup Steps

1. [ ] Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. [ ] Add each variable above
3. [ ] For each variable, select all environments (Production, Preview, Development)
4. [ ] Click "Save" after adding all variables
5. [ ] **Redeploy** your application for variables to take effect

## Verification

After deployment, verify:

- [ ] Application loads without errors
- [ ] Can sign in with Supabase credentials
- [ ] Data loads from Supabase
- [ ] Webhook receives calls (check Vercel function logs)

## Security Notes

- Never commit `.env.local` to git
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS - keep it secret
- Public keys (`NEXT_PUBLIC_*`) are safe to expose in client-side code
- Service role key should only be used in API routes

## Getting Missing Values

### Supabase Service Role Key

1. Go to https://supabase.com/dashboard/project/basyqztnwgweikoleuwh
2. Navigate to **Settings** → **API**
3. Find **service_role** key (starts with `eyJ...`)
4. Copy and paste into Vercel environment variables

### Eleven Labs Keys

- Webhook Secret: Get from Eleven Labs Dashboard → Webhook Settings
- API Key: Get from Eleven Labs Dashboard → API Keys
