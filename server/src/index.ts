import express, { type Express } from "express";
import { mcpAuthMetadataRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { widgetsDevServer } from "skybridge/server";
import type { ViteDevServer } from "vite";
import { mcp } from "./middleware.js";
import server from "./server.js";

const app = express() as Express & { vite: ViteDevServer };

app.use(express.json());

// OAuth callback endpoint for Strava
// This handles the redirect after user authorizes on Strava
app.get("/oauth/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  // Handle authorization errors
  if (error) {
    console.error("OAuth error:", error, error_description);
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authorization Failed</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                 max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 8px; }
          h1 { color: #c33; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Authorization Failed</h1>
          <p><strong>Error:</strong> ${error}</p>
          <p>${error_description || "Authorization was denied or failed"}</p>
          <p>Please try again or contact support if the problem persists.</p>
        </div>
      </body>
      </html>
    `);
  }

  if (!code) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Missing Code</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                 max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Missing Authorization Code</h1>
          <p>No authorization code was provided by Strava.</p>
        </div>
      </body>
      </html>
    `);
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.STRAVA_CLIENT_ID!,
        client_secret: process.env.STRAVA_CLIENT_SECRET!,
        code: code as string,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", tokenResponse.status, errorData);
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Token Exchange Failed</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                   max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>❌ Token Exchange Failed</h1>
            <p>Failed to exchange authorization code for access token.</p>
            <p><strong>Status:</strong> ${tokenResponse.status}</p>
            <p><strong>Details:</strong> ${errorData}</p>
          </div>
        </body>
        </html>
      `);
    }

    const tokens = await tokenResponse.json();

    // Return user-friendly HTML page with the token
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Strava Connected!</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            max-width: 700px; 
            margin: 50px auto; 
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          h1 { color: #667eea; margin-top: 0; }
          .success { 
            background: #d4edda; 
            border: 1px solid #c3e6cb; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
          }
          .token-box {
            background: #f8f9fa;
            border: 2px solid #667eea;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            word-break: break-all;
            margin: 20px 0;
          }
          .copy-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            margin-top: 10px;
          }
          .copy-btn:hover {
            background: #5568d3;
          }
          .copy-btn:active {
            background: #4451b8;
          }
          .instructions {
            background: #e7f3ff;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 20px 0;
          }
          .instructions ol {
            margin: 10px 0;
            padding-left: 20px;
          }
          .instructions li {
            margin: 8px 0;
          }
          .emoji {
            font-size: 48px;
            text-align: center;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="emoji">🎉</div>
          <h1>✅ Successfully Connected to Strava!</h1>
          
          <div class="success">
            <p><strong>Your Strava account has been authorized.</strong></p>
            <p>Athlete: ${tokens.athlete?.firstname} ${tokens.athlete?.lastname}</p>
          </div>

          <div class="instructions">
            <h3>📋 Next Steps:</h3>
            <ol>
              <li><strong>Copy your access token</strong> using the button below</li>
              <li><strong>Return to ChatGPT</strong></li>
              <li><strong>Provide the token</strong> when asked, or use it with any tool by adding: <code>token: [your-token]</code></li>
            </ol>
          </div>

          <h3>🔑 Your Access Token:</h3>
          <div class="token-box" id="token">${tokens.access_token}</div>
          <button class="copy-btn" onclick="copyToken()">📋 Copy Token to Clipboard</button>
          <p id="copied" style="color: #28a745; font-weight: 600; display: none;">✅ Token copied!</p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666;">
            <p><strong>Token expires in:</strong> ${Math.floor(tokens.expires_in / 3600)} hours</p>
            <p><strong>Scopes:</strong> ${tokens.scope || "read, activity:read_all"}</p>
          </div>
        </div>

        <script>
          function copyToken() {
            const token = document.getElementById('token').textContent;
            navigator.clipboard.writeText(token).then(() => {
              document.getElementById('copied').style.display = 'block';
              setTimeout(() => {
                document.getElementById('copied').style.display = 'none';
              }, 3000);
            });
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Server Error</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                 max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Server Error</h1>
          <p>${error instanceof Error ? error.message : "Unknown error occurred"}</p>
        </div>
      </body>
      </html>
    `);
  }
});

// OAuth discovery endpoints for Strava
// Using localhost for OAuth callback to match Strava authorized domains
const serverUrl = "http://localhost:3000";
app.use(
  mcpAuthMetadataRouter({
    oauthMetadata: {
      issuer: "https://www.strava.com",
      authorization_endpoint: "https://www.strava.com/oauth/authorize",
      token_endpoint: "https://www.strava.com/oauth/token",
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["read", "activity:read_all"],
      // Redirect URI for OAuth callback
      redirect_uris: [`${serverUrl}/oauth/callback`],
    },
    resourceServerUrl: new URL(serverUrl),
  }),
);

app.use(mcp(server));

const env = process.env.NODE_ENV || "development";

if (env !== "production") {
  const { devtoolsStaticServer } = await import("@skybridge/devtools");
  app.use(await devtoolsStaticServer());
  app.use(await widgetsDevServer());
}

// In production, Skybridge automatically serves assets from dist/assets
// No manual static file serving needed

app.listen(3000, (error) => {
  if (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  console.log("Server shutdown complete");
  process.exit(0);
});
