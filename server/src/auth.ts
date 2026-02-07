import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

type Extra = RequestHandlerExtra<any, any>;

export interface StravaAuth {
  userId: string;
  accessToken: string;
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
 * Returns auth error response for unauthenticated requests
 */
export function authErrorResponse() {
  return {
    content: [
      {
        type: "text" as const,
        text: "Please connect your Strava account to use this feature.",
      },
    ],
    isError: true,
    _meta: {
      "mcp/www_authenticate": [
        `Bearer resource_metadata="${process.env.MCP_SERVER_URL}/.well-known/oauth-protected-resource"`,
      ],
    },
  };
}
