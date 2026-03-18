# Vercel Production Setup

## Required Steps

### 1. Add Vercel KV (Redis) Storage

Strava tokens need persistent storage. On Vercel, the file system is read-only, so we use Vercel KV.

**Steps:**
1. Go to your Vercel project dashboard
2. Click **Storage** tab
3. Click **Create Database**
4. Select **KV** (Redis)
5. Name it (e.g., "strava-tokens")
6. Click **Create**
7. Vercel automatically adds these environment variables:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

**Note:** Vercel KV is free for hobby tier (256 MB storage, 3000 commands/day).

### 2. Add Strava API Credentials

Go to **Settings** → **Environment Variables** and add:

```
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=https://photo2strava.com
```

### 3. Update Strava API Settings

Go to https://www.strava.com/settings/api and update:

- **Authorization Callback Domain**: `localhost,photo2strava.com`

### 4. Deploy

```bash
git add .
git commit -m "Add Vercel KV storage for production"
git push
```

Vercel will auto-deploy with the new storage configuration.

## How It Works

- **Local development**: Uses file storage (`.strava-tokens.json`)
- **Production (Vercel)**: Uses Vercel KV (Redis)
- Automatic detection based on `VERCEL` environment variable

## Troubleshooting

### "KV is not defined" error
- Make sure you've created a KV database in your Vercel project
- Check that KV environment variables are set

### "Read-only file system" error
- This means KV isn't properly configured
- Verify the KV database is linked to your project

### Connection works locally but not in production
- Double-check environment variables in Vercel dashboard
- Ensure `STRAVA_REDIRECT_URI` matches your production URL
- Check Vercel function logs for detailed errors
