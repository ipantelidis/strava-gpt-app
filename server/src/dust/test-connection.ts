/**
 * Simple script to test Dust SDK connection
 * Run with: npx tsx server/src/dust/test-connection.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Manually load .env file
const envPath = resolve(process.cwd(), ".env");
try {
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    }
  });
  console.log("✅ Loaded .env file\n");
} catch (error) {
  console.error("❌ Failed to load .env file:", error);
  process.exit(1);
}

import { createDustClient } from "./client.js";

async function testConnection() {
  console.log("🧪 Testing Dust SDK connection...\n");

  // Debug: Show environment variables
  console.log("🔍 Environment variables:");
  console.log("   DUST_API_KEY:", process.env.DUST_API_KEY ? "✅ Set" : "❌ Not set");
  console.log("   DUST_WORKSPACE_ID:", process.env.DUST_WORKSPACE_ID ? "✅ Set" : "❌ Not set");
  console.log("   DUST_WEATHER_AGENT_ID:", process.env.DUST_WEATHER_AGENT_ID ? "✅ Set" : "❌ Not set");
  console.log();

  try {
    // Create client
    console.log("1️⃣ Creating Dust client...");
    const client = createDustClient();
    console.log("   ✅ Client created\n");

    // Validate connection
    console.log("2️⃣ Validating API connection...");
    const isValid = await client.validateConnection();
    
    if (isValid) {
      console.log("   ✅ Connection valid!\n");
    } else {
      console.log("   ❌ Connection failed\n");
      process.exit(1);
    }

    // Test weather agent call
    console.log("3️⃣ Testing weather agent call...");
    const response = await client.callAgent({
      agentId: process.env.DUST_WEATHER_AGENT_ID || "8Xs5EljNPz",
      input: {
        location: "Paris",
        query: "Is it good for running today?",
        timeframe: "today",
      },
    });

    if (response.success) {
      console.log("   ✅ Weather agent call successful!\n");
      console.log("📊 Response data:");
      console.log(JSON.stringify(response.data, null, 2));
    } else {
      console.log("   ❌ Weather agent call failed");
      console.log("   Error:", response.error);
      process.exit(1);
    }

    console.log("\n✅ All tests passed! Dust SDK is working correctly.");
  } catch (error) {
    console.error("\n❌ Test failed with error:");
    console.error(error);
    process.exit(1);
  }
}

// Run tests
testConnection();
