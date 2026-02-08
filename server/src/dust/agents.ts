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
