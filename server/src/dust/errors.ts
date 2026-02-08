/**
 * Error handling utilities for Dust agent integration
 */

import { DustAPIError } from "./client.js";

/**
 * Generate user-friendly error response for Dust agent failures
 */
export function dustErrorResponse(error: unknown) {
  if (error instanceof DustAPIError) {
    switch (error.code) {
      case "DUST_AUTH_ERROR":
        return {
          content: [
            {
              type: "text" as const,
              text: "🔐 Unable to connect to AI agents. The service may be temporarily unavailable. Please try again later or contact support if the issue persists.",
            },
          ],
          isError: true,
        };

      case "DUST_RATE_LIMIT":
        const retryMessage = error.retryAfter
          ? ` Please try again in ${error.retryAfter} seconds.`
          : " Please try again in a few minutes.";
        return {
          content: [
            {
              type: "text" as const,
              text: `⏱️ AI agent services are temporarily busy.${retryMessage}`,
            },
          ],
          isError: true,
        };

      case "DUST_TIMEOUT":
        return {
          content: [
            {
              type: "text" as const,
              text: "⏰ The request is taking longer than expected. This might be due to complex processing. Would you like to try a simpler request or try again?",
            },
          ],
          isError: true,
        };

      default:
        return {
          content: [
            {
              type: "text" as const,
              text: `❌ AI agent error: ${error.message}. Please try again or contact support if the issue persists.`,
            },
          ],
          isError: true,
        };
    }
  }

  // Generic error
  return {
    content: [
      {
        type: "text" as const,
        text: `❌ An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
      },
    ],
    isError: true,
  };
}

/**
 * Check if Dust integration is properly configured
 */
export function isDustConfigured(): boolean {
  return !!(
    process.env.DUST_API_KEY &&
    process.env.DUST_WEATHER_AGENT_ID
  );
}

/**
 * Get configuration error message
 */
export function dustConfigurationError() {
  const missing: string[] = [];

  if (!process.env.DUST_API_KEY) missing.push("DUST_API_KEY");
  if (!process.env.DUST_WEATHER_AGENT_ID) missing.push("DUST_WEATHER_AGENT_ID");

  return {
    content: [
      {
        type: "text" as const,
        text: `⚙️ Dust AI integration is not configured. Missing environment variables: ${missing.join(", ")}. Please configure these in your .env file.`,
      },
    ],
    isError: true,
  };
}

/**
 * Graceful degradation message when Dust is unavailable
 */
export function dustUnavailableMessage(feature: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: `ℹ️ ${feature} is temporarily unavailable. The AI agent service is not responding. You can still use other features of the app.`,
      },
    ],
    isError: false,
  };
}
