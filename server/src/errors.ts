/**
 * Error handling utilities for Strava API and application errors
 */

/**
 * Custom error class for rate limit (429) responses
 */
export class RateLimitError extends Error {
  public retryAfter?: number; // seconds until rate limit resets
  public limit?: number; // total rate limit
  public usage?: number; // current usage

  constructor(
    message: string = "Strava API rate limit exceeded",
    retryAfter?: number,
    limit?: number,
    usage?: number
  ) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    this.limit = limit;
    this.usage = usage;
  }
}

/**
 * Custom error class for missing optional data
 */
export class MissingDataError extends Error {
  public missingFields: string[];

  constructor(message: string, missingFields: string[] = []) {
    super(message);
    this.name = "MissingDataError";
    this.missingFields = missingFields;
  }
}

/**
 * Detect rate limit errors from Strava API response
 */
export function isRateLimitError(response: Response): boolean {
  return response.status === 429;
}

/**
 * Extract rate limit information from response headers
 */
export function extractRateLimitInfo(response: Response): {
  limit?: number;
  usage?: number;
  retryAfter?: number;
} {
  const limit = response.headers.get("X-RateLimit-Limit");
  const usage = response.headers.get("X-RateLimit-Usage");
  const retryAfter = response.headers.get("Retry-After");

  return {
    limit: limit ? parseInt(limit, 10) : undefined,
    usage: usage ? parseInt(usage, 10) : undefined,
    retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
  };
}

/**
 * Create structured rate limit error response
 */
export function rateLimitErrorResponse(
  retryAfter?: number,
  limit?: number,
  usage?: number
) {
  const retryMinutes = retryAfter ? Math.ceil(retryAfter / 60) : 15;
  const usagePercent = limit && usage ? Math.round((usage / limit) * 100) : 0;

  return {
    content: [
      {
        type: "text" as const,
        text: `🚦 Strava API Rate Limit Exceeded

You've hit Strava's API rate limit. This is a temporary restriction to prevent excessive API usage.

**Current Status:**
${limit && usage ? `- Usage: ${usage}/${limit} requests (${usagePercent}%)` : "- Rate limit exceeded"}
${retryAfter ? `- Reset in: ${retryMinutes} minutes` : "- Reset time: ~15 minutes"}

**What you can do:**

1. **Wait and retry**: The rate limit will reset in approximately ${retryMinutes} minutes
2. **Use cached data**: If you've already fetched data in this conversation, I can use that instead
3. **Reduce requests**: Try using integrated widgets instead of multiple data tool calls
4. **Batch operations**: Combine multiple queries into fewer API calls

**Rate Limit Details:**

Strava has two rate limits:
- 15-minute limit: 100 requests per 15 minutes
- Daily limit: 1,000 requests per day

**Tips to avoid rate limits:**
- Use integrated widgets (get_training_summary, compare_training_weeks) which are optimized
- Fetch data once and analyze it multiple times in the same conversation
- Avoid fetching detailed data unless necessary (set includeDetails=false)
- Use appropriate date ranges (don't fetch more data than needed)`,
      },
    ],
    isError: true,
    _meta: {
      rateLimitError: {
        retryAfter,
        limit,
        usage,
        usagePercent,
      },
    },
  };
}

/**
 * Create structured error response for missing optional data
 */
export function missingDataErrorResponse(
  missingFields: string[],
  availableData: string[]
) {
  return {
    content: [
      {
        type: "text" as const,
        text: `⚠️ Some Optional Data is Missing

The requested data is partially available. Some optional fields are not present in your Strava activities.

**Missing fields:**
${missingFields.map((field) => `- ${field}`).join("\n")}

**Available data:**
${availableData.map((field) => `- ${field}`).join("\n")}

**Why is data missing?**

Optional data like heart rate, GPS tracks, or splits may be missing because:
- Your device doesn't record that metric (e.g., no heart rate monitor)
- The data wasn't synced properly
- Privacy settings hide certain data
- The activity is too old (Strava may not have all historical data)

**What you can do:**

1. **Continue with available data**: I can analyze what's available
2. **Check your device**: Ensure your watch/device is recording all metrics
3. **Verify Strava sync**: Check that data synced correctly to Strava
4. **Use different activities**: Try analyzing more recent activities

The analysis will continue with the available data.`,
      },
    ],
    isError: false, // Not a fatal error, just a warning
    _meta: {
      missingDataWarning: {
        missingFields,
        availableData,
      },
    },
  };
}

/**
 * Check if activity has required fields
 */
export function validateActivityData(
  activity: any,
  requiredFields: string[]
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (activity[field] === undefined || activity[field] === null) {
      missingFields.push(field);
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Check if activity has optional fields and return what's available
 */
export function checkOptionalData(
  activity: any,
  optionalFields: string[]
): { available: string[]; missing: string[] } {
  const available: string[] = [];
  const missing: string[] = [];

  for (const field of optionalFields) {
    if (activity[field] !== undefined && activity[field] !== null) {
      available.push(field);
    } else {
      missing.push(field);
    }
  }

  return { available, missing };
}

/**
 * Create a graceful degradation message for widgets
 */
export function createDegradationMessage(
  missingFields: string[],
  context: string
): string {
  return `Note: ${context} is displayed with limited data. Missing: ${missingFields.join(", ")}. This may affect the completeness of the visualization.`;
}

/**
 * Wrap async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorContext: string
): Promise<{ success: true; data: T } | { success: false; error: Error }> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    console.error(`Error in ${errorContext}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
