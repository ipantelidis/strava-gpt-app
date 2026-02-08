/**
 * Dust agent configurations and interfaces
 */

import { DustClient, type DustAgentRequest } from "./client.js";

/**
 * Agent IDs - only Weather Agent is used
 */
export const AGENT_IDS = {
  WEATHER: process.env.DUST_WEATHER_AGENT_ID || "weather-agent",
};

/**
 * Weather Agent Interface
 * Matches the actual Dust agent output format
 */
export interface WeatherAgentInput {
  location: string;
  query?: string; // Natural language query
  timeframe?: "now" | "today" | "week";
}

export interface WeatherAgentOutput {
  location: string;
  current: {
    temperature_c: number;
    feels_like_c: number;
    conditions: "clear" | "cloudy" | "rain" | "storm" | "snow";
    precipitation_mm: number;
    wind_speed_kmh: number;
    humidity_percent: number;
    air_quality_index?: number;
  };
  suitability: {
    rating: "excellent" | "good" | "moderate" | "caution" | "not_recommended";
    score: number; // 0-100
    emoji: "✅" | "👍" | "⚠️" | "❌";
  };
  recommendations: {
    best_time: string;
    gear: string[];
    hydration: "low" | "moderate" | "high" | "critical";
    pace_adjustment: number; // percentage
  };
  warnings: string[];
  reasoning: string;
}

/**
 * Weather Agent wrapper
 */
export async function callWeatherAgent(
  client: DustClient,
  input: WeatherAgentInput,
  conversationId?: string
): Promise<WeatherAgentOutput> {
  const request: DustAgentRequest = {
    agentId: AGENT_IDS.WEATHER,
    input,
    conversationId,
  };

  const response = await client.callAgent(request);

  if (!response.success) {
    throw new Error(
      `Weather agent failed: ${response.error?.message || "Unknown error"}`
    );
  }

  return response.data as WeatherAgentOutput;
}

/**
 * POI Enrichment Agent Interface
 * Enriches POIs with runner-specific information via web search
 */
export interface POIEnrichmentInput {
  location: string;
  pois: Array<{ name: string; type: string }>;
  query?: string;
}

export interface POIEnrichmentOutput {
  enrichedPOIs: Array<{
    name: string;
    runnerInfo?: string;
    tips?: string;
    bestTime?: string;
    safetyNotes?: string;
  }>;
}

/**
 * POI Enrichment Agent wrapper
 */
export async function callPOIEnrichmentAgent(
  client: DustClient,
  input: POIEnrichmentInput,
  conversationId?: string
): Promise<POIEnrichmentOutput> {
  const agentId = process.env.DUST_POI_AGENT_ID || "poi-enrichment";

  const request: DustAgentRequest = {
    agentId,
    input,
    conversationId,
  };

  const response = await client.callAgent(request);

  if (!response.success) {
    throw new Error(
      `POI enrichment agent failed: ${response.error?.message || "Unknown error"}`
    );
  }

  return response.data as POIEnrichmentOutput;
}
