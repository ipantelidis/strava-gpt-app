import { McpServer } from "skybridge/server";
import { z } from "zod";
import { getAuth, authErrorResponse } from "./auth.js";
import {
  fetchRecentActivities,
  activityToSummary,
  calculateAveragePace,
  filterActivitiesByDateRange,
} from "./strava.js";

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
      return authErrorResponse();
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
      return authErrorResponse();
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
      return authErrorResponse();
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
