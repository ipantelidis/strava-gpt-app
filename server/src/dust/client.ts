/**
 * Dust API client for agent orchestration
 */

export interface DustConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface DustAgentRequest {
  agentId: string;
  input: Record<string, any>;
  conversationId?: string;
}

export interface DustAgentResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    retryAfter?: number;
  };
}

/**
 * Custom error class for Dust API errors
 */
export class DustAPIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryAfter?: number
  ) {
    super(message);
    this.name = "DustAPIError";
  }
}

/**
 * Dust API client for interacting with Dust agents
 */
export class DustClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: DustConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://dust.tt/api/v1";
    this.timeout = config.timeout || 30000; // 30 seconds default
  }

  /**
   * Call a Dust agent with input data
   */
  async callAgent(request: DustAgentRequest): Promise<DustAgentResponse> {
    const url = `${this.baseUrl}/agents/${request.agentId}/run`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: request.input,
          conversation_id: request.conversationId,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        throw new DustAPIError(
          "Dust API authentication failed",
          "DUST_AUTH_ERROR",
          response.status
        );
      }

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new DustAPIError(
          "Dust API rate limit exceeded",
          "DUST_RATE_LIMIT",
          response.status,
          retryAfter ? parseInt(retryAfter, 10) : undefined
        );
      }

      // Handle other errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new DustAPIError(
          errorData.message || `Dust API error: ${response.status}`,
          errorData.code || "DUST_API_ERROR",
          response.status
        );
      }

      const data = await response.json();

      return {
        success: true,
        data,
      };
    } catch (error) {
      if (error instanceof DustAPIError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            retryAfter: error.retryAfter,
          },
        };
      }

      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          error: {
            code: "DUST_TIMEOUT",
            message: `Agent call timed out after ${this.timeout}ms`,
          },
        };
      }

      return {
        success: false,
        error: {
          code: "DUST_UNKNOWN_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Validate API key by making a test call
   */
  async validateConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/workspaces`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Create a Dust client instance from environment variables
 */
export function createDustClient(): DustClient {
  const apiKey = process.env.DUST_API_KEY;

  if (!apiKey) {
    throw new Error(
      "DUST_API_KEY environment variable is required for Dust integration"
    );
  }

  return new DustClient({
    apiKey,
    baseUrl: process.env.DUST_API_URL,
    timeout: process.env.DUST_TIMEOUT
      ? parseInt(process.env.DUST_TIMEOUT, 10)
      : undefined,
  });
}
