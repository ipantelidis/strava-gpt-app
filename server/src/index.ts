import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
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
    return res.status(400).json({
      error: error,
      error_description: error_description || "Authorization failed",
    });
  }

  if (!code) {
    return res.status(400).json({
      error: "missing_code",
      error_description: "No authorization code provided",
    });
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
      return res.status(tokenResponse.status).json({
        error: "token_exchange_failed",
        error_description: errorData,
      });
    }

    const tokens = await tokenResponse.json();

    // Return tokens in OAuth standard format
    res.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: "Bearer",
      scope: tokens.scope || "read,activity:read_all",
    });
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).json({
      error: "server_error",
      error_description: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// OAuth discovery endpoints for Strava
const serverUrl = process.env.MCP_SERVER_URL || "http://localhost:3000";
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

if (env === "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  app.use("/assets", cors());
  app.use("/assets", express.static(path.join(__dirname, "assets")));
}

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
