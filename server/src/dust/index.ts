/**
 * Dust AI Agent Integration
 * 
 * This module provides integration with Dust AI agents for:
 * - Weather-aware coaching recommendations
 * - Custom route generation
 * - Safety analysis and recommendations
 */

export {
  DustClient,
  DustAPIError,
  createDustClient,
} from "./client.js";

export type {
  DustConfig,
  DustAgentRequest,
  DustAgentResponse,
} from "./client.js";

export {
  AGENT_IDS,
  callWeatherAgent,
  callPOIEnrichmentAgent,
} from "./agents.js";

export type {
  WeatherAgentInput,
  WeatherAgentOutput,
  POIEnrichmentInput,
  POIEnrichmentOutput,
} from "./agents.js";

export {
  dustErrorResponse,
  isDustConfigured,
  dustConfigurationError,
  dustUnavailableMessage,
} from "./errors.js";
