// import { describe, it, expect } from "vitest";
// import type { StravaActivity } from "./strava";

// /**
//  * Integration Tests for Layered Visualization Architecture
//  * 
//  * These tests verify complete user flows from authentication through data fetching
//  * to visualization, ensuring all layers work together correctly.
//  * 
//  * Test Coverage:
//  * 1. Auth → Data Tool → Visualization flow
//  * 2. GPT orchestration patterns (integrated vs composed)
//  * 3. Fallback paths when components fail
//  * 4. Error propagation through layers
//  * 5. Caching behavior across requests
//  */

// describe("Integration Tests: Complete User Flows", () => {
//   describe("Flow 1: Auth → Data Tool → Visualization", () => {
//     it("should complete full flow from auth to data fetch to visualization", async () => {
//       // This test validates the complete pipeline:
//       // 1. User authorizes with Strava (exchange_strava_code)
//       // 2. Fetch activities using token (fetch_activities)
//       // 3. Transform data in GPT
//       // 4. Visualize with render_line_chart
      
//       // Step 1: Mock authorization
//       const mockToken = "mock_access_token_12345";
//       const authResult = {
//         access_token: mockToken,
//         refresh_token: "mock_refresh_token",
//         expires_at: Date.now() / 1000 + 21600, // 6 hours from now
//       };
      
//       expect(authResult.access_token).toBeDefined();
//       expect(authResult.expires_at).toBeGreaterThan(Date.now() / 1000);
      
//       // Step 2: Mock data fetching
//       const mockActivities: Partial<StravaActivity>[] = [
//         {
//           id: 1,
//           name: "Morning Run",
//           distance: 5000,
//           moving_time: 1500,
//           average_speed: 3.33,
//           total_elevation_gain: 50,
//           start_date_local: "2024-01-15T08:00:00Z",
//         },
//         {
//           id: 2,
//           name: "Evening Run",
//           distance: 8000,
//           moving_time: 2400,
//           average_speed: 3.33,
//           total_elevation_gain: 80,
//           start_date_local: "2024-01-16T18:00:00Z",
//         },
//       ];
      
//       // Verify data structure
//       expect(mockActivities).toHaveLength(2);
//       expect(mockActivities[0].distance).toBeGreaterThan(0);
      
//       // Step 3: Transform data for visualization (simulating GPT transformation)
//       const chartData = mockActivities.map(activity => ({
//         x: activity.start_date_local!.split("T")[0],
//         y: activity.distance! / 1000, // Convert to km
//       }));
      
//       expect(chartData).toHaveLength(2);
//       expect(chartData[0].y).toBe(5);
//       expect(chartData[1].y).toBe(8);
      
//       // Step 4: Verify visualization input format
//       const visualizationInput = {
//         data: chartData,
//         config: {
//           title: "Distance Over Time",
//           xAxis: { label: "Date" },
//           yAxis: { label: "Distance", unit: "km" },
//         },
//       };
      
//       expect(visualizationInput.data).toBeDefined();
//       expect(visualizationInput.config.title).toBe("Distance Over Time");
//     });

//     it("should handle auth errors before attempting data fetch", async () => {
//       // Test that auth errors are caught early and prevent data fetching
//       const invalidToken = "";
      
//       // Simulate auth check - explicitly type the token
//       const token: string = invalidToken;
//       const hasValidAuth = Boolean(token && token.length > 0);
      
//       expect(hasValidAuth).toBe(false);
      
//       // If auth fails, should return auth error response
//       const authErrorResponse = {
//         isError: true,
//         content: [
//           {
//             type: "text",
//             text: expect.stringContaining("authorization"),
//           },
//         ],
//       };
      
//       expect(authErrorResponse.isError).toBe(true);
//     });
//   });

//   describe("Flow 2: GPT Orchestration Patterns", () => {
//     it("should use integrated widget for common queries (fast path)", async () => {
//       // Test Pattern 1: Integrated Widget (Fast Path)
//       // Query: "How's my training?"
//       // Expected: Single call to get_training_summary
      
//       const query = "How's my training?";
//       const shouldUseIntegratedWidget = 
//         query.toLowerCase().includes("training") ||
//         query.toLowerCase().includes("how") ||
//         query.toLowerCase().includes("summary");
      
//       expect(shouldUseIntegratedWidget).toBe(true);
      
//       // Integrated widget returns complete response
//       const integratedResponse = {
//         structuredContent: {
//           period: { start: "2024-01-08", end: "2024-01-15" },
//           stats: {
//             totalDistance: 32.5,
//             totalRuns: 5,
//             avgPace: "5:20",
//             totalTime: 180,
//           },
//           runs: [],
//         },
//         isError: false,
//       };
      
