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
 * Create structured auth error with step-by-step instructions
 */
export function createAuthError(type: AuthError["type"]): AuthError {
  const clientId = process.env.STRAVA_CLIENT_ID || "200939";
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=http://localhost&approval_prompt=force&scope=read,activity:read_all`;
  
  const errors: Record<AuthError["type"], AuthError> = {
    missing_token: {
      type: "missing_token",
      message: "No Strava access token provided. You must authorize Strava access before using this feature.",
      instructions: [
        "Step 1: Click this authorization link to connect your Strava account:",
        authUrl,
        "Step 2: Click 'Authorize' on the Strava page",
        "Step 3: After authorization, you'll be redirected to a URL like: http://localhost/?state=&code=XXXXX&scope=read,activity:read_all",
        "Step 4: Copy the code parameter from that URL (the part after 'code=')",
        "Step 5: Use the exchange_strava_code tool with that code to get your access token",
        "Step 6: Once you have the token, provide it when calling this tool using the 'token' parameter"
      ]
    },
    invalid_token: {
      type: "invalid_token",
      message: "The provided Strava access token is invalid or malformed.",
      instructions: [
        "Your token may be incorrect or corrupted. Please get a fresh token:",
        "Step 1: Click this authorization link to re-authorize your Strava account:",
        authUrl,
        "Step 2: Click 'Authorize' on the Strava page",
        "Step 3: Copy the code from the redirect URL (after 'code=')",
        "Step 4: Use the exchange_strava_code tool with that code to get a new access token",
        "Step 5: Try again with the new token"
      ]
    },
    expired_token: {
      type: "expired_token",
      message: "Your Strava access token has expired. Strava tokens typically expire after 6 hours.",
      instructions: [
        "Your token has expired and needs to be refreshed:",
        "Step 1: Click this authorization link to re-authorize your Strava account:",
        authUrl,
        "Step 2: Click 'Authorize' on the Strava page",
        "Step 3: Copy the code from the redirect URL (after 'code=')",
        "Step 4: Use the exchange_strava_code tool with that code to get a new access token",
        "Step 5: Try again with the new token"
      ]
    },
    unauthorized: {
      type: "unauthorized",
      message: "Strava returned a 401 Unauthorized error. This usually means your token is invalid or expired.",
      instructions: [
        "The Strava API rejected your token. Please re-authorize:",
        "Step 1: Click this authorization link to connect your Strava account:",
        authUrl,
        "Step 2: Click 'Authorize' on the Strava page",
        "Step 3: Copy the code from the redirect URL (after 'code=')",
        "Step 4: Use the exchange_strava_code tool with that code to get a new access token",
        "Step 5: Try again with the new token"
      ]
    }
  };
  
  return errors[type];
}

/**
 * Returns auth error response for unauthenticated requests
 */
export function authErrorResponse(errorType: AuthError["type"] = "missing_token") {
  const serverUrl = process.env.MCP_SERVER_URL || "http://localhost:3000";
  const authError = createAuthError(errorType);
  
  const instructionsText = authError.instructions.join("\n\n");
  
  return {
    content: [
      {
        type: "text" as const,
        text: `🔐 ${authError.message}\n\n${instructionsText}`,
      },
    ],
    isError: true,
    _meta: {
      "mcp/www_authenticate": [
        `Bearer resource_metadata="${serverUrl}/.well-known/oauth-protected-resource"`,
      ],
      authError: authError,
    },
  };
}
