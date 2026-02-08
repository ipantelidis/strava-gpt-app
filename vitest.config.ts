import { defineConfig } from "vitest/config";
import { config } from "dotenv";

// Load environment variables from .env file
config();

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      DUST_API_KEY: process.env.DUST_API_KEY,
      DUST_WEATHER_AGENT_ID: process.env.DUST_WEATHER_AGENT_ID,
    },
  },
});