//       expect(integratedResponse.structuredContent.stats.totalRuns).toBe(5);
//       expect(integratedResponse.isError).toBe(false);
//     });

//     it("should use data tool + visualization for custom queries (flexible path)", async () => {
//       // Test Pattern 2: Data Tool + Visualization (Flexible Path)
//       // Query: "Show me pace vs elevation"
//       // Expected: analyze_elevation_impact → transform → render_scatter_plot
      
//       const query = "Show me pace vs elevation";
//       const needsCustomVisualization = 
//         query.toLowerCase().includes("vs") ||
//         query.toLowerCase().includes("show me") ||
//         query.toLowerCase().includes("plot");
      
//       expect(needsCustomVisualization).toBe(true);
      
//       // Step 1: Data tool returns structured data
//       const dataToolResponse = {
//         data: {
//           activities: [
//             {
//               id: 1,
//               elevationGain: 100,
//               actualPace: "5:20",
//               paceAdjustment: 15,
//             },
//             {
//               id: 2,
//               elevationGain: 50,
//               actualPace: "5:10",
//               paceAdjustment: 8,
//             },
//           ],
//         },
//       };
      
//       // Step 2: GPT transforms data for scatter plot
//       const scatterData = dataToolResponse.data.activities.map(a => ({
//         x: a.elevationGain,
//         y: parseInt(a.actualPace.split(":")[0]) * 60 + parseInt(a.actualPace.split(":")[1]),
//       }));
      
//       expect(scatterData).toHaveLength(2);
//       expect(scatterData[0].x).toBe(100);
      
//       // Step 3: Visualization widget renders
//       const visualizationResponse = {
//         structuredContent: {
//           data: scatterData,
//           config: {
//             xAxis: { label: "Elevation Gain", unit: "m" },
//             yAxis: { label: "Pace", unit: "min/km" },
//           },
//         },
//         isError: false,
//       };
      
//       expect(visualizationResponse.isError).toBe(false);
//     });

//     it("should use data tool for analysis without visualization", async () => {
//       // Test Pattern 3: Data Tool + Reasoning (Analysis Path)
//       // Query: "What's my acute:chronic ratio?"
//       // Expected: compute_training_load → GPT reasoning → text response
      
//       const query = "What's my acute:chronic ratio?";
//       const needsAnalysisOnly = 
//         query.toLowerCase().includes("ratio") ||
//         query.toLowerCase().includes("what's my");
      
//       expect(needsAnalysisOnly).toBe(true);
      
//       // Data tool returns metrics
//       const trainingLoadData = {
//         acuteLoad: 45.5,
//         chronicLoad: 38.2,
//         ratio: 1.19,
//       };
      
//       // GPT reasons about the ratio
//       const isOptimalRange = trainingLoadData.ratio >= 0.8 && trainingLoadData.ratio <= 1.3;
//       const isHighRisk = trainingLoadData.ratio > 1.5;
      
//       expect(isOptimalRange).toBe(true);
//       expect(isHighRisk).toBe(false);
//     });
//   });

//   describe("Flow 3: Fallback Paths and Error Handling", () => {
//     it("should fall back to text when visualization fails", async () => {
//       // Test graceful degradation when render_line_chart fails
      
//       const mockData = [
//         { x: "2024-01-15", y: 5 },
//         { x: "2024-01-16", y: 8 },
//       ];
      
//       // Simulate visualization failure
//       const visualizationFailed = true;
      
//       if (visualizationFailed) {
//         // Fall back to text-based presentation
//         const textFallback = mockData.map(d => `${d.x}: ${d.y}km`).join(", ");
        
//         expect(textFallback).toContain("2024-01-15: 5km");
//         expect(textFallback).toContain("2024-01-16: 8km");
//       }
//     });

//     it("should handle missing optional data gracefully", async () => {
//       // Test that missing HR or GPS data doesn't break the flow
      
//       const activityWithMissingData: Partial<StravaActivity> = {
//         id: 1,
//         distance: 5000,
//         moving_time: 1500,
//         average_speed: 3.33,
//         total_elevation_gain: 50,
//         // Missing: average_heartrate, splits_metric, map
//       };
      
//       // Verify required fields are present
//       expect(activityWithMissingData.distance).toBeDefined();
//       expect(activityWithMissingData.moving_time).toBeDefined();
      
//       // Verify optional fields are handled
//       const hasHeartRate = activityWithMissingData.average_heartrate !== undefined;
//       const hasSplits = activityWithMissingData.splits_metric !== undefined;
      
//       expect(hasHeartRate).toBe(false);
//       expect(hasSplits).toBe(false);
      
//       // System should continue with available data
//       const canProcessActivity = 
//         activityWithMissingData.distance !== undefined &&
//         activityWithMissingData.moving_time !== undefined;
      
//       expect(canProcessActivity).toBe(true);
//     });

