# Strava Running Coach - Setup Guide

## Prerequisites

- Node.js 24+
- Strava account
- ngrok (for testing with ChatGPT during development)

## 1. Create Strava API Application

1. Go to https://www.strava.com/settings/api
2. Create a new application with these details:
   - **Application Name**: Strava Running Coach (or your preferred name)
   - **Category**: Training
   - **Club**: Leave empty
   - **Website**: Your website or http://localhost:3000
   - **Authorization Callback Domain**: 
     - For local testing: `your-ngrok-url.ngrok.io`
     - For production: `your-app.alpic.app`

3. After creation, note your:
   - **Client ID**
   - **Client Secret**

## 2. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Strava credentials:
   ```
   STRAVA_CLIENT_ID=your_actual_client_id
   STRAVA_CLIENT_SECRET=your_actual_client_secret
   MCP_SERVER_URL=http://localhost:3000
   ```

## 3. Install Dependencies

```bash
npm install
```

## 4. Run Development Server

```bash
npm run dev
```

This starts:
- MCP server at `http://localhost:3000/mcp`
- Skybridge DevTools at `http://localhost:3000/`

## 5. Test with ChatGPT (Optional)

To test with ChatGPT during development:

1. **Start ngrok tunnel**:
   ```bash
   ngrok http 3000
   ```

2. **Update environment**:
   - Copy the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`)
   - Update `.env`: `MCP_SERVER_URL=https://abc123.ngrok.io`
   - Update Strava app callback domain to match ngrok URL
   - Restart dev server

3. **Connect in ChatGPT**:
   - Go to ChatGPT settings
   - Add MCP server: `https://abc123.ngrok.io/mcp`
   - Authorize with Strava when prompted

## 6. Deploy to Production (Alpic)

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial Strava Running Coach implementation"
   git push
   ```

2. **Deploy with Alpic**:
   ```bash
   npm run deploy
   ```
   Or connect your GitHub repo in the Alpic dashboard.

3. **Configure production environment**:
   - In Alpic dashboard, set environment variables:
     - `STRAVA_CLIENT_ID`
     - `STRAVA_CLIENT_SECRET`
     - `MCP_SERVER_URL` (your Alpic app URL)
   
4. **Update Strava callback**:
   - Update your Strava app's Authorization Callback Domain to your Alpic URL

## OAuth Scopes

The app requests these Strava permissions:
- `read` - Basic profile access
- `activity:read_all` - Access to all activity data
- `activity:write` - Upload activities and routes

## API Rate Limits

Strava API limits:
- 100 requests per 15 minutes
- 1000 requests per day

The app is designed to minimize API calls by:
- Fetching only recent activities (last 30 days)
- Filtering data client-side when possible
- No unnecessary refetching

## Troubleshooting

### OAuth not working
- Verify `MCP_SERVER_URL` matches your actual server URL
- Check Strava app callback domain matches exactly
- Ensure Client ID and Secret are correct

### No activities showing
- Verify your Strava account has running activities
- Check that activities are within the last 30 days
- Confirm OAuth scopes include `activity:read_all` and `activity:write`

### Rate limit errors
- Wait 15 minutes for rate limit reset
- Reduce frequency of requests during testing
