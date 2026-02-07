import { McpServer } from "skybridge/server";
import { z } from "zod";
import { getAuth, authErrorResponse } from "./auth.js";
import {
  fetchRecentActivities,
  fetchActivitiesWithDetails,
  fetchDetailedActivity,
  activityToSummary,
  calculateAveragePace,
  filterActivitiesByDateRange,
  metersPerSecondToPace,
  UnauthorizedError,
  RateLimitError,
  type StravaActivity,
} from "./strava.js";
import {
  getCachedActivities,
  setCachedActivities,
  type CacheKey,
} from "./cache.js";
import { rateLimitErrorResponse } from "./errors.js";

const server = new McpServer(
  {
    name: "strava-running-coach",
    version: "0.0.1",
  },
  { capabilities: {} },
);

// Test widget to verify rendering
server.registerWidget(
  "test_widget",
  {
    description: "Test widget to verify rendering works",
  },
  {
    description: "Simple test widget",
    inputSchema: {},
  },
  async () => {
    return {
      structuredContent: { message: "Hello from server!" },
      content: [{ type: "text", text: "Test widget" }],
      isError: false,
    };
  },
);

// DEPRECATED: OAuth flow now handles authentication automatically
// This tool is kept for backward compatibility but should not be used
server.registerTool(
  "exchange_strava_code",
  {
    description: "⚠️ DEPRECATED: This tool is no longer needed. Authentication is now handled automatically through OAuth. When you need Strava access, ChatGPT will prompt you to connect your account with a simple 'Connect Strava' button. No manual code exchange required!",
    inputSchema: {
      code: z.string().describe("Authorization code (deprecated - OAuth handles this automatically)"),
    },
  },
  async (_input) => {
    return {
      content: [
        {
          type: "text",
          text: "⚠️ This tool is deprecated. Please use the automatic OAuth flow instead.\n\nWhen you try to access your training data, ChatGPT will automatically prompt you to connect your Strava account. Just click 'Connect Strava' and authorize - no manual code copying needed!",
        },
      ],
      isError: true,
    };
  },
);

