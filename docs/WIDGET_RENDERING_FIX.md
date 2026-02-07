# Widget Rendering Fix

## Problem

No widgets were rendering in ChatGPT. The browser console showed 403 Forbidden errors when trying to load widget JavaScript files.

## Root Cause

The Skybridge build process creates widget assets in a nested directory structure:
- Physical location: `dist/assets/assets/connect_strava-XXX.js`
- Manifest reference: `assets/connect_strava-XXX.js`

The server was incorrectly serving from `dist/assets/` at the `/assets` route, which meant:
- Request: `/assets/connect_strava-XXX.js`
- Server looked in: `dist/assets/connect_strava-XXX.js` ❌
- File actually at: `dist/assets/assets/connect_strava-XXX.js` ✅

## Solution

Updated `server/src/index.ts` to serve the nested `assets/assets/` directory at the `/assets/` route:

```typescript
if (env === "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const assetsPath = path.join(__dirname, "assets", "assets");
  
  console.log("Production mode - serving assets from:", assetsPath);

  app.use("/assets", cors());
  app.use("/assets", express.static(assetsPath));
}
```

Now requests to `/assets/connect_strava-XXX.js` correctly map to `dist/assets/assets/connect_strava-XXX.js`.

## About Matplotlib Graphs

The matplotlib graphs that render successfully are NOT widgets. They are base64-encoded PNG images embedded directly in the tool response. Widgets are interactive React components that require separate JavaScript files to be loaded.

## Verification

Tested locally in production mode:
```bash
NODE_ENV=production node dist/index.js
curl -I http://localhost:3000/assets/connect_strava-DJzWqImm.js
# Returns: HTTP/1.1 200 OK with CORS headers
```

## Deployment

The fix has been committed and pushed. Alpic will automatically redeploy, and widgets should now render correctly in ChatGPT.
