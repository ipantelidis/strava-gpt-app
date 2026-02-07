# Fixing "Bad Request" Error in Production OAuth

## Problem

When clicking the Strava authorization link in production (not localhost), you get a "Bad Request" error from Strava.

## Root Cause

The `MCP_SERVER_URL` environment variable is **not configured** in `alpic.json`, causing the OAuth redirect URI to default to `http://localhost:3000/oauth/callback` even in production.

When Strava receives an authorization request with `redirect_uri=http://localhost:3000/oauth/callback`, it rejects it because:
1. `localhost` is not a valid public URL for production
2. The redirect URI doesn't match what's registered in your Strava app settings

## Solution

### Step 1: Get Your Production URL

After deploying to Alpic, note your production URL. For example:
```
https://strava-running-coach.alpic.app
```

### Step 2: Update alpic.json

Add `MCP_SERVER_URL` to the environment variables in `alpic.json`:

```json
{
  "$schema": "https://assets.alpic.ai/alpic.json",
  "name": "strava-running-coach",
  "runtime": "node24",
  "transport": "streamablehttp",
  "build": {
    "command": "npm run build"
  },
  "start": {
    "command": "npm run start"
  },
  "env": {
    "STRAVA_CLIENT_ID": "your_actual_client_id",
    "STRAVA_CLIENT_SECRET": "your_actual_client_secret",
    "MCP_SERVER_URL": "https://strava-running-coach.alpic.app",
    "NODE_ENV": "production"
  }
}
```

**Important**: 
- Replace `https://strava-running-coach.alpic.app` with your actual Alpic URL
- Include `https://` in the URL
- Do NOT include a trailing slash

### Step 3: Update Strava App Settings

1. Go to https://www.strava.com/settings/api
2. Edit your Strava API application
3. In the "Authorization Callback Domain" field, add your Alpic domain:
   ```
   strava-running-coach.alpic.app
   ```
   
   **Important**: 
   - Only add the domain, NOT the full URL
   - Do NOT include `https://`
   - Do NOT include `/oauth/callback`
   - Just the domain: `your-app.alpic.app`

4. Save the changes

### Step 4: Redeploy

```bash
git add alpic.json
git commit -m "Add MCP_SERVER_URL for production OAuth"
git push
```

Alpic will automatically redeploy with the new environment variable.

## How to Verify

### Check the Authorization URL

After redeploying, use the `connect_strava` tool in ChatGPT. The authorization URL should now be:

```
https://www.strava.com/oauth/authorize?
  client_id=YOUR_CLIENT_ID&
  response_type=code&
  redirect_uri=https://strava-running-coach.alpic.app/oauth/callback&
  approval_prompt=force&
  scope=read,activity:read_all
```

Notice the `redirect_uri` now points to your production URL, not localhost.

### Test the Flow

1. Click the authorization link
2. You should be redirected to Strava (no "Bad Request" error)
3. After authorizing, you should be redirected to your production callback page
4. The callback page should display your access token

## Alternative: Configure via Alpic Dashboard

Instead of editing `alpic.json`, you can also set environment variables via the Alpic dashboard:

1. Go to https://app.alpic.ai
2. Select your project
3. Go to Settings → Environment Variables
4. Add:
   - Key: `MCP_SERVER_URL`
   - Value: `https://your-app.alpic.app`
5. Save and redeploy

## Troubleshooting

### Still Getting "Bad Request"?

**Check 1: Verify MCP_SERVER_URL is set**
```bash
# In your Alpic deployment logs, you should see:
Production mode - serving assets from: /app/dist/assets/assets
```

**Check 2: Verify Strava callback domain**
- Go to https://www.strava.com/settings/api
- Check "Authorization Callback Domain" includes your Alpic domain
- Remember: domain only, no protocol or path

**Check 3: Clear browser cache**
- The authorization URL might be cached
- Try in an incognito/private window

**Check 4: Check server logs**
- Look for the authorization URL being generated
- Verify it contains your production URL, not localhost

### "redirect_uri_mismatch" Error?

This means the redirect URI in the authorization request doesn't match what's registered in Strava.

**Solution**:
1. Copy the exact redirect URI from the error message
2. Extract just the domain part
3. Add that domain to Strava's "Authorization Callback Domain"

Example:
- Error shows: `redirect_uri=https://my-app.alpic.app/oauth/callback`
- Add to Strava: `my-app.alpic.app`

## Summary

The fix requires two changes:
1. ✅ Set `MCP_SERVER_URL` in alpic.json or Alpic dashboard
2. ✅ Add your Alpic domain to Strava's "Authorization Callback Domain"

After these changes, the OAuth flow will work correctly in production.
