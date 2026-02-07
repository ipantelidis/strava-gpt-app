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

// Widget 1: Training Summary
server.registerWidget(
  "get_training_summary",
  {
    description: "Get a summary of recent training with insights",
  },
  {
    description:
      "Analyze recent running activities and provide coaching insights",
    inputSchema: {
      days: z
        .number()
        .optional()
        .default(7)
        .describe("Number of days to analyze (default: 7)"),
    },
  },
  async ({ days }, extra) => {
    const auth = await getAuth(extra);
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
    description: "Compare current week with previous week",
  },
  {
    description: "Show week-over-week training progress with trends",
    inputSchema: {
      currentWeekStart: z
        .string()
        .optional()
        .describe("Start date of current week (ISO format, defaults to current week)"),
    },
  },
  async ({ currentWeekStart }, extra) => {
    const auth = await getAuth(extra);
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
    description: "Get personalized coaching advice based on recent training",
  },
  {
    description: "Analyze training load and provide actionable next-step recommendations",
    inputSchema: {
      context: z
        .string()
        .optional()
        .describe('Optional context like "recovery", "intensity", etc.'),
    },
  },
  async ({ context: _context }, extra) => {
    // Context parameter reserved for future use (e.g., specific advice types)
    const auth = await getAuth(extra);
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
