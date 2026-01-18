# Vercel Deployment Guide

This guide will help you deploy the Audiology Voice Agent application to Vercel for a permanent webhook URL.

## Prerequisites

- GitHub account (recommended) or Vercel CLI
- Vercel account (sign up at https://vercel.com)
- All environment variables ready

## Step 1: Prepare Your Repository

1. **Commit your code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Verify build works locally** (optional):
   ```bash
   npm run build
   ```

## Step 2: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com and sign in
2. Click **"Add New Project"**
3. Import your GitHub repository:
   - Select your repository
   - Vercel will auto-detect Next.js settings
4. **Configure Project**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

### Option B: Via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Follow the prompts to link your project

## Step 3: Configure Environment Variables

In the Vercel dashboard, go to your project → **Settings** → **Environment Variables** and add:

### Required Variables

```
NEXT_PUBLIC_SUPABASE_URL=https://basyqztnwgweikoleuwh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_9hAnsyfmKPdri7QJRyoJIg_V1rA7msa
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
ELEVENLABS_WEBHOOK_SECRET=wsec_54bcfb274290a95acb54cc9ebe91e2f813605e0f8394690ca25cf40cdc0690ce
ELEVENLABS_API_KEY=sk_2d643abad4cb9234e254bcbea963bfb2e4c8bd55ab69061f
```

**Important Notes:**
- Set all variables for **Production**, **Preview**, and **Development** environments
- `SUPABASE_SERVICE_ROLE_KEY` should be kept secret (get from Supabase Dashboard → Settings → API)
- After adding variables, **redeploy** your application for changes to take effect

## Step 4: Deploy and Get Your URL

1. Click **"Deploy"** in Vercel dashboard
2. Wait for the build to complete (usually 2-3 minutes)
3. Once deployed, you'll get a URL like: `https://your-app-name.vercel.app`
4. Your webhook endpoint will be: `https://your-app-name.vercel.app/api/calls`

## Step 5: Update Eleven Labs Webhook URL

1. Go to your Eleven Labs dashboard
2. Navigate to your agent settings or webhook configuration
3. Update the webhook URL to:
   ```
   https://your-app-name.vercel.app/api/calls
   ```
4. Save the changes

## Step 6: Test the Deployment

1. **Test the webhook**:
   - Place a test call through Eleven Labs
   - Check Vercel logs: Project → **Deployments** → Click latest deployment → **Functions** → `/api/calls`
   - Verify the call appears in your Supabase `calls` table

2. **Test the application**:
   - Visit `https://your-app-name.vercel.app`
   - Sign in with your Supabase credentials
   - Verify data loads correctly

## Troubleshooting

### Build Fails

- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version (Vercel uses Node 18.x by default)

### Environment Variables Not Working

- Make sure variables are set for the correct environment (Production/Preview/Development)
- Redeploy after adding new variables
- Check variable names match exactly (case-sensitive)

### Webhook Not Receiving Calls

- Verify webhook URL in Eleven Labs matches your Vercel URL
- Check Vercel function logs for errors
- Verify `ELEVENLABS_WEBHOOK_SECRET` matches in both places
- Check that the webhook endpoint returns 200 status

### Database Connection Issues

- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
- Check Supabase project is active
- Verify RLS policies allow your operations

## Continuous Deployment

Vercel automatically deploys when you push to your connected branch:
- **Production**: Deploys from `main` or `master` branch
- **Preview**: Deploys from other branches and pull requests

## Custom Domain (Optional)

1. Go to Project → **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update Eleven Labs webhook URL to use custom domain

## Monitoring

- **Logs**: View function logs in Vercel dashboard
- **Analytics**: Built-in analytics available in Vercel dashboard
- **Errors**: Check **Deployments** tab for build/runtime errors

## Support

- Vercel Documentation: https://vercel.com/docs
- Vercel Support: https://vercel.com/support
