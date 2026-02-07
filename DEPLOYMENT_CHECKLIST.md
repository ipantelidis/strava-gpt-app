# Deployment Checklist

## Before Deploying to Production

### 1. Configure Alpic Environment Variables

In the Alpic dashboard or `alpic.json`, set:

```json
{
  "env": {
    "STRAVA_CLIENT_ID": "your_actual_client_id",
    "STRAVA_CLIENT_SECRET": "your_actual_client_secret",
    "MCP_SERVER_URL": "https://your-app.alpic.app",
    "NODE_ENV": "production"
  }
}
```

**Get your Alpic URL**: Deploy once to get your URL, then update `MCP_SERVER_URL` and redeploy.

### 2. Configure Strava App Settings

1. Go to https://www.strava.com/settings/api
2. Edit your Strava API application
3. Add to "Authorization Callback Domain":
   - For local: `localhost`
   - For production: `your-app.alpic.app` (domain only, no https://)

### 3. Build and Deploy

```bash
npm run build
git add -A
git commit -m "Production deployment"
git push
```

Alpic will automatically deploy on push.

## Post-Deployment Verification

### 1. Check Widget Assets

Visit: `https://your-app.alpic.app/assets/connect_strava-XXX.js`

Should return: `200 OK` with JavaScript content

### 2. Test OAuth Flow

1. Use `connect_strava` tool in ChatGPT
2. Click authorization button
3. Should redirect to Strava (not "Bad Request")
4. After authorizing, should show token page

### 3. Test Widget Rendering

1. Use any widget tool (e.g., `analyze_run_progression`)
2. Widget should render in ChatGPT
3. Check browser console for errors

## Common Issues

### Widgets Not Rendering (403 Forbidden)

**Cause**: Assets not served from correct directory

**Fix**: Already fixed in `server/src/index.ts` - serves from `dist/assets/assets/`

### OAuth "Bad Request" Error

**Cause**: `MCP_SERVER_URL` not set or callback domain not registered

**Fix**: See `docs/OAUTH_BAD_REQUEST_FIX.md`

### "Invalid Token" Errors

**Cause**: Token expired or invalid

**Fix**: Reconnect using `connect_strava` tool

## Environment Variables Reference

| Variable | Local | Production | Required |
|----------|-------|------------|----------|
| `STRAVA_CLIENT_ID` | From Strava API | From Strava API | ✅ Yes |
| `STRAVA_CLIENT_SECRET` | From Strava API | From Strava API | ✅ Yes |
| `MCP_SERVER_URL` | `http://localhost:3000` | `https://your-app.alpic.app` | ✅ Yes |
| `NODE_ENV` | `development` | `production` | ✅ Yes |

## Documentation

- **Widget Rendering Fix**: `docs/WIDGET_RENDERING_FIX.md`
- **OAuth Bad Request Fix**: `docs/OAUTH_BAD_REQUEST_FIX.md`
- **OAuth Setup**: `docs/OAUTH_SETUP.md`
- **Testing Guide**: `docs/TESTING_GUIDE.md`
- **Design System**: `docs/DESIGN_SYSTEM.md`

## Quick Deploy Command

```bash
# Update environment variables in alpic.json first, then:
npm run build && git add -A && git commit -m "Deploy" && git push
```

Alpic will automatically build and deploy.