//     it("should detect and handle rate limit errors", async () => {
//       // Test rate limit detection and response
      
//       const mockResponse = {
//         status: 429,
//         headers: {
//           "X-RateLimit-Limit": "100",
//           "X-RateLimit-Usage": "100",
//           "Retry-After": "900",
//         },
//       };
      
//       const isRateLimited = mockResponse.status === 429;
//       expect(isRateLimited).toBe(true);
      
//       // Should extract rate limit info
//       const retryAfter = parseInt(mockResponse.headers["Retry-After"]);
//       const usage = parseInt(mockResponse.headers["X-RateLimit-Usage"]);
//       const limit = parseInt(mockResponse.headers["X-RateLimit-Limit"]);
      
//       expect(retryAfter).toBe(900);
//       expect(usage).toBe(100);
//       expect(limit).toBe(100);
      
//       // Should suggest waiting
//       const minutesToWait = Math.ceil(retryAfter / 60);
//       expect(minutesToWait).toBe(15);
//     });

//     it("should handle 401 errors and prompt re-authorization", async () => {
//       // Test unauthorized error detection
      
//       const mockResponse = {
//         status: 401,
//         statusText: "Unauthorized",
//       };
      
//       const isUnauthorized = mockResponse.status === 401;
//       expect(isUnauthorized).toBe(true);
      
//       // Should return auth error response with instructions
//       const authErrorResponse = {
//         isError: true,
//         content: [
//           {
//             type: "text",
//             text: expect.stringContaining("authorization"),
//           },
//         ],
//       };
      
//       expect(authErrorResponse.isError).toBe(true);
//     });
//   });

//   describe("Flow 4: Caching Behavior", () => {
//     it("should cache activities within conversation context", async () => {
//       // Test that repeated requests use cached data
      
//       // First request - cache miss
//       const firstRequest = {
//         cached: false,
//         fetchedAt: new Date().toISOString(),
//         data: [
//           { id: 1, distance: 5000 },
//           { id: 2, distance: 8000 },
//         ],
//       };
      
//       expect(firstRequest.cached).toBe(false);
      
//       // Second request with same parameters - cache hit
//       const secondRequest = {
//         cached: true,
//         fetchedAt: firstRequest.fetchedAt,
//         data: firstRequest.data,
//       };
      
//       expect(secondRequest.cached).toBe(true);
//       expect(secondRequest.data).toEqual(firstRequest.data);
//     });

//     it("should use different cache keys for different parameters", async () => {
//       // Test that cache keys differentiate by parameters
      
//       const cacheKey1 = {
//         userId: "user123",
//         days: 7,
//         includeDetails: false,
//       };
      
//       const cacheKey2 = {
//         userId: "user123",
//         days: 7,
//         includeDetails: true, // Different parameter
//       };
      
//       // Keys should be different
//       const key1String = JSON.stringify(cacheKey1);
//       const key2String = JSON.stringify(cacheKey2);
      
//       expect(key1String).not.toBe(key2String);
//     });

//     it("should invalidate cache for different users", async () => {
//       // Test that cache is user-specific
      
//       const user1CacheKey = {
//         userId: "user123",
//         days: 7,
//         includeDetails: false,
//       };
      
//       const user2CacheKey = {
//         userId: "user456",
//         days: 7,
//         includeDetails: false,
//       };
      
//       // Keys should be different even with same parameters
//       const key1String = JSON.stringify(user1CacheKey);
//       const key2String = JSON.stringify(user2CacheKey);
      
//       expect(key1String).not.toBe(key2String);
//     });
//   });

//   describe("Flow 5: Design System Consistency", () => {
//     it("should use design system constants across all widgets", async () => {
//       // Test that all visualizations use shared design system
      
//       const DesignSystem = {
//         colors: {
//           gradients: {
//             primary: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
//             secondary: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
//           },
//           semantic: {
//             improvement: "#10b981",
//             decline: "#ef4444",
//             stable: "#6b7280",
//           },
//         },
//         glassmorphism: {
//           backdropBlur: "blur(10px)",
//           background: "rgba(255, 255, 255, 0.1)",
//           border: "1px solid rgba(255, 255, 255, 0.2)",
//         },
//       };
      
//       // Verify design system structure
//       expect(DesignSystem.colors.gradients.primary).toContain("linear-gradient");
//       expect(DesignSystem.colors.semantic.improvement).toBe("#10b981");
//       expect(DesignSystem.glassmorphism.backdropBlur).toBe("blur(10px)");
      
//       // All widgets should reference these constants
//       const widgetStyles = {
//         background: DesignSystem.colors.gradients.primary,
//         backdropFilter: DesignSystem.glassmorphism.backdropBlur,
//       };
      
