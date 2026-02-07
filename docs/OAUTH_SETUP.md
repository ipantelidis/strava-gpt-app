# OAuth Setup Guide

## Automated OAuth Flow Configuration

This app now uses an automated OAuth flow that eliminates the need for users to manually copy-paste authorization codes.

## Strava API Configuration Required

You need to update your Strava API application settings to allow the OAuth callback:

### 1. Go to Strava API Settings
Visit: https://www.strava.com/settings/api

### 2. Update Authorization Callback Domain

Add the following callback URLs to your Strava application:

**For Development (ngrok):**
```
https://your-ngrok-url.ngrok-free.app/oauth/callback
```

**For Production (Alpic):**
```
https://tech-europe-paris-ade1e47e.alpic.live/oauth/callback
```

**For Local Testing:**
```
http://localhost:3000/oauth/callback
```

### 3. Current Configuration

Based on your `.env` file:
- **Client ID**: 200939
- **Client Secret**: ad3c322db88c5457bf0d243350775d40b0e5fde5
- **Production URL**: https://tech-europe-paris-ade1e47e.alpic.live

### 4. How It Works

**Before (Manual Flow):**
1. User clicks authorization link
2. User authorizes on Strava
3. User copies code from redirect URL
4. User pastes code into `exchange_strava_code` tool
5. App exchanges code for token

**After (Automated Flow):**
1. User clicks "Connect Strava" in ChatGPT
2. OAuth popup opens with Strava authorization
3. User clicks "Authorize"
4. Callback automatically exchanges code for token
5. User is immediately connected ✅

### 5. Testing the Flow

After updating the Strava API settings:

1. **Restart the server:**
   ```bash
   npm run dev
   ```

2. **In ChatGPT, ask:**
   - "Show me my training summary"
   - ChatGPT will prompt: "Please connect your Strava account"
   - Click the "Connect Strava" button
   - Authorize on Strava
   - You're automatically connected!

3. **Verify the callback works:**
   - Check server logs for: "OAuth callback received"
   - Token should be exchanged automatically
   - No manual code copying needed

### 6. Troubleshooting

**Error: "redirect_uri_mismatch"**
- The callback URL in Strava settings doesn't match your server URL
- Make sure you added the exact callback URL to Strava API settings
- Include the `/oauth/callback` path

**Error: "invalid_client"**
- Client ID or Client Secret is incorrect
- Verify credentials in `.env` match Strava API settings

**Error: "access_denied"**
- User declined authorization
- Ask user to try again and click "Authorize"

**Token not being sent to tools:**
- Check that MCP_SERVER_URL is set correctly in `.env`
- Verify OAuth discovery endpoints are accessible:
  - `{MCP_SERVER_URL}/.well-known/oauth-authorization-server`
  - `{MCP_SERVER_URL}/.well-known/oauth-protected-resource`

### 7. Migration Notes

**Deprecated:**
- ❌ `exchange_strava_code` tool (no longer needed)
- ❌ Manual `token` parameter on tools (handled automatically)
- ❌ Manual copy-paste of authorization codes

**New Behavior:**
- ✅ Automatic OAuth popup in ChatGPT
- ✅ Tokens managed by MCP host
- ✅ Automatic token refresh
- ✅ Cleaner, simpler UX

### 8. Security Improvements

- Tokens never exposed to users
- Tokens stored securely by MCP host
- Automatic token refresh prevents expiration issues
- Standard OAuth 2.0 flow with PKCE support
- Client credentials never exposed in URLs

## Next Steps

1. Update Strava API callback URLs
2. Restart the server
3. Test the OAuth flow in ChatGPT
4. Enjoy the simplified authentication! 🎉