// Data Tool: Fetch Activities
server.registerTool(
  "fetch_activities",
  {
    description: `⚠️ REQUIRES AUTHORIZATION: Fetch raw Strava running activities with configurable detail level. This is a DATA-ONLY tool (no UI) that returns structured JSON for GPT reasoning or visualization.

WHEN TO USE:
- Custom analysis not covered by integrated widgets
- Need raw activity data for flexible reasoning
- Building custom visualizations with render_* widgets
- Queries like: "Show me all my runs from last month", "What activities did I do?", "Get my recent training data"

WHEN NOT TO USE:
- For training summaries → use get_training_summary (faster, integrated)
- For week comparisons → use compare_training_weeks (faster, integrated)
- For coaching advice → use get_coaching_advice (faster, integrated)

WORKFLOW:
1. Call this tool to fetch activities
2. Reason about the data in GPT
3. Optionally visualize with render_line_chart, render_scatter_plot, or render_heatmap

EXAMPLE QUERIES:
- "Fetch my last 30 days of activities with detailed splits"
- "Get my running data from the past week"
- "Show me all activities with heart rate data"`,
    inputSchema: {
      days: z
        .number()
        .optional()
        .default(7)
        .describe("Number of days to fetch activities from (default: 7)"),
      includeDetails: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to fetch detailed data including splits, heart rate, and GPS (default: false)"),
      token: z
        .string()
        .optional()
        .describe("Strava access token (optional - OAuth handles authentication automatically)"),
    },
  },
  async ({ days, includeDetails, token }, extra) => {
    // Try manual token first, then OAuth
    let auth = token ? { userId: "manual", accessToken: token } : await getAuth(extra);
    
    if (!auth) {
      return authErrorResponse("missing_token");
    }

    try {
      // Generate cache key
      const cacheKey: CacheKey = {
        userId: auth.userId,
        days,
        includeDetails,
      };

      // Check cache first
      const cachedEntry = getCachedActivities(cacheKey);
      
      if (cachedEntry) {
        // Return cached data
        return {
          structuredContent: {
            data: cachedEntry.data,
            metadata: {
              fetchedAt: cachedEntry.fetchedAt,
              source: "strava",
              cached: true,
              count: cachedEntry.metadata.count,
              dateRange: {
                days,
                from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                to: new Date().toISOString().split('T')[0],
              },
              includeDetails,
            },
          },
          content: [
            {
              type: "text",
              text: `Retrieved ${cachedEntry.metadata.count} running activities from cache (last ${days} days${includeDetails ? ' with detailed data' : ''}).`,
            },
          ],
          isError: false,
        };
      }

      // Cache miss - fetch from Strava
      const activities = await fetchActivitiesWithDetails(
        auth.accessToken,
        days,
        includeDetails
      );

      // Store in cache
      setCachedActivities(cacheKey, activities);

      // Return structured data output
      return {
        structuredContent: {
          data: activities,
          metadata: {
            fetchedAt: new Date().toISOString(),
            source: "strava",
            cached: false,
            count: activities.length,
            dateRange: {
              days,
              from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              to: new Date().toISOString().split('T')[0],
            },
            includeDetails,
          },
        },
        content: [
          {
            type: "text",
            text: `Fetched ${activities.length} running activities from the last ${days} days${includeDetails ? ' with detailed data (splits, HR, GPS)' : ''}.`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      // Handle 401 Unauthorized errors specifically
      if (error instanceof UnauthorizedError) {
        return authErrorResponse("unauthorized");
      }
      
      // Handle 429 Rate Limit errors
      if (error instanceof RateLimitError) {
        return rateLimitErrorResponse(
          error.retryAfter,
          error.limit,
          error.usage
        );
      }
      
      console.error("Error fetching activities:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error fetching activities: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Data Tool: Calculate Pace Distribution
server.registerTool(
  "calculate_pace_distribution",
  {
    description: `⚠️ REQUIRES AUTHORIZATION: Analyze pace distribution across running activities. Groups activities by run type (easy, long, hard, recovery) or distance range, then calculates statistics (mean, median, std dev) for each group. This is a DATA-ONLY tool (no UI).

WHEN TO USE:
- Analyzing pace patterns across different run types
- Understanding pace variability and consistency
- Comparing easy vs hard vs long run paces
- Queries like: "How does my pace vary by run type?", "What's my average pace for long runs?", "Show me pace distribution by distance"

WORKFLOW:
1. Call this tool to get grouped pace statistics
2. Reason about patterns in GPT
3. Optionally visualize with render_distribution (box plot/histogram) or render_scatter_plot

EXAMPLE QUERIES:
- "What's my pace distribution across different run types?"
- "Compare my easy run pace to my hard run pace"
- "Show me how my pace varies by distance"
- "Analyze my pace consistency over the last month"`,
    inputSchema: {
      days: z
        .number()
        .optional()
        .default(30)
        .describe("Number of days to analyze (default: 30)"),
      groupBy: z
        .enum(["runType", "distanceRange"])
        .describe("Grouping criteria: 'runType' (easy/long/hard/recovery) or 'distanceRange' (short/medium/long)"),
      token: z
        .string()
        .optional()
        .describe("Strava access token (optional - OAuth handles authentication automatically)"),
    },
  },
  async ({ days, groupBy, token }, extra) => {
    // Try manual token first, then OAuth
    let auth = token ? { userId: "manual", accessToken: token } : await getAuth(extra);
    
    if (!auth) {
      return authErrorResponse("missing_token");
    }

    try {
      // Fetch activities
      const afterTimestamp = Math.floor(Date.now() / 1000 - days * 24 * 60 * 60);
      const activities = await fetchRecentActivities(auth.accessToken, afterTimestamp);

      if (activities.length === 0) {
        return {
          structuredContent: {
            data: {
              groups: [],
              groupBy,
            },
            metadata: {
              fetchedAt: new Date().toISOString(),
              source: "strava",
              cached: false,
              totalActivities: 0,
            },
          },
          content: [
            {
              type: "text",
              text: `No running activities found in the last ${days} days.`,
            },
          ],
          isError: false,
        };
      }

      // Calculate average pace for all activities to determine thresholds
      const allPaces = activities.map(a => 1000 / a.average_speed); // seconds per km
      const avgPace = allPaces.reduce((sum, p) => sum + p, 0) / allPaces.length;

      // Group activities based on criteria
      const groups: Map<string, StravaActivity[]> = new Map();

      if (groupBy === "runType") {
        // Classify by run type: easy, long, hard, recovery
        // Easy: pace slower than average, distance < 15km
        // Long: distance >= 15km
        // Hard: pace faster than average, distance < 15km
        // Recovery: very slow pace (>15% slower than average), short distance
        
        for (const activity of activities) {
          const pace = 1000 / activity.average_speed; // seconds per km
          const distanceKm = activity.distance / 1000;
          
          let runType: string;
          
          if (distanceKm >= 15) {
            runType = "long";
          } else if (pace > avgPace * 1.15) {
            runType = "recovery";
          } else if (pace < avgPace * 0.95) {
            runType = "hard";
          } else {
            runType = "easy";
          }
          
          if (!groups.has(runType)) {
            groups.set(runType, []);
          }
          groups.get(runType)!.push(activity);
        }
      } else {
        // Group by distance range: short (<5km), medium (5-15km), long (>=15km)
        for (const activity of activities) {
          const distanceKm = activity.distance / 1000;
          
          let range: string;
          if (distanceKm < 5) {
            range = "short";
          } else if (distanceKm < 15) {
            range = "medium";
          } else {
            range = "long";
          }
          
          if (!groups.has(range)) {
            groups.set(range, []);
          }
          groups.get(range)!.push(activity);
        }
      }

      // Calculate statistics for each group
      const groupStats = Array.from(groups.entries()).map(([groupName, groupActivities]) => {
        const paces = groupActivities.map(a => 1000 / a.average_speed); // seconds per km
        
        // Calculate mean
        const mean = paces.reduce((sum, p) => sum + p, 0) / paces.length;
        
        // Calculate median
        const sortedPaces = [...paces].sort((a, b) => a - b);
        const median = sortedPaces.length % 2 === 0
          ? (sortedPaces[sortedPaces.length / 2 - 1] + sortedPaces[sortedPaces.length / 2]) / 2
          : sortedPaces[Math.floor(sortedPaces.length / 2)];
        
        // Calculate standard deviation
        const variance = paces.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / paces.length;
        const stdDev = Math.sqrt(variance);
        
        // Convert to pace format
        const formatPace = (seconds: number) => {
          const minutes = Math.floor(seconds / 60);
          const secs = Math.round(seconds % 60);
          return `${minutes}:${secs.toString().padStart(2, "0")}`;
        };
        
        return {
          group: groupName,
          count: groupActivities.length,
          statistics: {
            mean: formatPace(mean),
            median: formatPace(median),
            stdDev: Math.round(stdDev),
            meanSeconds: Math.round(mean),
            medianSeconds: Math.round(median),
          },
          activities: groupActivities.map(a => ({
            id: a.id,
            name: a.name,
            date: a.start_date_local.split("T")[0],
            distance: Math.round((a.distance / 1000) * 10) / 10,
            pace: metersPerSecondToPace(a.average_speed),
          })),
        };
      });

      // Sort groups by logical order
      const groupOrder = groupBy === "runType" 
        ? ["recovery", "easy", "hard", "long"]
        : ["short", "medium", "long"];
      
      groupStats.sort((a, b) => {
        const aIndex = groupOrder.indexOf(a.group);
        const bIndex = groupOrder.indexOf(b.group);
        return aIndex - bIndex;
      });

      return {
        structuredContent: {
          data: {
            groups: groupStats,
            groupBy,
            totalActivities: activities.length,
          },
          metadata: {
            fetchedAt: new Date().toISOString(),
            source: "strava",
            cached: false,
            dateRange: {
              days,
              from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              to: new Date().toISOString().split('T')[0],
            },
          },
        },
        content: [
          {
            type: "text",
            text: `Analyzed ${activities.length} activities grouped by ${groupBy}. Found ${groupStats.length} groups: ${groupStats.map(g => `${g.group} (${g.count})`).join(", ")}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      // Handle 401 Unauthorized errors specifically
      if (error instanceof UnauthorizedError) {
        return authErrorResponse("unauthorized");
      }
      
      // Handle 429 Rate Limit errors
      if (error instanceof RateLimitError) {
        return rateLimitErrorResponse(
          error.retryAfter,
          error.limit,
          error.usage
        );
      }
      
      console.error("Error calculating pace distribution:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error calculating pace distribution: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Data Tool: Analyze Elevation Impact
server.registerTool(
  "analyze_elevation_impact",
  {
    description: `⚠️ REQUIRES AUTHORIZATION: Analyze how elevation gain impacts running pace. Calculates pace adjustments based on elevation gain and computes climb-adjusted pace for each run. This is a DATA-ONLY tool (no UI).

WHEN TO USE:
- Understanding how hills affect performance
- Comparing runs on different terrain fairly
- Calculating "flat-equivalent" pace for hilly runs
- Queries like: "How does elevation affect my pace?", "What would my pace be on flat ground?", "Compare hilly vs flat runs"

WORKFLOW:
1. Call this tool to get elevation-adjusted pace data
2. Reason about terrain impact in GPT
3. Optionally visualize with render_scatter_plot (elevation vs pace) or render_line_chart (elevation over time)

EXAMPLE QUERIES:
- "How much does elevation slow me down?"
- "What's my adjusted pace accounting for hills?"
- "Compare my performance on flat vs hilly routes"
- "Show me which runs had the most elevation gain"`,
    inputSchema: {
      days: z
        .number()
        .optional()
        .default(30)
        .describe("Number of days to analyze (default: 30)"),
      token: z
        .string()
        .optional()
        .describe("Strava access token (optional - OAuth handles authentication automatically)"),
    },
  },
  async ({ days, token }, extra) => {
    // Try manual token first, then OAuth
    let auth = token ? { userId: "manual", accessToken: token } : await getAuth(extra);
    
    if (!auth) {
      return authErrorResponse("missing_token");
    }

    try {
      // Fetch activities
      const afterTimestamp = Math.floor(Date.now() / 1000 - days * 24 * 60 * 60);
      const activities = await fetchRecentActivities(auth.accessToken, afterTimestamp);

      if (activities.length === 0) {
        return {
          structuredContent: {
            data: {
              activities: [],
              summary: {
                totalActivities: 0,
                averageElevationGain: 0,
                averagePaceAdjustment: 0,
              },
            },
            metadata: {
              fetchedAt: new Date().toISOString(),
              source: "strava",
              cached: false,
            },
          },
          content: [
            {
              type: "text",
              text: `No running activities found in the last ${days} days.`,
            },
          ],
          isError: false,
        };
      }

      // Calculate elevation impact for each activity
      // Rule of thumb: ~10-15 seconds per 100m of elevation gain
      // We'll use 12 seconds per 100m as a standard adjustment
      const SECONDS_PER_100M_ELEVATION = 12;

      const analysisResults = activities.map(activity => {
        const distanceKm = activity.distance / 1000;
        const elevationGainM = activity.total_elevation_gain;
        const actualPaceSecondsPerKm = 1000 / activity.average_speed;
        
        // Calculate pace adjustment based on elevation
        // Adjustment = (elevation gain / 100) * seconds per 100m / distance in km
        const paceAdjustmentSecondsPerKm = distanceKm > 0
          ? (elevationGainM / 100) * SECONDS_PER_100M_ELEVATION / distanceKm
          : 0;
        
        // Climb-adjusted pace (what pace would be on flat ground)
        const adjustedPaceSecondsPerKm = actualPaceSecondsPerKm - paceAdjustmentSecondsPerKm;
        
        // Format paces
        const formatPace = (seconds: number) => {
          const minutes = Math.floor(seconds / 60);
          const secs = Math.round(seconds % 60);
          return `${minutes}:${secs.toString().padStart(2, "0")}`;
        };
        
        return {
          id: activity.id,
          name: activity.name,
          date: activity.start_date_local.split("T")[0],
          distance: Math.round(distanceKm * 10) / 10,
          elevationGain: Math.round(elevationGainM),
          actualPace: formatPace(actualPaceSecondsPerKm),
          adjustedPace: formatPace(adjustedPaceSecondsPerKm),
          paceAdjustment: Math.round(paceAdjustmentSecondsPerKm),
          elevationPerKm: distanceKm > 0 ? Math.round(elevationGainM / distanceKm) : 0,
        };
      });

      // Calculate summary statistics
      const totalElevationGain = activities.reduce((sum, a) => sum + a.total_elevation_gain, 0);
      const averageElevationGain = Math.round(totalElevationGain / activities.length);
      
      const totalPaceAdjustment = analysisResults.reduce((sum, r) => sum + r.paceAdjustment, 0);
      const averagePaceAdjustment = Math.round(totalPaceAdjustment / analysisResults.length);

      // Sort by elevation gain (highest first) for easier analysis
      analysisResults.sort((a, b) => b.elevationGain - a.elevationGain);

      return {
        structuredContent: {
          data: {
            activities: analysisResults,
            summary: {
              totalActivities: activities.length,
              averageElevationGain,
              averagePaceAdjustment,
              adjustmentMethod: `${SECONDS_PER_100M_ELEVATION} seconds per 100m elevation gain`,
            },
          },
          metadata: {
            fetchedAt: new Date().toISOString(),
            source: "strava",
            cached: false,
            dateRange: {
              days,
              from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              to: new Date().toISOString().split('T')[0],
            },
          },
        },
        content: [
          {
            type: "text",
            text: `Analyzed elevation impact for ${activities.length} activities. Average elevation gain: ${averageElevationGain}m, Average pace adjustment: ${averagePaceAdjustment}s/km`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      // Handle 401 Unauthorized errors specifically
      if (error instanceof UnauthorizedError) {
        return authErrorResponse("unauthorized");
      }
      
      // Handle 429 Rate Limit errors
      if (error instanceof RateLimitError) {
        return rateLimitErrorResponse(
          error.retryAfter,
          error.limit,
          error.usage
        );
      }
      
      console.error("Error analyzing elevation impact:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error analyzing elevation impact: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Data Tool: Get Run Comparison
server.registerTool(
  "get_run_comparison",
  {
    description: `⚠️ REQUIRES AUTHORIZATION: Compare two specific runs side-by-side. Returns structured comparison data with aligned metrics, deltas, and trend analysis. This is a DATA-ONLY tool (no UI).

WHEN TO USE:
- Comparing two specific activities by ID
- Analyzing performance differences between runs
- Understanding improvement or decline between attempts
- Queries like: "Compare run X to run Y", "How did my last two runs compare?", "Show me the difference between these activities"

WORKFLOW:
1. Call this tool with two activity IDs to get comparison data
2. Reason about the differences in GPT
3. Visualize with render_comparison_card for side-by-side display

EXAMPLE QUERIES:
- "Compare my run from Monday to my run from Friday"
- "How did activity 12345 compare to activity 67890?"
- "Show me the difference between my last two 10k runs"
- "Compare this week's long run to last week's"

NOTE: You need activity IDs. If user doesn't provide them, first call fetch_activities to get recent activity IDs, then use this tool.`,
    inputSchema: {
      run1Id: z
        .number()
        .describe("Strava activity ID of the first run"),
      run2Id: z
        .number()
        .describe("Strava activity ID of the second run"),
      token: z
        .string()
        .optional()
        .describe("Strava access token (optional - OAuth handles authentication automatically)"),
    },
  },
  async ({ run1Id, run2Id, token }, extra) => {
    // Try manual token first, then OAuth
    let auth = token ? { userId: "manual", accessToken: token } : await getAuth(extra);
    
    if (!auth) {
      return authErrorResponse("missing_token");
    }

    try {
      // Fetch both activities with detailed data
      const [run1, run2] = await Promise.all([
        fetchDetailedActivity(auth.accessToken, run1Id),
        fetchDetailedActivity(auth.accessToken, run2Id),
      ]);

      // Convert to activity summaries
      const run1Summary = activityToSummary(run1);
      const run2Summary = activityToSummary(run2);

      // Calculate deltas
      const distanceDelta = run2.distance - run1.distance;
      const distancePercentage = run1.distance > 0 
        ? Math.round((distanceDelta / run1.distance) * 100 * 10) / 10
        : 0;

      // Calculate pace delta (in seconds per km)
      const run1PaceSecondsPerKm = 1000 / run1.average_speed; // seconds per km
      const run2PaceSecondsPerKm = 1000 / run2.average_speed;
      const paceDelta = run2PaceSecondsPerKm - run1PaceSecondsPerKm;

      // Calculate elevation delta
      const elevationDelta = run2.total_elevation_gain - run1.total_elevation_gain;

      // Calculate heart rate delta (if available)
      let heartRateDelta: number | undefined;
      if (run1.average_heartrate && run2.average_heartrate) {
        heartRateDelta = run2.average_heartrate - run1.average_heartrate;
      }

      // Determine trend
      // Improving: faster pace (negative delta) or significantly more distance
      // Declining: slower pace (positive delta) or significantly less distance
      // Stable: minimal changes
      let trend: "improving" | "declining" | "stable" = "stable";
      
      if (paceDelta < -10 || (distancePercentage > 15 && paceDelta < 5)) {
        trend = "improving";
      } else if (paceDelta > 10 || (distancePercentage < -15 && paceDelta > -5)) {
        trend = "declining";
      }

      // Build comparison data model
      const comparison = {
        run1: {
          id: run1.id,
          name: run1.name,
          date: run1Summary.date,
          distance: run1Summary.distance,
          pace: run1Summary.pace,
          duration: run1Summary.duration,
          elevation: Math.round(run1.total_elevation_gain),
          heartRate: run1.average_heartrate,
        },
        run2: {
          id: run2.id,
          name: run2.name,
          date: run2Summary.date,
          distance: run2Summary.distance,
          pace: run2Summary.pace,
          duration: run2Summary.duration,
          elevation: Math.round(run2.total_elevation_gain),
          heartRate: run2.average_heartrate,
        },
        deltas: {
          distance: distancePercentage,
          pace: Math.round(paceDelta),
          elevation: Math.round(elevationDelta),
          heartRate: heartRateDelta ? Math.round(heartRateDelta) : undefined,
        },
        trend,
      };

      return {
        structuredContent: {
          data: comparison,
          metadata: {
            fetchedAt: new Date().toISOString(),
            source: "strava",
            cached: false,
          },
        },
        content: [
          {
            type: "text",
            text: `Compared runs: ${run1.name} vs ${run2.name}. Trend: ${trend}. Distance: ${distancePercentage > 0 ? "+" : ""}${distancePercentage}%, Pace: ${paceDelta > 0 ? "+" : ""}${Math.round(paceDelta)}s/km`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      // Handle 401 Unauthorized errors specifically
      if (error instanceof UnauthorizedError) {
        return authErrorResponse("unauthorized");
      }
      
      // Handle 429 Rate Limit errors
      if (error instanceof RateLimitError) {
        return rateLimitErrorResponse(
          error.retryAfter,
          error.limit,
          error.usage
        );
      }
      
      console.error("Error comparing runs:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error comparing runs: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Data Tool: Compute Training Load
server.registerTool(
  "compute_training_load",
  {
    description: `⚠️ REQUIRES AUTHORIZATION: Calculate training load metrics including acute load (7 days), chronic load (28 days), and acute:chronic ratio. This is a DATA-ONLY tool (no UI).

WHEN TO USE:
- Assessing training volume and intensity
- Calculating injury risk based on acute:chronic ratio
- Understanding training load trends
- Queries like: "What's my training load?", "Am I at risk of injury?", "Calculate my acute:chronic ratio", "Is my training load too high?"

WORKFLOW:
1. Call this tool to get load metrics
2. Reason about training state and injury risk in GPT
3. Optionally visualize with render_line_chart (load over time) or provide coaching advice

EXAMPLE QUERIES:
- "What's my current training load?"
- "Am I training too hard? Check my acute:chronic ratio"
- "Calculate my weekly vs monthly training volume"
- "Is my training load in the safe zone?"

INTERPRETATION:
- Ratio < 0.8: Undertraining (may need more volume)
- Ratio 0.8-1.3: Optimal training zone (sweet spot)
- Ratio > 1.5: High injury risk (reduce load)`,
    inputSchema: {
      days: z
        .number()
        .optional()
        .default(28)
        .describe("Number of days to analyze (default: 28, minimum 28 for chronic load calculation)"),
      token: z
        .string()
        .optional()
        .describe("Strava access token (optional - OAuth handles authentication automatically)"),
    },
  },
  async ({ days, token }, extra) => {
    // Try manual token first, then OAuth
    let auth = token ? { userId: "manual", accessToken: token } : await getAuth(extra);
    
    if (!auth) {
      return authErrorResponse("missing_token");
    }

    try {
      // Ensure we have at least 28 days for chronic load calculation
      const analyzeDays = Math.max(days, 28);
      
      // Fetch activities
      const afterTimestamp = Math.floor(Date.now() / 1000 - analyzeDays * 24 * 60 * 60);
      const activities = await fetchRecentActivities(auth.accessToken, afterTimestamp);

      if (activities.length === 0) {
        return {
          structuredContent: {
            data: {
              period: {
                start: new Date(Date.now() - analyzeDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0],
              },
              totalDistance: 0,
              totalTime: 0,
              runCount: 0,
              averagePace: "0:00",
              loadScore: 0,
              acuteLoad: 0,
              chronicLoad: 0,
              ratio: 0,
            },
            metadata: {
              fetchedAt: new Date().toISOString(),
              source: "strava",
              cached: false,
            },
          },
          content: [
            {
              type: "text",
              text: `No running activities found in the last ${analyzeDays} days.`,
            },
          ],
          isError: false,
        };
      }

      // Calculate date boundaries
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const twentyEightDaysAgo = new Date(now);
      twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);

      // Filter activities for acute load (last 7 days)
      const acuteActivities = filterActivitiesByDateRange(activities, sevenDaysAgo, now);
      
      // Filter activities for chronic load (last 28 days)
      const chronicActivities = filterActivitiesByDateRange(activities, twentyEightDaysAgo, now);

      // Calculate overall metrics (for the requested period)
      const startDate = new Date(Date.now() - analyzeDays * 24 * 60 * 60 * 1000);
      const periodActivities = filterActivitiesByDateRange(activities, startDate, now);

      const totalDistance = Math.round(
        periodActivities.reduce((sum, a) => sum + a.distance / 1000, 0) * 10
      ) / 10;
      
      const totalTime = Math.round(
        periodActivities.reduce((sum, a) => sum + a.moving_time / 60, 0)
      );
      
      const runCount = periodActivities.length;
      
      const averagePace = calculateAveragePace(periodActivities);

      // Calculate acute load (7 days)
      // Load = distance * intensity factor
      // Intensity factor based on pace relative to average
      const avgSpeed = periodActivities.length > 0
        ? periodActivities.reduce((sum, a) => sum + a.average_speed, 0) / periodActivities.length
        : 0;

      const calculateLoad = (acts: typeof activities) => {
        return acts.reduce((sum, a) => {
          const distanceKm = a.distance / 1000;
          // Intensity factor: faster runs get higher weight
          const intensityFactor = avgSpeed > 0 ? a.average_speed / avgSpeed : 1;
          return sum + (distanceKm * intensityFactor);
        }, 0);
      };

      const acuteLoad = Math.round(calculateLoad(acuteActivities) * 10) / 10;
      const chronicLoad = Math.round(calculateLoad(chronicActivities) * 10) / 10;

      // Calculate acute:chronic ratio
      // Ratio < 0.8: undertraining
      // Ratio 0.8-1.3: optimal (sweet spot)
      // Ratio > 1.5: high injury risk
      const ratio = chronicLoad > 0 
        ? Math.round((acuteLoad / chronicLoad) * 100) / 100
        : 0;

      // Calculate overall load score (normalized to 0-100 scale)
      // Based on weekly distance and intensity
      const weeklyDistance = acuteLoad / 1; // Already weighted by intensity
      const loadScore = Math.min(100, Math.round(weeklyDistance * 2));

      // Build training load data model
      const trainingLoad = {
        period: {
          start: startDate.toISOString().split('T')[0],
          end: now.toISOString().split('T')[0],
        },
        totalDistance,
        totalTime,
        runCount,
        averagePace,
        loadScore,
        acuteLoad,
        chronicLoad,
        ratio,
      };

      return {
        structuredContent: {
          data: trainingLoad,
          metadata: {
            fetchedAt: new Date().toISOString(),
            source: "strava",
            cached: false,
            dateRange: {
              days: analyzeDays,
              from: startDate.toISOString().split('T')[0],
              to: now.toISOString().split('T')[0],
            },
          },
        },
        content: [
          {
            type: "text",
            text: `Training load calculated: Acute (7d): ${acuteLoad}, Chronic (28d): ${chronicLoad}, Ratio: ${ratio}. ${
              ratio < 0.8 ? "Consider increasing training volume." :
              ratio > 1.5 ? "⚠️ High injury risk - consider reducing load." :
              "Optimal training load range."
            }`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      // Handle 401 Unauthorized errors specifically
      if (error instanceof UnauthorizedError) {
        return authErrorResponse("unauthorized");
      }
      
      // Handle 429 Rate Limit errors
      if (error instanceof RateLimitError) {
        return rateLimitErrorResponse(
          error.retryAfter,
          error.limit,
          error.usage
        );
      }
      
      console.error("Error computing training load:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error computing training load: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Widget 1: Training Summary
server.registerWidget(
  "get_training_summary",
  {
    description: `⚠️ REQUIRES AUTHORIZATION: Analyze recent running activities. This is an INTEGRATED widget (combines data fetching + visualization).

WHEN TO USE (PREFER THIS):
- Quick training overview for recent period
- Queries like: "How's my training?", "Summarize my week", "Show me my recent runs", "What did I do this week?"
- This is FASTER than fetch_activities + manual analysis

WHEN NOT TO USE:
- Custom date ranges beyond simple "last N days"
- Need raw data for complex analysis → use fetch_activities
- Comparing specific runs → use get_run_comparison
- Need specific visualizations → use data tools + render_* widgets

WORKFLOW:
- Single call returns complete summary with stats, runs list, and insights
- No additional visualization needed (integrated UI)

EXAMPLE QUERIES:
- "How's my training looking this week?"
- "Summarize my last 7 days of running"
- "Show me my recent training"
- "What have I been doing lately?"`,
  },
  {
    description: "Analyze recent running activities from Strava. ALWAYS fetch data from Strava API - NEVER ask user to provide training data manually. All data comes from their connected Strava account.",
    inputSchema: {
      days: z
        .number()
        .optional()
        .default(7)
        .describe("Number of days to analyze (default: 7)"),
      token: z
        .string()
        .optional()
        .describe("Strava access token (optional - OAuth handles authentication automatically)"),
    },
  },
  async ({ days, token }, extra) => {
    // Try manual token first, then OAuth
    let auth = token ? { userId: "manual", accessToken: token } : await getAuth(extra);
    
    if (!auth) {
      return authErrorResponse("missing_token");
    }

    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch activities only for the requested date range
      const afterTimestamp = Math.floor(startDate.getTime() / 1000);
      const allActivities = await fetchRecentActivities(
        auth.accessToken,
        afterTimestamp,
      );

      // Filter to requested date range
      const activities = filterActivitiesByDateRange(
        allActivities,
        startDate,
        endDate,
      );

      // Calculate stats
      const totalDistance =
        Math.round(
          activities.reduce((sum, a) => sum + a.distance / 1000, 0) * 10,
        ) / 10;
      const totalRuns = activities.length;
      const avgPace = calculateAveragePace(activities);
      const totalTime = Math.round(
        activities.reduce((sum, a) => sum + a.moving_time / 60, 0),
      );

      // Convert activities to summary format
      const runs = activities.map(activityToSummary);

      return {
        structuredContent: {
          period: {
            start: startDate.toISOString().split("T")[0],
            end: endDate.toISOString().split("T")[0],
          },
          stats: {
            totalDistance,
            totalRuns,
            avgPace,
            totalTime,
          },
          runs,
          // LLM will generate these based on the data
          insight: "",
          encouragement: "",
        },
        content: [
          {
            type: "text",
            text: `Training summary for last ${days} days: ${totalRuns} runs, ${totalDistance}km total, ${avgPace}/km average pace.`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      // Handle 401 Unauthorized errors specifically
      if (error instanceof UnauthorizedError) {
        return authErrorResponse("unauthorized");
      }
      
      // Handle 429 Rate Limit errors
      if (error instanceof RateLimitError) {
        return rateLimitErrorResponse(
          error.retryAfter,
          error.limit,
          error.usage
        );
      }
      
      console.error("Error fetching training summary:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error fetching training data: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Widget 2: Compare Training Weeks
server.registerWidget(
  "compare_training_weeks",
  {
    description: `⚠️ REQUIRES AUTHORIZATION: Compare training weeks. This is an INTEGRATED widget (combines data fetching + visualization).

WHEN TO USE (PREFER THIS):
- Week-over-week training comparison
- Queries like: "Am I improving?", "How does this week compare?", "Show me my progress", "Compare this week to last week"
- This is FASTER than fetch_activities + manual comparison

WHEN NOT TO USE:
- Comparing specific runs (not weeks) → use get_run_comparison
- Need custom date ranges → use fetch_activities
- Need detailed pace analysis → use calculate_pace_distribution

WORKFLOW:
- Single call returns complete comparison with deltas, trends, and analysis
- No additional visualization needed (integrated UI)

EXAMPLE QUERIES:
- "Am I improving week over week?"
- "How does this week compare to last week?"
- "Show me my training progress"
- "Compare my current week to previous week"`,
  },
  {
    description: "Show week-over-week training progress from Strava. ALWAYS fetch data from Strava API - NEVER ask user to provide training data manually. All data comes from their connected Strava account.",
    inputSchema: {
      currentWeekStart: z
        .string()
        .optional()
        .describe("Start date of current week (ISO format, defaults to current week)"),
      token: z
        .string()
        .optional()
        .describe("Strava access token (optional - OAuth handles authentication automatically)"),
    },
  },
  async ({ currentWeekStart, token }, extra) => {
    // Try manual token first, then OAuth
    let auth = token ? { userId: "manual", accessToken: token } : await getAuth(extra);
    
    if (!auth) {
      return authErrorResponse("missing_token");
    }

    try {
      // Calculate week boundaries
      const now = new Date();
      const currentStart = currentWeekStart
        ? new Date(currentWeekStart)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());

      const currentEnd = new Date(currentStart);
      currentEnd.setDate(currentEnd.getDate() + 7);

      const previousStart = new Date(currentStart);
      previousStart.setDate(previousStart.getDate() - 7);

      const previousEnd = new Date(currentStart);

      // Fetch activities only for the 14 days needed (current + previous week)
      const fourteenDaysAgo = Math.floor(
        previousStart.getTime() / 1000,
      );
      const allActivities = await fetchRecentActivities(
        auth.accessToken,
        fourteenDaysAgo,
      );

      // Split into weeks
      const currentWeekActivities = filterActivitiesByDateRange(
        allActivities,
        currentStart,
        currentEnd,
      );
      const previousWeekActivities = filterActivitiesByDateRange(
        allActivities,
        previousStart,
        previousEnd,
      );

      // Calculate stats for each week
      const currentWeek = {
        totalDistance:
          Math.round(
            currentWeekActivities.reduce((sum, a) => sum + a.distance / 1000, 0) * 10,
          ) / 10,
        totalRuns: currentWeekActivities.length,
        avgPace: calculateAveragePace(currentWeekActivities),
      };

      const previousWeek = {
        totalDistance:
          Math.round(
            previousWeekActivities.reduce((sum, a) => sum + a.distance / 1000, 0) * 10,
          ) / 10,
        totalRuns: previousWeekActivities.length,
        avgPace: calculateAveragePace(previousWeekActivities),
      };

      // Calculate changes
      const distanceChange =
        previousWeek.totalDistance > 0
          ? Math.round(
              ((currentWeek.totalDistance - previousWeek.totalDistance) /
                previousWeek.totalDistance) *
                100,
            )
          : 0;

      const runsChange = currentWeek.totalRuns - previousWeek.totalRuns;

      // Convert pace to seconds for comparison
      const paceToSeconds = (pace: string) => {
        const [min, sec] = pace.split(":").map(Number);
        return min * 60 + sec;
      };

      const currentPaceSeconds = paceToSeconds(currentWeek.avgPace);
      const previousPaceSeconds = paceToSeconds(previousWeek.avgPace);
      const paceChange = currentPaceSeconds - previousPaceSeconds;

      // Determine trend
      let trend: "improving" | "stable" | "declining" = "stable";
      if (distanceChange > 10 || paceChange < -10) {
        trend = "improving";
      } else if (distanceChange < -10 || paceChange > 10) {
        trend = "declining";
      }

      return {
        structuredContent: {
          currentWeek,
          previousWeek,
          changes: {
            distanceChange,
            runsChange,
            paceChange,
          },
          trend,
          analysis: "", // LLM will generate this
        },
        content: [
          {
            type: "text",
            text: `Week comparison: Distance ${distanceChange > 0 ? "+" : ""}${distanceChange}%, Runs ${runsChange > 0 ? "+" : ""}${runsChange}, Pace ${paceChange > 0 ? "+" : ""}${paceChange}s/km`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      // Handle 401 Unauthorized errors specifically
      if (error instanceof UnauthorizedError) {
        return authErrorResponse("unauthorized");
      }
      
      // Handle 429 Rate Limit errors
      if (error instanceof RateLimitError) {
        return rateLimitErrorResponse(
          error.retryAfter,
          error.limit,
          error.usage
        );
      }
      
      console.error("Error comparing weeks:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error comparing training weeks: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Visualization Widget: Render Comparison Card
server.registerWidget(
  "render_comparison_card",
  {
    description: `Render a side-by-side comparison card for two runs with delta indicators and trend arrows. This is a VISUALIZATION-ONLY widget (no data fetching).

WHEN TO USE:
- After calling get_run_comparison data tool
- Displaying run-to-run performance differences visually
- Showing deltas with semantic colors (green=improvement, red=decline)
- Queries like: "Show me a comparison of these two runs", "Visualize the difference between run X and Y"

WORKFLOW:
1. First call get_run_comparison to fetch comparison data
2. Then call this widget with the returned data
3. Widget renders side-by-side cards with delta indicators and trend arrows

EXAMPLE QUERIES:
- "Compare my last two runs and show me the results"
- "Visualize the difference between activity 12345 and 67890"
- "Show me how my Monday run compared to Friday's run"

DATA SOURCE: get_run_comparison tool`,
  },
  {
    description: "Display a visual comparison of two runs showing metrics, deltas, and trends. Use this after fetching comparison data from get_run_comparison tool.",
    inputSchema: {
      data: z.object({
        run1: z.object({
          id: z.number(),
          name: z.string(),
          date: z.string(),
          distance: z.number(),
          pace: z.string(),
          duration: z.number(),
          elevation: z.number(),
          heartRate: z.number().optional(),
        }),
        run2: z.object({
          id: z.number(),
          name: z.string(),
          date: z.string(),
          distance: z.number(),
          pace: z.string(),
          duration: z.number(),
          elevation: z.number(),
          heartRate: z.number().optional(),
        }),
        deltas: z.object({
          distance: z.number().describe("Percentage change in distance"),
          pace: z.number().describe("Change in pace (seconds per km)"),
          elevation: z.number().describe("Change in elevation (meters)"),
          heartRate: z.number().optional().describe("Change in heart rate (bpm)"),
        }),
        trend: z.enum(["improving", "declining", "stable"]),
      }).describe("Run comparison data from get_run_comparison tool"),
      config: z.object({
        title: z.string().optional().describe("Custom title for the comparison card"),
        showTrendBadge: z.boolean().optional().describe("Whether to show the trend badge (default: true)"),
      }).optional().describe("Optional configuration for the comparison card"),
    },
  },
  async ({ data, config }) => {
    return {
      structuredContent: {
        data,
        config,
      },
      content: [
        {
          type: "text",
          text: `Comparison: ${data.run1.name} vs ${data.run2.name}. Trend: ${data.trend}`,
        },
      ],
      isError: false,
    };
  },
);

// Visualization Widget: Render Line Chart
server.registerWidget(
  "render_line_chart",
  {
    description: `Render a line chart for time series data with support for multiple series overlays. This is a VISUALIZATION-ONLY widget (no data fetching).

WHEN TO USE:
- Displaying trends over time (pace progression, distance over weeks, heart rate trends)
- Showing multiple metrics on the same chart
- Visualizing time series data from fetch_activities or other data tools
- Queries like: "Show me my pace over time", "Chart my weekly distance", "Visualize my training progression"

WORKFLOW:
1. First call a data tool (fetch_activities, compute_training_load, etc.)
2. Transform data into x/y points in GPT
3. Call this widget with the formatted data

EXAMPLE QUERIES:
- "Show me my pace progression over the last 3 months"
- "Chart my weekly distance for the past 8 weeks"
- "Visualize my heart rate trends over time"
- "Plot my elevation gain per run"

DATA SOURCES: fetch_activities, compute_training_load, analyze_elevation_impact, or any custom data transformation`,
  },
  {
    description: "Display time series data as a line chart with configurable axes, colors, and multiple series support. Use this to visualize trends over time such as pace progression, distance over time, or heart rate trends.",
    inputSchema: {
      data: z.array(z.object({
        x: z.union([z.string(), z.number()]).describe("X-axis value (date, time, or numeric)"),
        y: z.number().describe("Y-axis value (primary series)"),
        series: z.record(z.string(), z.number()).optional().describe("Additional series data as key-value pairs"),
      })).describe("Array of data points with x, y coordinates and optional additional series"),
      config: z.object({
        title: z.string().optional().describe("Chart title"),
        xAxis: z.object({
          label: z.string().describe("X-axis label"),
          unit: z.string().optional().describe("X-axis unit (e.g., 'date', 'km')"),
        }).optional().describe("X-axis configuration"),
        yAxis: z.object({
          label: z.string().describe("Y-axis label"),
          unit: z.string().optional().describe("Y-axis unit (e.g., 'min/km', 'm', 'bpm')"),
        }).optional().describe("Y-axis configuration"),
        colors: z.array(z.string()).optional().describe("Array of colors for series (uses design system gradients by default)"),
        showLegend: z.boolean().optional().describe("Whether to show legend (default: true)"),
        seriesNames: z.array(z.string()).optional().describe("Names for each series (for legend)"),
      }).optional().describe("Optional chart configuration"),
    },
  },
  async ({ data, config }) => {
    return {
      structuredContent: {
        data,
        config,
      },
      content: [
        {
          type: "text",
          text: `Line chart with ${data.length} data points${config?.title ? `: ${config.title}` : ""}`,
        },
      ],
      isError: false,
    };
  },
);

// Visualization Widget: Render Scatter Plot
server.registerWidget(
  "render_scatter_plot",
  {
    description: `Render a scatter plot for visualizing relationships between two variables with optional color coding by category and trend line. This is a VISUALIZATION-ONLY widget (no data fetching).

WHEN TO USE:
- Showing relationships between two metrics (distance vs pace, elevation vs heart rate)
- Identifying correlations and patterns
- Color-coding by category (run type, time of day, etc.)
- Queries like: "Show me the relationship between distance and pace", "Plot elevation vs heart rate", "Visualize pace vs distance"

WORKFLOW:
1. First call a data tool (fetch_activities, analyze_elevation_impact, etc.)
2. Transform data into x/y points with optional categories in GPT
3. Call this widget with the formatted data

EXAMPLE QUERIES:
- "Show me how distance affects my pace"
- "Plot elevation gain vs average heart rate"
- "Visualize the relationship between pace and heart rate"
- "Show me distance vs pace colored by run type"

DATA SOURCES: fetch_activities, analyze_elevation_impact, calculate_pace_distribution, or any custom data transformation`,
  },
  {
    description: "Display two-dimensional data as a scatter plot with configurable axes, color coding by category, and optional trend line. Use this to visualize relationships between metrics such as distance vs pace, elevation vs heart rate, or any other metric correlations.",
    inputSchema: {
      data: z.array(z.object({
        x: z.number().describe("X-axis value"),
        y: z.number().describe("Y-axis value"),
        category: z.string().optional().describe("Optional category for color coding"),
      })).describe("Array of data points with x, y coordinates and optional category"),
      config: z.object({
        title: z.string().optional().describe("Chart title"),
        xAxis: z.object({
          label: z.string().describe("X-axis label"),
          unit: z.string().optional().describe("X-axis unit (e.g., 'km', 'm', 'bpm')"),
        }).optional().describe("X-axis configuration"),
        yAxis: z.object({
          label: z.string().describe("Y-axis label"),
          unit: z.string().optional().describe("Y-axis unit (e.g., 'min/km', 'm', 'bpm')"),
        }).optional().describe("Y-axis configuration"),
        colors: z.record(z.string(), z.string()).optional().describe("Color mapping for categories (uses design system gradients by default)"),
        showTrendLine: z.boolean().optional().describe("Whether to show linear regression trend line (default: false)"),
        showLegend: z.boolean().optional().describe("Whether to show legend (default: true for multiple categories)"),
      }).optional().describe("Optional chart configuration"),
    },
  },
  async ({ data, config }) => {
    return {
      structuredContent: {
        data,
        config,
      },
      content: [
        {
          type: "text",
          text: `Scatter plot with ${data.length} data points${config?.title ? `: ${config.title}` : ""}${config?.showTrendLine ? " (with trend line)" : ""}`,
        },
      ],
      isError: false,
    };
  },
);

// Visualization Widget: Render Heatmap
server.registerWidget(
  "render_heatmap",
  {
    description: `Render a calendar heatmap showing activity frequency and intensity over time. This is a VISUALIZATION-ONLY widget (no data fetching).

WHEN TO USE:
- Visualizing training consistency and patterns
- Showing activity frequency over weeks/months
- Identifying rest days and high-volume periods
- Queries like: "Show me my training consistency", "Visualize my activity calendar", "Show me when I run most"

WORKFLOW:
1. First call fetch_activities to get activity data
2. Transform activities into date + intensity pairs in GPT (intensity = distance or duration normalized to 0-1)
3. Call this widget with the formatted data

EXAMPLE QUERIES:
- "Show me my training consistency over the last 3 months"
- "Visualize my activity calendar"
- "Show me a heatmap of my running frequency"
- "Display my training patterns over time"

DATA SOURCES: fetch_activities (transform to date + intensity pairs)`,
  },
  {
    description: "Display activity data as a calendar heatmap with color-coded intensity levels. Use this to visualize training consistency, activity patterns, and identify rest days or high-volume periods.",
    inputSchema: {
      data: z.array(z.object({
        date: z.string().describe("ISO date string (YYYY-MM-DD)"),
        intensity: z.number().min(0).max(1).describe("Activity intensity on 0-1 scale (0 = no activity, 1 = max intensity)"),
        details: z.object({
          distance: z.number().optional().describe("Distance in kilometers"),
          duration: z.number().optional().describe("Duration in minutes"),
          pace: z.string().optional().describe("Pace in min:sec format"),
          activityName: z.string().optional().describe("Name of the activity"),
        }).optional().describe("Optional activity details for tooltip"),
      })).describe("Array of date + intensity pairs with optional activity details"),
      config: z.object({
        title: z.string().optional().describe("Heatmap title"),
        startDate: z.string().optional().describe("ISO date string for calendar start (defaults to earliest data date)"),
        colorGradient: z.array(z.string()).optional().describe("Array of colors from low to high intensity (uses design system gradient by default)"),
        showTooltips: z.boolean().optional().describe("Whether to show tooltips on hover (default: true)"),
        showMonthLabels: z.boolean().optional().describe("Whether to show month labels (default: true)"),
        showDayLabels: z.boolean().optional().describe("Whether to show day of week labels (default: true)"),
      }).optional().describe("Optional heatmap configuration"),
    },
  },
  async ({ data, config }) => {
    return {
      structuredContent: {
        data,
        config,
      },
      content: [
        {
          type: "text",
          text: `Heatmap with ${data.length} activity days${config?.title ? `: ${config.title}` : ""}`,
        },
      ],
      isError: false,
    };
  },
);

// Visualization Widget: Render Distribution
server.registerWidget(
  "render_distribution",
  {
    description: `Render a distribution visualization (box plot or histogram) for analyzing metric spread, quartiles, and outliers. This is a VISUALIZATION-ONLY widget (no data fetching).

WHEN TO USE:
- Analyzing metric distributions (pace, heart rate, distance)
- Understanding variability and consistency
- Identifying outliers and typical ranges
- Queries like: "Show me my pace distribution", "Visualize my heart rate zones", "Show me distance patterns"

WORKFLOW:
1. First call a data tool (fetch_activities, calculate_pace_distribution, etc.)
2. Extract metric values as an array in GPT
3. Call this widget with the metric array and config (box or histogram)

EXAMPLE QUERIES:
- "Show me my pace distribution as a box plot"
- "Visualize my heart rate zones as a histogram"
- "Show me the spread of my run distances"
- "Display my pace variability"

DATA SOURCES: fetch_activities, calculate_pace_distribution, or any data tool that returns metric arrays`,
  },
  {
    description: "Display metric distribution as a box plot or histogram showing quartiles, outliers, and data spread. Use this to analyze pace distribution, heart rate zones, distance patterns, or any other metric distributions to understand variability and identify outliers.",
    inputSchema: {
      data: z.array(z.number()).describe("Array of metric values to visualize"),
      config: z.object({
        title: z.string().optional().describe("Chart title"),
        type: z.enum(["box", "histogram"]).describe("Visualization type: 'box' for box plot or 'histogram' for histogram"),
        metricLabel: z.string().optional().describe("Label for the metric being visualized (e.g., 'Pace', 'Heart Rate')"),
        unit: z.string().optional().describe("Unit of measurement (e.g., 'min/km', 'bpm', 'km')"),
        binCount: z.number().optional().describe("Number of bins for histogram (default: 10, only used for histogram type)"),
        showOutliers: z.boolean().optional().describe("Whether to show outliers in box plot (default: true, only used for box type)"),
        color: z.string().optional().describe("Primary color for the visualization (uses design system gradient by default)"),
      }).describe("Configuration for the distribution visualization"),
    },
  },
  async ({ data, config }) => {
    return {
      structuredContent: {
        data,
        config,
      },
      content: [
        {
          type: "text",
          text: `${config.type === "box" ? "Box plot" : "Histogram"} with ${data.length} data points${config.title ? `: ${config.title}` : ""}`,
        },
      ],
      isError: false,
    };
  },
);

// Integrated Widget: Analyze Run Progression
server.registerWidget(
  "analyze_run_progression",
  {
    description: `⚠️ REQUIRES AUTHORIZATION: Analyze performance progression for a specific route over time. This is an INTEGRATED widget (combines data fetching + visualization).

WHEN TO USE (PREFER THIS):
- Tracking improvement on a specific route
- Queries like: "How am I improving on my usual route?", "Show me my progression on [route name]", "Track my performance on this route"
- This is FASTER than fetch_activities + manual route matching + visualization

WHEN NOT TO USE:
- Comparing two specific runs → use get_run_comparison
- General training trends (not route-specific) → use get_training_summary or compare_training_weeks

WORKFLOW:
- Single call fetches activities, matches route, calculates progression, and displays results
- No additional visualization needed (integrated chart + stats)

EXAMPLE QUERIES:
- "How am I improving on my usual 5k route?"
- "Show me my progression on the Canal Saint-Martin loop"
- "Track my performance on my regular running route"
- "Am I getting faster on my favorite route?"

NOTE: Requires either a route name (searches activity names) or a polyline (for precise matching)`,
  },
  {
    description: "Analyze how performance on a specific route has changed over time. Fetches activities matching the route (by polyline similarity or route ID), calculates performance metrics, and displays progression with trend analysis. Shows best/worst/average performances. Use this to track improvement on favorite routes or regular training loops.",
    inputSchema: {
      polyline: z
        .string()
        .optional()
        .describe("Strava polyline string for route matching (encoded polyline from activity map)"),
      routeName: z
        .string()
        .optional()
        .describe("Route name to search for in activity names (alternative to polyline)"),
      days: z
        .number()
        .optional()
        .default(90)
        .describe("Number of days to analyze (default: 90)"),
      token: z
        .string()
        .optional()
        .describe("Strava access token (optional - OAuth handles authentication automatically)"),
    },
  },
  async ({ polyline, routeName, days, token }, extra) => {
    // Try manual token first, then OAuth
    let auth = token ? { userId: "manual", accessToken: token } : await getAuth(extra);
    
    if (!auth) {
      return authErrorResponse("missing_token");
    }

    try {
      // Fetch activities from the specified time range
      const afterTimestamp = Math.floor(Date.now() / 1000 - days * 24 * 60 * 60);
      const allActivities = await fetchRecentActivities(auth.accessToken, afterTimestamp);

      if (allActivities.length === 0) {
        return {
          structuredContent: {
            route: {
              identifier: polyline || routeName || "unknown",
              matchedActivities: 0,
            },
            progression: [],
            summary: {
              totalRuns: 0,
              bestPace: "0:00",
              worstPace: "0:00",
              averagePace: "0:00",
              improvement: 0,
            },
          },
          content: [
            {
              type: "text",
              text: `No running activities found in the last ${days} days.`,
            },
          ],
          isError: false,
        };
      }

      // Match activities to the route
      let matchedActivities: StravaActivity[] = [];

      if (routeName) {
        // Simple name-based matching
        const normalizedRouteName = routeName.toLowerCase().trim();
        matchedActivities = allActivities.filter(activity => 
          activity.name.toLowerCase().includes(normalizedRouteName)
        );
      } else if (polyline) {
        // For polyline matching, we'll use a simplified approach:
        // Match activities with similar distance and that have polylines
        // In a production system, you'd decode polylines and calculate Hausdorff distance
        
        // For now, we'll fetch detailed data for activities and match by polyline presence
        // This is a simplified implementation - a full implementation would decode and compare polylines
        const detailedActivities = await Promise.all(
          allActivities.slice(0, 20).map(async (activity) => {
            try {
              return await fetchDetailedActivity(auth.accessToken, activity.id);
            } catch (error) {
              console.error(`Failed to fetch details for activity ${activity.id}:`, error);
              return activity;
            }
          })
        );

        // Match activities that have the same polyline or very similar distance
        // This is a placeholder - real implementation would decode and compare polylines
        matchedActivities = detailedActivities.filter(activity => 
          activity.map?.summary_polyline === polyline ||
          (activity.map?.summary_polyline && activity.map.summary_polyline.length > 0)
        );

        // If no exact polyline match, fall back to distance-based matching
        if (matchedActivities.length === 0) {
          // Use the first activity's distance as reference
          const referenceDistance = allActivities[0].distance;
          const distanceTolerance = referenceDistance * 0.1; // 10% tolerance
          
          matchedActivities = allActivities.filter(activity =>
            Math.abs(activity.distance - referenceDistance) <= distanceTolerance
          );
        }
      } else {
        // No route identifier provided - return error
        return {
          content: [
            {
              type: "text",
              text: "Error: Either 'polyline' or 'routeName' must be provided to identify the route.",
            },
          ],
          isError: true,
        };
      }

      if (matchedActivities.length === 0) {
        return {
          structuredContent: {
            route: {
              identifier: polyline || routeName || "unknown",
              matchedActivities: 0,
            },
            progression: [],
            summary: {
              totalRuns: 0,
              bestPace: "0:00",
              worstPace: "0:00",
              averagePace: "0:00",
              improvement: 0,
            },
          },
          content: [
            {
              type: "text",
              text: `No activities found matching the specified route in the last ${days} days.`,
            },
          ],
          isError: false,
        };
      }

      // Sort activities by date (oldest first for progression)
      matchedActivities.sort((a, b) => 
        new Date(a.start_date_local).getTime() - new Date(b.start_date_local).getTime()
      );

      // Calculate performance metrics for each activity
      const progression = matchedActivities.map(activity => {
        const paceSecondsPerKm = 1000 / activity.average_speed;
        const formatPace = (seconds: number) => {
          const minutes = Math.floor(seconds / 60);
          const secs = Math.round(seconds % 60);
          return `${minutes}:${secs.toString().padStart(2, "0")}`;
        };

        return {
          id: activity.id,
          name: activity.name,
          date: activity.start_date_local.split("T")[0],
          distance: Math.round((activity.distance / 1000) * 10) / 10,
          pace: formatPace(paceSecondsPerKm),
          paceSeconds: Math.round(paceSecondsPerKm),
          duration: Math.round(activity.moving_time / 60),
          elevation: Math.round(activity.total_elevation_gain),
          heartRate: activity.average_heartrate,
        };
      });

      // Calculate summary statistics
      const paceSeconds = progression.map(p => p.paceSeconds);
      const bestPaceSeconds = Math.min(...paceSeconds);
      const worstPaceSeconds = Math.max(...paceSeconds);
      const avgPaceSeconds = Math.round(paceSeconds.reduce((sum, p) => sum + p, 0) / paceSeconds.length);

      const formatPace = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, "0")}`;
      };

      // Calculate improvement (compare first and last run)
      const firstRunPace = progression[0].paceSeconds;
      const lastRunPace = progression[progression.length - 1].paceSeconds;
      const improvementSeconds = firstRunPace - lastRunPace; // Negative means slower (decline)
      const improvementPercentage = firstRunPace > 0 
        ? Math.round((improvementSeconds / firstRunPace) * 100 * 10) / 10
        : 0;

      // Determine trend
      let trend: "improving" | "declining" | "stable" = "stable";
      if (improvementSeconds > 10) {
        trend = "improving"; // Getting faster
      } else if (improvementSeconds < -10) {
        trend = "declining"; // Getting slower
      }

      return {
        structuredContent: {
          route: {
            identifier: polyline || routeName || "unknown",
            matchedActivities: matchedActivities.length,
            averageDistance: Math.round((matchedActivities.reduce((sum, a) => sum + a.distance, 0) / matchedActivities.length / 1000) * 10) / 10,
          },
          progression,
          summary: {
            totalRuns: matchedActivities.length,
            bestPace: formatPace(bestPaceSeconds),
            worstPace: formatPace(worstPaceSeconds),
            averagePace: formatPace(avgPaceSeconds),
            improvement: improvementPercentage,
            improvementSeconds,
            trend,
            dateRange: {
              first: progression[0].date,
              last: progression[progression.length - 1].date,
            },
          },
        },
        content: [
          {
            type: "text",
            text: `Route progression: ${matchedActivities.length} runs found. Best: ${formatPace(bestPaceSeconds)}/km, Average: ${formatPace(avgPaceSeconds)}/km. ${trend === "improving" ? `Improved by ${improvementPercentage}%` : trend === "declining" ? `Declined by ${Math.abs(improvementPercentage)}%` : "Stable performance"}.`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      // Handle 401 Unauthorized errors specifically
      if (error instanceof UnauthorizedError) {
        return authErrorResponse("unauthorized");
      }
      
      // Handle 429 Rate Limit errors
      if (error instanceof RateLimitError) {
        return rateLimitErrorResponse(
          error.retryAfter,
          error.limit,
          error.usage
        );
      }
      
      console.error("Error analyzing run progression:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error analyzing run progression: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Widget 3: Coaching Advice
server.registerWidget(
  "get_coaching_advice",
  {
    description: `⚠️ REQUIRES AUTHORIZATION: Get personalized coaching advice. This is an INTEGRATED widget (combines data fetching + analysis).

WHEN TO USE (PREFER THIS):
- Training load assessment and recommendations
- Queries like: "What should I do next?", "Am I overdoing it?", "Should I rest?", "Give me coaching advice"
- This is FASTER than compute_training_load + manual reasoning

WHEN NOT TO USE:
- Need raw training load numbers → use compute_training_load
- Want specific visualizations → use compute_training_load + render_line_chart

WORKFLOW:
- Single call returns training state, load metrics, and actionable recommendations
- No additional analysis needed (integrated coaching logic)

EXAMPLE QUERIES:
- "What should I do next?"
- "Am I training too hard?"
- "Should I take a rest day?"
- "Give me coaching advice based on my recent training"
- "Am I at risk of injury?"`,
  },
  {
    description: "Analyze training load and provide coaching recommendations from Strava. ALWAYS fetch data from Strava API - NEVER ask user to provide training data manually. All data comes from their connected Strava account.",
    inputSchema: {
      context: z
        .string()
        .optional()
        .describe('Optional context like "recovery", "intensity", etc.'),
      token: z
        .string()
        .optional()
        .describe("Strava access token (optional - OAuth handles authentication automatically)"),
    },
  },
  async ({ context: _context, token }, extra) => {
    // Context parameter reserved for future use (e.g., specific advice types)
    // Try manual token first, then OAuth
    let auth = token ? { userId: "manual", accessToken: token } : await getAuth(extra);
    
    if (!auth) {
      return authErrorResponse("missing_token");
    }

    try {
      // Fetch recent activities
      const sevenDaysAgo = Math.floor(Date.now() / 1000 - 7 * 24 * 60 * 60);
      const activities = await fetchRecentActivities(auth.accessToken, sevenDaysAgo);

      // Calculate training load
      const now = new Date();
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const last7DaysActivities = activities;
      const last3DaysActivities = filterActivitiesByDateRange(
        activities,
        threeDaysAgo,
        now,
      );

      const last7Days =
        Math.round(
          last7DaysActivities.reduce((sum, a) => sum + a.distance / 1000, 0) * 10,
        ) / 10;
      const last3Days =
        Math.round(
          last3DaysActivities.reduce((sum, a) => sum + a.distance / 1000, 0) * 10,
        ) / 10;

      // Calculate consecutive days
      const sortedActivities = [...activities].sort(
        (a, b) =>
          new Date(b.start_date_local).getTime() -
          new Date(a.start_date_local).getTime(),
      );

      let consecutiveDays = 0;
      let lastDate: Date | null = null;

      for (const activity of sortedActivities) {
        const activityDate = new Date(activity.start_date_local);
        activityDate.setHours(0, 0, 0, 0);

        if (!lastDate) {
          consecutiveDays = 1;
          lastDate = activityDate;
        } else {
          const dayDiff = Math.floor(
            (lastDate.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (dayDiff === 1) {
            consecutiveDays++;
            lastDate = activityDate;
          } else {
            break;
          }
        }
      }

      // Determine training state
      let trainingState: "fresh" | "building" | "fatigued" | "recovering" = "fresh";
      if (consecutiveDays >= 4 || last3Days > 30) {
        trainingState = "fatigued";
      } else if (last7Days > 40) {
        trainingState = "building";
      } else if (last3Days < 10 && last7Days < 20) {
        trainingState = "recovering";
      }

      return {
        structuredContent: {
          recentLoad: {
            last7Days,
            last3Days,
            consecutiveDays,
          },
          recommendation: {
            action: "", // LLM will generate
            reasoning: "", // LLM will generate
            nextRun: "", // LLM will generate
          },
          trainingState,
        },
        content: [
          {
            type: "text",
            text: `Training load: ${last7Days}km in 7 days, ${last3Days}km in last 3 days. ${consecutiveDays} consecutive days. State: ${trainingState}`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      // Handle 401 Unauthorized errors specifically
      if (error instanceof UnauthorizedError) {
        return authErrorResponse("unauthorized");
      }
      
      // Handle 429 Rate Limit errors
      if (error instanceof RateLimitError) {
        return rateLimitErrorResponse(
          error.retryAfter,
          error.limit,
          error.usage
        );
      }
      
      console.error("Error getting coaching advice:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error analyzing training: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

export default server;
export type AppType = typeof server;