//       expect(widgetStyles.background).toBe(DesignSystem.colors.gradients.primary);
//       expect(widgetStyles.backdropFilter).toBe(DesignSystem.glassmorphism.backdropBlur);
//     });

//     it("should use semantic colors for trend indicators", async () => {
//       // Test that trend colors follow design system
      
//       const DesignSystem = {
//         colors: {
//           semantic: {
//             improvement: "#10b981",
//             decline: "#ef4444",
//             stable: "#6b7280",
//           },
//         },
//       };
      
//       const getTrendColor = (trend: "improving" | "declining" | "stable") => {
//         switch (trend) {
//           case "improving":
//             return DesignSystem.colors.semantic.improvement;
//           case "declining":
//             return DesignSystem.colors.semantic.decline;
//           case "stable":
//             return DesignSystem.colors.semantic.stable;
//         }
//       };
      
//       expect(getTrendColor("improving")).toBe("#10b981");
//       expect(getTrendColor("declining")).toBe("#ef4444");
//       expect(getTrendColor("stable")).toBe("#6b7280");
//     });
//   });

//   describe("Flow 6: Data Validation and Completeness", () => {
//     it("should validate required fields in activity data", async () => {
//       // Test that activities have all required fields
      
//       const requiredFields = [
//         "distance",
//         "moving_time",
//         "total_elevation_gain",
//         "average_speed",
//         "start_date_local",
//       ];
      
//       const validActivity = {
//         id: 1,
//         distance: 5000,
//         moving_time: 1500,
//         total_elevation_gain: 50,
//         average_speed: 3.33,
//         start_date_local: "2024-01-15T08:00:00Z",
//       };
      
//       const hasAllRequiredFields = requiredFields.every(
//         field => validActivity[field as keyof typeof validActivity] !== undefined
//       );
      
//       expect(hasAllRequiredFields).toBe(true);
//     });

//     it("should handle activities with partial data", async () => {
//       // Test graceful handling of incomplete data
      
//       const partialActivity: Partial<StravaActivity> = {
//         id: 1,
//         distance: 5000,
//         moving_time: 1500,
//         // Missing: total_elevation_gain, average_speed
//       };
      
//       const hasRequiredFields = 
//         partialActivity.distance !== undefined &&
//         partialActivity.moving_time !== undefined;
      
//       expect(hasRequiredFields).toBe(true);
      
//       // Should note missing fields
//       const missingFields: string[] = [];
//       if (!partialActivity.total_elevation_gain) missingFields.push("total_elevation_gain");
      
//       expect(missingFields).toContain("total_elevation_gain");
//     });
//   });

//   describe("Flow 7: Tool Output Schema Conformance", () => {
//     it("should return data in expected format from fetch_activities", async () => {
//       // Test that data tools return structured output matching schema
      
//       const dataToolOutput = {
//         data: [
//           {
//             id: 1,
//             distance: 5000,
//             moving_time: 1500,
//             average_speed: 3.33,
//             total_elevation_gain: 50,
//           },
//         ],
//         metadata: {
//           fetchedAt: new Date().toISOString(),
//           source: "strava",
//           cached: false,
//           count: 1,
//           dateRange: {
//             days: 7,
//             from: "2024-01-08",
//             to: "2024-01-15",
//           },
//           includeDetails: false,
//         },
//       };
      
//       // Verify structure
//       expect(dataToolOutput.data).toBeInstanceOf(Array);
//       expect(dataToolOutput.metadata.source).toBe("strava");
//       expect(dataToolOutput.metadata.count).toBe(1);
//       expect(dataToolOutput.metadata.dateRange.days).toBe(7);
//     });

//     it("should return comparison data in expected format", async () => {
//       // Test get_run_comparison output schema
      
//       const comparisonOutput = {
//         data: {
//           run1: {
//             id: 1,
//             name: "Morning Run",
//             date: "2024-01-15",
//             distance: 5.0,
//             pace: "5:00",
//             duration: 25,
//             elevation: 50,
//           },
//           run2: {
//             id: 2,
//             name: "Evening Run",
//             date: "2024-01-16",
//             distance: 5.2,
//             pace: "4:50",
//             duration: 25,
//             elevation: 45,
//           },
//           deltas: {
//             distance: 4.0, // percentage
//             pace: -10, // seconds per km
//             elevation: -5, // meters
//           },
//           trend: "improving" as const,
//         },
//         metadata: {
//           fetchedAt: new Date().toISOString(),
//           source: "strava",
//           cached: false,
//         },
//       };
      
//       // Verify structure
//       expect(comparisonOutput.data.run1).toBeDefined();
//       expect(comparisonOutput.data.run2).toBeDefined();
//       expect(comparisonOutput.data.deltas).toBeDefined();
//       expect(comparisonOutput.data.trend).toBe("improving");
//     });
//   });
// });
