/**
 * Example usage of export_route_to_strava tool
 * 
 * This file demonstrates how to use the route export functionality.
 * It's not a test file, but rather documentation through code.
 */

import { generateGPX, type GPXTrackPoint } from "./gpx.js";
import type { GeneratedRoute } from "./mapbox.js";

/**
 * Example: Convert a generated route to GPX
 */
export function exampleRouteToGPX() {
  // Example route data (would come from generate_running_route)
  const exampleRoute: GeneratedRoute = {
    id: "route-1",
    name: "Paris 10k Loop",
    distance: 10.2,
    elevationGain: 45,
    elevationProfile: [
      { distance: 0, elevation: 35 },
      { distance: 2.5, elevation: 40 },
      { distance: 5.0, elevation: 50 },
      { distance: 7.5, elevation: 45 },
      { distance: 10.2, elevation: 35 },
    ],
    difficulty: "moderate",
    highlights: ["Scenic route", "Low traffic"],
    path: [
      { lat: 48.8566, lng: 2.3522 },
      { lat: 48.8576, lng: 2.3532 },
      { lat: 48.8586, lng: 2.3542 },
      { lat: 48.8596, lng: 2.3552 },
      { lat: 48.8566, lng: 2.3522 }, // Back to start
    ],
    polyline: "encoded_polyline_string",
    waypoints: [],
    pointsOfInterest: [],
    safetyScore: 85,
    scenicScore: 90,
    trafficLevel: "low",
  };

  // Convert path to GPX track points with elevation
  const trackPoints: GPXTrackPoint[] = exampleRoute.path.map((point, index) => {
    // Interpolate elevation from profile
    const progress = index / exampleRoute.path.length;
    const elevIndex = Math.floor(progress * exampleRoute.elevationProfile.length);
    const elevation = exampleRoute.elevationProfile[elevIndex]?.elevation;

    return {
      lat: point.lat,
      lng: point.lng,
      elevation,
    };
  });

  // Generate GPX
  const gpx = generateGPX(trackPoints, {
    name: exampleRoute.name,
    description: `${exampleRoute.distance}km route with ${exampleRoute.elevationGain}m elevation gain. ${exampleRoute.highlights.join(", ")}.`,
    author: "Strava Running Coach",
    time: new Date().toISOString(),
  });

  return gpx;
}

/**
 * Example: Full workflow from route generation to Strava export
 */
export async function exampleFullWorkflow() {
  // Step 1: User generates routes (via generate_running_route tool)
  console.log("Step 1: Generate routes");
  const routeRequest = {
    distance: 10,
    location: "Paris, France",
    mustInclude: ["Eiffel Tower"],
    scenicPriority: 80,
  };
  console.log("Request:", routeRequest);

  // Step 2: User selects a route they like
  console.log("\nStep 2: User selects route");
  const selectedRoute = {
    name: "Paris Eiffel Tower Loop",
    distance: 10.2,
    elevationGain: 45,
    path: [
      { lat: 48.8566, lng: 2.3522 },
      { lat: 48.8576, lng: 2.3532 },
      // ... more points
    ],
    elevationProfile: [
      { distance: 0, elevation: 35 },
      { distance: 5, elevation: 50 },
      { distance: 10.2, elevation: 35 },
    ],
  };

  // Step 3: Export to Strava (via export_route_to_strava tool)
  console.log("\nStep 3: Export to Strava");
  const exportRequest = {
    routeData: selectedRoute,
    activityName: "Morning Run - Eiffel Tower",
    description: "Scenic 10k route in Paris",
    // token: "user_strava_token" // Provided by OAuth
  };
  console.log("Export request:", exportRequest);

  // Step 4: User receives Strava URL
  console.log("\nStep 4: Success!");
  const mockResponse = {
    success: true,
    stravaActivityId: 12345678,
    stravaUrl: "https://www.strava.com/activities/12345678",
    routeName: "Morning Run - Eiffel Tower",
    distance: 10.2,
    elevationGain: 45,
  };
  console.log("Response:", mockResponse);

  return mockResponse;
}

/**
 * Example: Error handling scenarios
 */
export function exampleErrorHandling() {
  const scenarios = [
    {
      error: "Missing route data",
      message: "Route data is required. Please provide the route data from generate_running_route.",
    },
    {
      error: "Invalid GPX",
      message: "Generated GPX file is invalid. Please try again.",
    },
    {
      error: "Unauthorized",
      message: "Strava token is invalid or expired. Please reconnect your Strava account.",
    },
    {
      error: "Rate limit",
      message: "Strava API rate limit exceeded. Please try again in 15 minutes.",
    },
    {
      error: "Upload timeout",
      message: "Route uploaded to Strava but still processing. Check your Strava account in a few moments.",
    },
  ];

  console.log("Error Handling Scenarios:");
  scenarios.forEach((scenario) => {
    console.log(`\n${scenario.error}:`);
    console.log(`  → ${scenario.message}`);
  });
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("=== Route Export Examples ===\n");

  console.log("1. Generate GPX from route:");
  const gpx = exampleRouteToGPX();
  console.log(gpx.substring(0, 200) + "...\n");

  console.log("\n2. Full workflow:");
  await exampleFullWorkflow();

  console.log("\n\n3. Error handling:");
  exampleErrorHandling();
}
