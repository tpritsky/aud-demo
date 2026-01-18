# Quick Start: Deploy to Vercel

## 5-Minute Deployment Guide

### Step 1: Push to GitHub (if not already done)
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

### Step 2: Deploy to Vercel
1. Go to https://vercel.com and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js - click **"Deploy"**

### Step 3: Add Environment Variables
In Vercel Dashboard → Your Project → **Settings** → **Environment Variables**, add:

```
NEXT_PUBLIC_SUPABASE_URL=https://basyqztnwgweikoleuwh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_9hAnsyfmKPdri7QJRyoJIg_V1rA7msa
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase Dashboard>
ELEVENLABS_WEBHOOK_SECRET=wsec_54bcfb274290a95acb54cc9ebe91e2f813605e0f8394690ca25cf40cdc0690ce
ELEVENLABS_API_KEY=sk_2d643abad4cb9234e254bcbea963bfb2e4c8bd55ab69061f
```

**Important:** After adding variables, go to **Deployments** → Click the three dots on latest deployment → **Redeploy**

### Step 4: Get Your Webhook URL
After deployment completes, your URL will be:
```
https://your-app-name.vercel.app
```

Your webhook endpoint:
```
https://your-app-name.vercel.app/api/calls
```

### Step 5: Update Eleven Labs
1. Go to Eleven Labs Dashboard
2. Update webhook URL to: `https://your-app-name.vercel.app/api/calls`
3. Save

### Step 6: Test
- Place a test call
- Check Vercel logs: **Deployments** → Latest → **Functions** → `/api/calls`
- Verify call appears in Supabase `calls` table

## Need More Details?

See `VERCEL_DEPLOYMENT.md` for complete guide and troubleshooting.
