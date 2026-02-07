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
  type StravaActivity,
} from "./strava.js";
import {
  getCachedActivities,
  setCachedActivities,
  type CacheKey,
} from "./cache.js";

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

// Helper tool: Exchange Strava authorization code for access token
server.registerTool(
  "exchange_strava_code",
  {
    description: "⚠️ REQUIRED FIRST STEP: Before analyzing any training data, users MUST authorize Strava access. Guide them to: 1) Click this authorization link: https://www.strava.com/oauth/authorize?client_id=200939&response_type=code&redirect_uri=http://localhost&approval_prompt=force&scope=read,activity:read_all 2) Click 'Authorize' on Strava 3) Copy the 'code' parameter from the redirect URL 4) Paste it here to exchange for an access token. If authorization fails or token is invalid, ALWAYS prompt user to get a fresh code by repeating these steps.",
    inputSchema: {
      code: z.string().describe("The authorization code from the Strava redirect URL (after 'code=')"),
    },
  },
  async ({ code }) => {
    try {
      console.log("Exchanging code for token...", { code: code.substring(0, 10) + "..." });
      
      const clientId = process.env.STRAVA_CLIENT_ID;
      const clientSecret = process.env.STRAVA_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        console.error("Missing Strava credentials");
        return {
          content: [
            {
              type: "text",
              text: "Server configuration error: Strava credentials not set. Please contact support.",
            },
          ],
          isError: true,
        };
      }

      const response = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          grant_type: "authorization_code",
        }),
      });

      const responseText = await response.text();
      console.log("Strava response:", response.status, responseText.substring(0, 100));

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to exchange code: ${response.status} ${response.statusText}. ${responseText}`,
            },
          ],
          isError: true,
        };
      }

      const data = JSON.parse(responseText);

      return {
        structuredContent: {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: data.expires_at,
          athlete: data.athlete,
        },
        content: [
          {
            type: "text",
            text: `✅ Successfully authorized! Your access token: ${data.access_token}\n\nNow you can use this token with the training widgets by saying: "Analyze my training using token: ${data.access_token}"`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Data Tool: Fetch Activities
server.registerTool(
  "fetch_activities",
  {
    description: "⚠️ REQUIRES AUTHORIZATION: Fetch raw Strava running activities with configurable detail level. This is a data-only tool that returns structured JSON for GPT reasoning or visualization. Use this when you need flexible access to activity data for custom analysis. For common queries, prefer integrated widgets like get_training_summary.",
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
        .describe("Strava access token (required - get from exchange_strava_code tool if not provided)"),
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
    description: "⚠️ REQUIRES AUTHORIZATION: Analyze pace distribution across running activities. Groups activities by run type (easy, long, hard, recovery) or distance range, then calculates statistics (mean, median, std dev) for each group. Use this to understand pace patterns across different types of runs.",
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
        .describe("Strava access token (required - get from exchange_strava_code tool if not provided)"),
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
    description: "⚠️ REQUIRES AUTHORIZATION: Analyze how elevation gain impacts running pace. Calculates pace adjustments based on elevation gain and computes climb-adjusted pace for each run. Use this to understand how hills affect your performance and compare runs on different terrain.",
    inputSchema: {
      days: z
        .number()
        .optional()
        .default(30)
        .describe("Number of days to analyze (default: 30)"),
      token: z
        .string()
        .optional()
        .describe("Strava access token (required - get from exchange_strava_code tool if not provided)"),
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
    description: "⚠️ REQUIRES AUTHORIZATION: Compare two specific runs side-by-side. Returns structured comparison data with aligned metrics, deltas, and trend analysis. Use this when you need to analyze performance differences between two specific activities.",
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
        .describe("Strava access token (required - get from exchange_strava_code tool if not provided)"),
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
    description: "⚠️ REQUIRES AUTHORIZATION: Calculate training load metrics including acute load (7 days), chronic load (28 days), and acute:chronic ratio. Use this to assess training volume, intensity, and injury risk based on load ratios.",
    inputSchema: {
      days: z
        .number()
        .optional()
        .default(28)
        .describe("Number of days to analyze (default: 28, minimum 28 for chronic load calculation)"),
      token: z
        .string()
        .optional()
        .describe("Strava access token (required - get from exchange_strava_code tool if not provided)"),
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
    description: "⚠️ REQUIRES AUTHORIZATION: Analyze recent running activities. User MUST have a valid Strava token. If no token or auth fails, STOP and guide user through exchange_strava_code tool first.",
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
        .describe("Strava access token (required - get from exchange_strava_code tool if not provided)"),
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

      // Fetch activities from last 30 days (to have enough data)
      const thirtyDaysAgo = Math.floor(
        Date.now() / 1000 - 30 * 24 * 60 * 60,
      );
      const allActivities = await fetchRecentActivities(
        auth.accessToken,
        thirtyDaysAgo,
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
    description: "⚠️ REQUIRES AUTHORIZATION: Compare training weeks. User MUST have a valid Strava token. If no token or auth fails, STOP and guide user through exchange_strava_code tool first.",
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
        .describe("Strava access token (required - get from exchange_strava_code tool if not provided)"),
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

      // Fetch activities
      const thirtyDaysAgo = Math.floor(
        Date.now() / 1000 - 30 * 24 * 60 * 60,
      );
      const allActivities = await fetchRecentActivities(
        auth.accessToken,
        thirtyDaysAgo,
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

// Widget 3: Coaching Advice
server.registerWidget(
  "get_coaching_advice",
  {
    description: "⚠️ REQUIRES AUTHORIZATION: Get personalized coaching advice. User MUST have a valid Strava token. If no token or auth fails, STOP and guide user through exchange_strava_code tool first.",
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
        .describe("Strava access token (required - get from exchange_strava_code tool if not provided)"),
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
