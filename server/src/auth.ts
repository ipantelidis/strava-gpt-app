import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

type Extra = RequestHandlerExtra<any, any>;

export interface StravaAuth {
  userId: string;
  accessToken: string;
  expiresAt?: number;
}

export interface AuthError {
  type: "missing_token" | "invalid_token" | "expired_token" | "unauthorized";
  message: string;
  instructions: string[];
}

/**
 * Validates Strava access token and returns user info
 * Strava uses opaque tokens, so we validate via the /athlete endpoint
 */
export async function getAuth(extra: Extra): Promise<StravaAuth | null> {
  const authHeader = extra.requestInfo?.headers?.authorization;
  if (!authHeader) {
    return null;
  }

  // Handle both string and string[] types
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!headerValue?.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = headerValue.slice(7).trim();

  try {
    // Validate token by fetching athlete info
    const res = await fetch("https://www.strava.com/api/v3/athlete", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error("Strava auth failed:", res.status, res.statusText);
      return null;
    }

    const athlete = await res.json();
    return {
      userId: athlete.id.toString(),
      accessToken: token,
    };
  } catch (error) {
    console.error("Error validating Strava token:", error);
    return null;
  }
}

/**
 * Check if a token has expired based on expires_at timestamp
 */
export function isTokenExpired(expiresAt?: number): boolean {
  if (!expiresAt) {
    return false; // If no expiration info, assume valid
  }
  
  const now = Math.floor(Date.now() / 1000);
  return now >= expiresAt;
}

/**
 * Detect 401 Unauthorized errors from Strava API responses
 */
export function is401Error(response: Response): boolean {
  return response.status === 401;
}

/**
 * Create structured auth error with simplified message
 * The MCP host (ChatGPT) will handle the OAuth popup automatically
 */
export function createAuthError(type: AuthError["type"]): AuthError {
  const errors: Record<AuthError["type"], AuthError> = {
    missing_token: {
      type: "missing_token",
      message: "Please connect your Strava account to access your training data.",
      instructions: [
        "Click 'Connect Strava' to authorize access to your activities.",
        "You'll be redirected to Strava to grant permission.",
        "After authorization, you'll be automatically connected."
      ]
    },
    invalid_token: {
      type: "invalid_token",
      message: "Your Strava connection is invalid.",
      instructions: [
        "Please reconnect your Strava account.",
        "Click 'Connect Strava' to re-authorize."
      ]
    },
    expired_token: {
      type: "expired_token",
      message: "Your Strava connection has expired.",
      instructions: [
        "Strava tokens expire after 6 hours for security.",
        "Please reconnect your Strava account to continue."
      ]
    },
    unauthorized: {
      type: "unauthorized",
      message: "Unable to access your Strava data.",
      instructions: [
        "Your authorization may have been revoked or expired.",
        "Please reconnect your Strava account."
      ]
    }
  };
  
  return errors[type];
}

/**
 * Returns auth error response for unauthenticated requests
 * Uses component button for OAuth authorization
 */
export function authErrorResponse(errorType: AuthError["type"] = "missing_token") {
  const serverUrl = process.env.MCP_SERVER_URL || "http://localhost:3000";
  const clientId = process.env.STRAVA_CLIENT_ID;
  
  if (!clientId) {
    return {
      content: [
        {
          type: "text" as const,
          text: "🔐 Server configuration error: Strava client ID not configured. Please contact support.",
        },
      ],
      isError: true,
    };
  }
  
  // Create authorization URL with callback to our server
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(serverUrl + "/oauth/callback")}&approval_prompt=force&scope=read,activity:read_all`;
  
  const authError = createAuthError(errorType);
  
  return {
    content: [
      {
        type: "text" as const,
        text: `🔐 ${authError.message}\n\n${authError.instructions.join("\n")}`,
      },
      // Component button for OAuth (ChatGPT Apps SDK feature)
      {
        type: "component",
        component: {
          type: "button",
          text: "Connect Strava",
          url: authUrl,
        },
      } as any,
      {
        type: "text" as const,
        text: "After authorizing on Strava, you'll receive an access token. Copy it and provide it when using the tools.",
      },
    ],
    isError: true,
    _meta: {
      "mcp/www_authenticate": [
        `Bearer resource_metadata="${serverUrl}/.well-known/oauth-protected-resource"`,
      ],
      authError: authError,
      authorizationUrl: authUrl,
    },
  };
}
