/**
 * Dust API client using official @dust-tt/client SDK
 */

import { DustAPI } from "@dust-tt/client";

export interface DustConfig {
  apiKey: string;
  workspaceId: string;
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
 * Dust API client wrapper using official SDK
 */
export class DustClient {
  private dustAPI: DustAPI;
  private timeout: number;

  constructor(config: DustConfig) {
    this.timeout = config.timeout || 30000;

    this.dustAPI = new DustAPI(
      { url: config.baseUrl || "https://dust.tt" },
      { workspaceId: config.workspaceId, apiKey: config.apiKey },
      console
    );
  }

  /**
   * Call a Dust agent with input data
   */
  async callAgent(request: DustAgentRequest): Promise<DustAgentResponse> {
    try {
      // Create conversation with agent
      const conversationResult = await this.dustAPI.createConversation({
        title: null,
        visibility: "unlisted",
        message: {
          content: JSON.stringify(request.input),
          mentions: [{ configurationId: request.agentId }],
          context: {
            timezone: "UTC",
            username: "API User",
            origin: "api",
          },
        },
      });

      if (conversationResult.isErr()) {
        const error = conversationResult.error;
        
        // Check for specific error types
        if (error.message.includes("401") || error.message.includes("403")) {
          throw new DustAPIError(
            "Dust API authentication failed",
            "DUST_AUTH_ERROR",
            401
          );
        }
        
        if (error.message.includes("429")) {
          throw new DustAPIError(
            "Dust API rate limit exceeded",
            "DUST_RATE_LIMIT",
            429
          );
        }

        return {
          success: false,
          error: {
            code: "DUST_API_ERROR",
            message: error.message,
          },
        };
      }

      const { conversation, message } = conversationResult.value;

      // Ensure message exists
      if (!message) {
        return {
          success: false,
          error: {
            code: "DUST_API_ERROR",
            message: "No message returned from conversation creation",
          },
        };
      }

      // Stream agent response with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Agent timeout")), this.timeout);
      });

      const streamPromise = (async () => {
        const streamResult = await this.dustAPI.streamAgentAnswerEvents({
          conversation,
          userMessageId: message.sId,
        });

        if (streamResult.isErr()) {
          throw new Error(streamResult.error.message);
        }

        const { eventStream } = streamResult.value;

        // Collect agent response
        let agentResponse = "";
        for await (const event of eventStream) {
          if (event.type === "agent_message_success") {
            // Agent completed successfully
            const content = event.message?.content;
            if (content) {
              agentResponse = content;
            }
          } else if (event.type === "agent_error") {
            throw new Error(event.error?.message || "Agent error");
          }
        }

        return agentResponse;
      })();

      const agentResponse = await Promise.race([streamPromise, timeoutPromise]) as string;

      // Parse JSON response
      try {
        const data = JSON.parse(agentResponse);
        return {
          success: true,
          data,
        };
      } catch (e) {
        // If not JSON, return as text
        return {
          success: true,
          data: { text: agentResponse },
        };
      }
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

      if (error instanceof Error && error.message === "Agent timeout") {
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
   * Validate API key by checking agent configurations
   */
  async validateConnection(): Promise<boolean> {
    try {
      const r = await this.dustAPI.getAgentConfigurations({});
      return r.isOk();
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
  const workspaceId = process.env.DUST_WORKSPACE_ID;

  if (!apiKey) {
    throw new Error(
      "DUST_API_KEY environment variable is required for Dust integration"
    );
  }

  if (!workspaceId) {
    throw new Error(
      "DUST_WORKSPACE_ID environment variable is required for Dust integration"
    );
  }

  return new DustClient({
    apiKey,
    workspaceId,
    baseUrl: process.env.DUST_API_URL,
    timeout: process.env.DUST_TIMEOUT
      ? parseInt(process.env.DUST_TIMEOUT, 10)
      : undefined,
  });
}
