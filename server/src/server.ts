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
import {
  createDustClient,
  callWeatherAgent,
  dustErrorResponse,
  type WeatherAgentInput,
} from "./dust/index.js";
import { generateRoutes, enrichPOIsWithDust, type RouteRequest } from "./routes/index.js";

const server = new McpServer(
  {
    name: "strava-running-coach",
    version: "0.0.1",
  },
  { capabilities: {} },
);

// Widget: Connect Strava Account
// Renders UI with authorization button
server.registerWidget(
  "connect_strava",
  {
    description: "Connect your Strava account to access your training data. This widget provides an authorization interface with a clickable button. Use this when you need to authorize or re-authorize access to your Strava activities.",
  },
  {
    description: "Display Strava authorization interface with connect button",
    inputSchema: {},
  },
  async () => {
    // Using localhost for OAuth callback to match Strava authorized domains
    const serverUrl = "http://localhost:3000";
    const clientId = process.env.STRAVA_CLIENT_ID;
    
    if (!clientId) {
      return {
        content: [
          {
            type: "text",
            text: "🔐 Server configuration error: Strava client ID not configured. Please contact support.",
          },
        ],
        isError: true,
      };
    }
    
    // Create authorization URL with callback to our server
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(serverUrl + "/oauth/callback")}&approval_prompt=force&scope=read,activity:read_all`;
    
    return {
      structuredContent: {
        authUrl,
        serverUrl,
      },
      content: [
        {
          type: "text",
          text: `🔐 Connect Your Strava Account\n\nTo analyze your training data, I need access to your Strava activities.\n\nClick here to authorize: ${authUrl}\n\nAfter authorizing on Strava, you'll receive an access token. Copy it and provide it when using the training tools.`,
        },
      ],
      isError: false,
    };
  },
);

// Tool: Exchange Strava Authorization Code for Access Token
server.registerTool(
  "exchange_strava_code",
  {
    description: "Exchange a Strava authorization code for an access token. Use this after the user authorizes via the connect_strava widget.",
    inputSchema: {
      code: z.string().describe("The authorization code from Strava OAuth callback URL"),
    },
  },
  async ({ code }) => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return {
        content: [
          {
            type: "text",
            text: "❌ Server configuration error: Strava credentials not configured.",
          },
        ],
        isError: true,
      };
    }

    try {
      const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("Token exchange failed:", tokenResponse.status, errorData);
        return {
          content: [
            {
              type: "text",
              text: `❌ Failed to exchange code for token. Status: ${tokenResponse.status}. The code may have expired or already been used. Please get a new authorization code.`,
            },
          ],
          isError: true,
        };
      }

      const tokens = await tokenResponse.json();

      return {
        structuredContent: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
          athlete: tokens.athlete,
        },
        content: [
          {
            type: "text",
            text: `✅ Successfully connected to Strava!\n\n**Athlete:** ${tokens.athlete?.firstname} ${tokens.athlete?.lastname}\n**Token expires in:** ${Math.floor(tokens.expires_in / 3600)} hours\n\n🔑 **Your Access Token:**\n\`\`\`\n${tokens.access_token}\n\`\`\`\n\nYou can now use this token with other tools by providing it as the \`token\` parameter.`,
          },
        ],
      };
    } catch (error) {
      console.error("Token exchange error:", error);
      return {
        content: [
          {
            type: "text",
            text: `❌ Error exchanging code: ${error instanceof Error ? error.message : "Unknown error"}`,
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
    description: `Fetch raw Strava running activities with configurable detail level. This is a DATA-ONLY tool (no UI) that returns structured JSON for GPT reasoning or visualization.

AUTHENTICATION: OAuth handles authentication automatically. If the user has already connected their Strava account in this conversation, the token is available - just call the tool. Only prompt for authentication if you receive an authentication error.

WHEN TO USE:
- Custom analysis not covered by integrated widgets
- Need raw activity data for flexible reasoning
- Building custom visualizations with render_* widgets
- Small datasets (< 14 days recommended)
- Queries like: "Show me my last 5 runs", "Get my 3 longest runs from this week"

WHEN NOT TO USE:
- Large date ranges without filtering (> 30 days) → Use integrated widgets or add limit/filters
- For training summaries → use get_training_summary (faster, integrated)
- For week comparisons → use compare_training_weeks (faster, integrated)
- For pace analysis → use analyze_pace_patterns (integrated widget)
- For elevation analysis → use analyze_elevation_trends (integrated widget)

FILTERING TIPS:
- Use 'limit' to cap results: "Find my 4 longest runs" → limit=4, sortBy="distance"
- Use 'minDistance' to filter: "Runs over 10km" → minDistance=10
- Combine filters: "My 3 fastest long runs" → minDistance=10, limit=3, sortBy="pace"

WORKFLOW:
1. Call this tool to fetch activities
2. Reason about the data in GPT
3. Optionally visualize with render_line_chart, render_scatter_plot, or render_heatmap

EXAMPLE QUERIES:
- "Fetch my last 5 runs" → days=7, limit=5
- "Get my 3 longest runs from the past month" → days=30, limit=3, sortBy="distance"
- "Show me runs over 10km from this week" → days=7, minDistance=10
- "Find my fastest 5k runs" → days=30, minDistance=5, sortBy="pace"`,
    inputSchema: {
      days: z
        .number()
        .optional()
        .default(7)
        .describe("Number of days to fetch activities from (default: 7)"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of activities to return (optional - useful for 'find my N longest/fastest runs')"),
      sortBy: z
        .enum(["date", "distance", "pace"])
        .optional()
        .default("date")
        .describe("Sort activities by: date (newest first), distance (longest first), or pace (fastest first)"),
      minDistance: z
        .number()
        .optional()
        .describe("Minimum distance in kilometers (optional - filter out shorter runs)"),
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
  async ({ days, limit, sortBy, minDistance, includeDetails, token }, extra) => {
    // Try manual token first, then OAuth
    let auth = token ? { userId: "manual", accessToken: token } : await getAuth(extra);
    
    if (!auth) {
      return authErrorResponse("missing_token");
    }

    try {
      // Generate cache key (without filters - we filter after caching)
      const cacheKey: CacheKey = {
        userId: auth.userId,
        days,
        includeDetails,
      };

      // Check cache first
      let activities: StravaActivity[];
      let cached = false;
      
      const cachedEntry = getCachedActivities(cacheKey);
      
      if (cachedEntry) {
        activities = cachedEntry.data;
        cached = true;
      } else {
        // Cache miss - fetch from Strava
        activities = await fetchActivitiesWithDetails(
          auth.accessToken,
          days,
          includeDetails
        );
        
        // Store in cache
        setCachedActivities(cacheKey, activities);
      }

      // Apply filters
      let filteredActivities = [...activities];
      
      // Filter by minimum distance
      if (minDistance) {
        filteredActivities = filteredActivities.filter(
          a => (a.distance / 1000) >= minDistance
        );
      }
      
      // Sort activities
      if (sortBy === "distance") {
        filteredActivities.sort((a, b) => b.distance - a.distance);
      } else if (sortBy === "pace") {
        filteredActivities.sort((a, b) => b.average_speed - a.average_speed); // Higher speed = faster pace
      } else {
        // Default: sort by date (newest first)
        filteredActivities.sort((a, b) => 
          new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
        );
      }
      
      // Apply limit
      if (limit) {
        filteredActivities = filteredActivities.slice(0, limit);
      }

      // Return structured data output
      return {
        structuredContent: {
          data: filteredActivities,
          metadata: {
            fetchedAt: cachedEntry?.fetchedAt ?? new Date().toISOString(),
            source: "strava",
            cached,
            count: filteredActivities.length,
            totalBeforeFiltering: activities.length,
            dateRange: {
              days,
              from: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              to: new Date().toISOString().split('T')[0],
            },
            filters: {
              limit,
              sortBy,
              minDistance,
            },
            includeDetails,
          },
        },
        content: [
          {
            type: "text",
            text: `${cached ? 'Retrieved' : 'Fetched'} ${filteredActivities.length} running activities${activities.length !== filteredActivities.length ? ` (filtered from ${activities.length})` : ''} from the last ${days} days${includeDetails ? ' with detailed data' : ''}${sortBy ? `, sorted by ${sortBy}` : ''}${minDistance ? `, minimum ${minDistance}km` : ''}${limit ? `, limited to ${limit}` : ''}.`,
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

// Integrated Widget: Analyze Pace Patterns
server.registerWidget(
  "analyze_pace_patterns",
  {
    description: `Analyze pace distribution across running activities. Groups activities by run type (easy, long, hard, recovery) or distance range, then calculates statistics (mean, median, std dev) for each group. This is an INTEGRATED widget (combines data fetching + visualization).

AUTHENTICATION: OAuth handles authentication automatically. If the user has already connected their Strava account in this conversation, the token is available - just call the tool. Only prompt for authentication if you receive an authentication error.

WHEN TO USE (PREFER THIS):
- Analyzing pace patterns across different run types
- Understanding pace variability and consistency
- Comparing easy vs hard vs long run paces
- Queries like: "How does my pace vary by run type?", "What's my average pace for long runs?", "Show me pace distribution"

WHEN NOT TO USE:
- Need raw activity data for custom analysis → use fetch_activities with filters
- Comparing specific runs → use get_run_comparison

WORKFLOW:
- Single call fetches activities, groups them, calculates stats, and displays results
- No additional visualization needed (integrated stats display)

EXAMPLE QUERIES:
- "What's my pace distribution across different run types?"
- "Compare my easy run pace to my hard run pace"
- "Show me how my pace varies by distance"
- "Analyze my pace consistency over the last month"`,
  },
  {
    description: "Analyze how pace varies across different run types or distance ranges. Fetches activities, classifies them into groups (easy/long/hard/recovery or short/medium/long), calculates statistics for each group, and displays results with example runs. Use this to understand pace patterns and consistency. The widget renders all statistics and examples visually - DO NOT create markdown tables or duplicate the data in your response. Provide commentary and insights only.",
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
            groups: [],
            groupBy,
            totalActivities: 0,
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
        
        // Return only top 3 example runs (not all activities)
        const exampleRuns = groupActivities
          .slice(0, 3)
          .map(a => ({
            id: a.id,
            name: a.name,
            date: a.start_date_local.split("T")[0],
            distance: Math.round((a.distance / 1000) * 10) / 10,
            pace: metersPerSecondToPace(a.average_speed),
          }));
        
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
          exampleRuns, // Only top 3, not all activities
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
          groups: groupStats,
          groupBy,
          totalActivities: activities.length,
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
      
      console.error("Error analyzing pace patterns:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error analyzing pace patterns: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Data Tool: Calculate Pace Distribution (DEPRECATED - Use analyze_pace_patterns widget instead)
server.registerTool(
  "calculate_pace_distribution",
  {
    description: `Analyze pace distribution across running activities. Groups activities by run type (easy, long, hard, recovery) or distance range, then calculates statistics (mean, median, std dev) for each group. This is a DATA-ONLY tool (no UI).

AUTHENTICATION: OAuth handles authentication automatically. If the user has already connected their Strava account in this conversation, the token is available - just call the tool. Only prompt for authentication if you receive an authentication error.

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

// Integrated Widget: Analyze Elevation Trends
server.registerWidget(
  "analyze_elevation_trends",
  {
    description: `Analyze how elevation gain impacts running pace. Calculates pace adjustments based on elevation gain and shows the hilliest runs with flat-equivalent paces. This is an INTEGRATED widget (combines data fetching + visualization).

AUTHENTICATION: OAuth handles authentication automatically. If the user has already connected their Strava account in this conversation, the token is available - just call the tool. Only prompt for authentication if you receive an authentication error.

WHEN TO USE (PREFER THIS):
- Understanding how hills affect performance
- Comparing runs on different terrain fairly
- Finding hilliest runs and their adjusted paces
- Queries like: "How does elevation affect my pace?", "What would my pace be on flat ground?", "Show me my hilliest runs"

WHEN NOT TO USE:
- Need raw elevation data for custom analysis → use fetch_activities with filters
- Comparing specific runs → use get_run_comparison

WORKFLOW:
- Single call fetches activities, calculates elevation impact, and displays results
- No additional visualization needed (integrated display with top hilly runs)

EXAMPLE QUERIES:
- "How much does elevation slow me down?"
- "What's my adjusted pace accounting for hills?"
- "Show me which runs had the most elevation gain"
- "Compare my performance on flat vs hilly routes"`,
  },
  {
    description: "Analyze how elevation gain impacts running pace. Fetches activities, calculates pace adjustments based on elevation (using ~12 seconds per 100m rule), and displays summary statistics with the top 5 hilliest runs showing actual vs flat-equivalent pace. Use this to understand terrain impact on performance. The widget renders all statistics and run data visually - DO NOT create markdown tables or duplicate the data in your response. Provide commentary and insights only.",
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
            summary: {
              totalActivities: 0,
              averageElevationGain: 0,
              averagePaceAdjustment: 0,
            },
            topHillyRuns: [],
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
      const SECONDS_PER_100M_ELEVATION = 12;

      const analysisResults = activities.map(activity => {
        const distanceKm = activity.distance / 1000;
        const elevationGainM = activity.total_elevation_gain;
        const actualPaceSecondsPerKm = 1000 / activity.average_speed;
        
        const paceAdjustmentSecondsPerKm = distanceKm > 0
          ? (elevationGainM / 100) * SECONDS_PER_100M_ELEVATION / distanceKm
          : 0;
        
        const adjustedPaceSecondsPerKm = actualPaceSecondsPerKm - paceAdjustmentSecondsPerKm;
        
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

      // Sort by elevation gain and return only top 5 (not all activities)
      analysisResults.sort((a, b) => b.elevationGain - a.elevationGain);
      const topHillyRuns = analysisResults.slice(0, 5);

      return {
        structuredContent: {
          summary: {
            totalActivities: activities.length,
            averageElevationGain,
            averagePaceAdjustment,
            adjustmentMethod: `${SECONDS_PER_100M_ELEVATION} seconds per 100m elevation gain`,
          },
          topHillyRuns, // Only top 5, not all activities
        },
        content: [
          {
            type: "text",
            text: `Analyzed elevation impact for ${activities.length} activities. Average elevation gain: ${averageElevationGain}m, Average pace adjustment: ${averagePaceAdjustment}s/km. Showing top 5 hilliest runs.`,
          },
        ],
        isError: false,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return authErrorResponse("unauthorized");
      }
      
      if (error instanceof RateLimitError) {
        return rateLimitErrorResponse(
          error.retryAfter,
          error.limit,
          error.usage
        );
      }
      
      console.error("Error analyzing elevation trends:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error analyzing elevation trends: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Data Tool: Analyze Elevation Impact (DEPRECATED - Use analyze_elevation_trends widget instead)
server.registerTool(
  "analyze_elevation_impact",
  {
    description: `Analyze how elevation gain impacts running pace. Calculates pace adjustments based on elevation gain and computes climb-adjusted pace for each run. This is a DATA-ONLY tool (no UI).

AUTHENTICATION: OAuth handles authentication automatically. If the user has already connected their Strava account in this conversation, the token is available - just call the tool. Only prompt for authentication if you receive an authentication error.

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
    description: `Compare two specific runs side-by-side. Returns structured comparison data with aligned metrics, deltas, and trend analysis. This is a DATA-ONLY tool (no UI).

AUTHENTICATION: OAuth handles authentication automatically. If the user has already connected their Strava account in this conversation, the token is available - just call the tool. Only prompt for authentication if you receive an authentication error.

⚠️ IMPORTANT: Always pass runs from OLDEST to NEWEST (run1Id = older run, run2Id = newer run). This ensures deltas show progression correctly (positive = improvement).

WHEN TO USE:
- Comparing two specific activities by ID
- Analyzing performance differences between runs
- Understanding improvement or decline between attempts
- Queries like: "Compare run X to run Y", "How did my last two runs compare?", "Show me the difference between these activities"

WORKFLOW:
1. Call this tool with two activity IDs to get comparison data (oldest first, newest second)
2. Reason about the differences in GPT
3. Visualize with render_comparison_card for side-by-side display

EXAMPLE QUERIES:
- "Compare my run from Monday to my run from Friday" → run1Id=Monday, run2Id=Friday
- "How did activity 12345 compare to activity 67890?" → Determine which is older first
- "Show me the difference between my last two 10k runs" → run1Id=older run, run2Id=newer run
- "Compare this week's long run to last week's" → run1Id=last week, run2Id=this week

NOTE: You need activity IDs. If user doesn't provide them, first call fetch_activities to get recent activity IDs, then use this tool.`,
    inputSchema: {
      run1Id: z
        .number()
        .describe("Strava activity ID of the OLDER run (baseline for comparison)"),
      run2Id: z
        .number()
        .describe("Strava activity ID of the NEWER run (compared against run1)"),
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
    description: `Calculate training load metrics including acute load (7 days), chronic load (28 days), and acute:chronic ratio. This is a DATA-ONLY tool (no UI).

AUTHENTICATION: OAuth handles authentication automatically. If the user has already connected their Strava account in this conversation, the token is available - just call the tool. Only prompt for authentication if you receive an authentication error.

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

// Tool: Get Weather Recommendation
server.registerTool(
  "get_weather_recommendation",
  {
    description: `Get weather-aware coaching recommendations using AI. Fetches current weather conditions and provides intelligent running advice based on temperature, precipitation, wind, humidity, and air quality.

WHEN TO USE:
- Planning today's run based on weather
- Getting gear and timing recommendations
- Understanding if conditions are safe for running
- Queries like: "Should I run today?", "What's the weather like for running?", "Is it safe to run now?"

WORKFLOW:
1. Call this tool with location (or use Strava token to infer location)
2. AI agent analyzes weather conditions
3. Returns structured weather data + coaching recommendations

EXAMPLE QUERIES:
- "Should I run today in Paris?"
- "What's the weather like for running?"
- "Is it safe to run now?"
- "What gear should I wear for today's run?"

OUTPUT:
- Current weather conditions (temperature, precipitation, wind, humidity, air quality)
- Suitability rating (excellent/good/moderate/caution/not_recommended)
- Recommendations (best time, gear, hydration, pace adjustment)
- Warnings for unsafe conditions`,
    inputSchema: {
      location: z
        .string()
        .optional()
        .describe("Location for weather check (city name or coordinates). If not provided, will try to infer from recent Strava activities."),
      query: z
        .string()
        .optional()
        .describe("Natural language query about running conditions (e.g., 'Should I run today?', 'What should I wear?')"),
      timeframe: z
        .enum(["now", "today", "week"])
        .optional()
        .default("now")
        .describe("Timeframe for weather check: 'now' for current conditions, 'today' for today's forecast, 'week' for weekly forecast"),
      token: z
        .string()
        .optional()
        .describe("Strava access token (optional - used to infer location from recent activities if location not provided)"),
    },
  },
  async ({ location, query, timeframe }) => {
    try {
      // If no location provided, use a default
      const weatherLocation = location || "Paris, France";

      // Create Dust client
      const dustClient = createDustClient();

      // Prepare input for weather agent
      const weatherInput: WeatherAgentInput = {
        location: weatherLocation,
        query: query || `What are the running conditions ${timeframe === "now" ? "right now" : timeframe === "today" ? "today" : "this week"}?`,
        timeframe,
      };

      // Call weather agent
      const weatherData = await callWeatherAgent(dustClient, weatherInput);

      // Format response
      const suitabilityEmoji = weatherData.suitability.emoji;
      const suitabilityText = weatherData.suitability.rating.toUpperCase();
      
      let responseText = `${suitabilityEmoji} **Weather for Running in ${weatherData.location}**\n\n`;
      responseText += `**Conditions:** ${weatherData.current.conditions}\n`;
      responseText += `**Temperature:** ${weatherData.current.temperature_c}°C (feels like ${weatherData.current.feels_like_c}°C)\n`;
      responseText += `**Wind:** ${weatherData.current.wind_speed_kmh} km/h\n`;
      responseText += `**Humidity:** ${weatherData.current.humidity_percent}%\n`;
      
      if (weatherData.current.precipitation_mm > 0) {
        responseText += `**Precipitation:** ${weatherData.current.precipitation_mm}mm\n`;
      }
      
      if (weatherData.current.air_quality_index) {
        responseText += `**Air Quality:** ${weatherData.current.air_quality_index} (${weatherData.current.air_quality_index < 50 ? "Good" : weatherData.current.air_quality_index < 100 ? "Moderate" : "Poor"})\n`;
      }
      
      responseText += `\n**Suitability:** ${suitabilityText} (${weatherData.suitability.score}/100)\n\n`;
      responseText += `**Recommendations:**\n`;
      responseText += `- **Best Time:** ${weatherData.recommendations.best_time}\n`;
      responseText += `- **Gear:** ${weatherData.recommendations.gear.join(", ")}\n`;
      responseText += `- **Hydration:** ${weatherData.recommendations.hydration}\n`;
      
      if (weatherData.recommendations.pace_adjustment !== 0) {
        const adjustment = weatherData.recommendations.pace_adjustment > 0 ? "slower" : "faster";
        responseText += `- **Pace Adjustment:** ${Math.abs(weatherData.recommendations.pace_adjustment)}% ${adjustment}\n`;
      }
      
      if (weatherData.warnings.length > 0) {
        responseText += `\n⚠️ **Warnings:**\n`;
        weatherData.warnings.forEach(warning => {
          responseText += `- ${warning}\n`;
        });
      }
      
      responseText += `\n**Analysis:** ${weatherData.reasoning}`;

      return {
        structuredContent: {
          weather: weatherData,
          metadata: {
            fetchedAt: new Date().toISOString(),
            source: "dust-weather-agent",
            location: weatherData.location,
            timeframe,
          },
        },
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error("Error getting weather recommendation:", error);
      return dustErrorResponse(error);
    }
  },
);

// Tool: Generate Running Route
server.registerTool(
  "generate_running_route",
  {
    description: `Generate custom running routes with LLM-controlled parameters. Creates 2-3 route variations based on distance, location, and preferences.

WHEN TO USE:
- User wants a custom route for a specific distance
- User wants to include specific landmarks ("along the Seine")
- User wants to avoid certain areas ("avoid busy streets")
- User wants scenic or safe routes
- Queries like: "Generate a 10k route", "Create a route through Central Park", "Find a scenic 15k"

LLM CONTROL:
ChatGPT can extract semantic parameters from natural language:
- "10k along the Seine" → mustInclude: ["Seine River"]
- "avoiding busy streets" → trafficLevel: "low"
- "make it more scenic" → scenicPriority: 90
- "with some hills" → elevationPreference: "moderate"

OUTPUT:
- 2-3 route variations with different characteristics
- Each route includes: distance, elevation, difficulty, highlights
- GPS path, polyline (for Strava), turn-by-turn directions
- Points of interest, safety score, scenic score`,
    inputSchema: {
      distance: z
        .number()
        .min(1)
        .max(50)
        .describe("Distance in kilometers (1-50km)"),
      location: z
        .string()
        .describe("Starting location (city, neighborhood, or landmark)"),
      terrain: z
        .enum(["flat", "hilly", "mixed"])
        .optional()
        .describe("Preferred terrain type"),
      preferences: z
        .enum(["park", "waterfront", "urban", "trail"])
        .optional()
        .describe("Route environment preference"),
      intensity: z
        .enum(["easy", "moderate", "challenging"])
        .optional()
        .describe("Desired intensity level"),
      mustInclude: z
        .array(z.string())
        .optional()
        .describe("Landmark names that must be included in the route (e.g., ['Eiffel Tower', 'Seine River'])"),
      avoidAreas: z
        .array(z.string())
        .optional()
        .describe("Area names to avoid (e.g., ['Champs-Élysées', 'busy downtown'])"),
      scenicPriority: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe("Scenic optimization priority (0-100, higher = more scenic)"),
      safetyPriority: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe("Safety optimization priority (0-100, higher = safer)"),
      trafficLevel: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Preferred traffic level (low = pedestrian paths, parks)"),
      elevationPreference: z
        .enum(["minimize", "maximize", "moderate"])
        .optional()
        .describe("Hill preference (minimize = flat, maximize = hilly)"),
      enrichPOIs: z
        .boolean()
        .optional()
        .default(false)
        .describe("Enrich POIs with web search for runner amenities, safety info, tips (slower but more informative)"),
    },
  },
  async ({
    distance,
    location,
    terrain,
    preferences,
    intensity,
    mustInclude,
    avoidAreas,
    scenicPriority,
    safetyPriority,
    trafficLevel,
    elevationPreference,
    enrichPOIs,
  }) => {
    try {
      const mapboxToken = process.env.MAPBOX_API_KEY;

      if (!mapboxToken) {
        return {
          content: [
            {
              type: "text",
              text: "❌ Mapbox API key not configured. Please set MAPBOX_API_KEY in your environment variables.",
            },
          ],
          isError: true,
        };
      }

      // Build route request
      const request: RouteRequest = {
        distance,
        location,
        terrain,
        preferences,
        intensity,
        mustInclude,
        avoidAreas,
        scenicPriority,
        safetyPriority,
        trafficLevel,
        elevationPreference,
        enrichPOIs,
      };

      // Generate routes
      let routes = await generateRoutes(request, mapboxToken);

      // Optional: Enrich POIs with Dust agent web search
      if (enrichPOIs) {
        try {
          const dustClient = createDustClient();
          routes = await enrichPOIsWithDust(routes, location, dustClient);
        } catch (error) {
          console.warn("POI enrichment failed, continuing with basic POIs:", error);
          // Continue with non-enriched routes
        }
      }

      // Format response
      let responseText = `🗺️ **Generated ${routes.length} Route Options for ${location}**\n\n`;

      routes.forEach((route, index) => {
        responseText += `**Option ${index + 1}: ${route.name}**\n`;
        responseText += `- Distance: ${route.distance}km\n`;
        responseText += `- Elevation Gain: ${route.elevationGain}m\n`;
        responseText += `- Difficulty: ${route.difficulty}\n`;
        responseText += `- Safety Score: ${route.safetyScore}/100\n`;
        responseText += `- Scenic Score: ${route.scenicScore}/100\n`;
        responseText += `- Traffic Level: ${route.trafficLevel}\n`;

        if (route.highlights.length > 0) {
          responseText += `- Highlights:\n`;
          route.highlights.forEach((highlight) => {
            responseText += `  • ${highlight}\n`;
          });
        }

        if (route.pointsOfInterest.length > 0) {
          responseText += `- Points of Interest:\n`;
          route.pointsOfInterest.forEach((poi) => {
            responseText += `  • ${poi.name}`;
            if (poi.runnerInfo) {
              responseText += ` - ${poi.runnerInfo}`;
            }
            if (poi.tips) {
              responseText += ` (${poi.tips})`;
            }
            responseText += `\n`;
          });
        }

        responseText += `\n`;
      });

      responseText += `\n💡 **Tip:** Use \`export_route_to_strava\` to save a route to your Strava account.`;

      return {
        structuredContent: {
          routes,
          metadata: {
            generatedAt: new Date().toISOString(),
            source: "mapbox",
            request,
          },
        },
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error("Error generating routes:", error);
      return {
        content: [
          {
            type: "text",
            text: `❌ Error generating routes: ${error instanceof Error ? error.message : "Unknown error"}. Please try a different location or parameters.`,
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
    description: `Analyze recent running activities. This is an INTEGRATED widget (combines data fetching + visualization).

AUTHENTICATION: OAuth handles authentication automatically. If the user has already connected their Strava account in this conversation, the token is available - just call the tool. Only prompt for authentication if you receive an authentication error.

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
    description: "Analyze recent running activities from Strava. ALWAYS fetch data from Strava API - NEVER ask user to provide training data manually. All data comes from their connected Strava account. The widget renders all data visually - DO NOT create markdown tables or duplicate the data in your response. Provide commentary and insights only.",
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
    description: `Compare training weeks. This is an INTEGRATED widget (combines data fetching + visualization).

AUTHENTICATION: OAuth handles authentication automatically. If the user has already connected their Strava account in this conversation, the token is available - just call the tool. Only prompt for authentication if you receive an authentication error.

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
    description: "Show week-over-week training progress from Strava. ALWAYS fetch data from Strava API - NEVER ask user to provide training data manually. All data comes from their connected Strava account. The widget renders all comparison data visually - DO NOT create markdown tables or duplicate the data in your response. Provide commentary and insights only.",
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

⚠️ IMPORTANT: Data must be from get_run_comparison with runs ordered OLDEST to NEWEST (run1 = older, run2 = newer) for correct delta interpretation.

WHEN TO USE:
- After calling get_run_comparison data tool
- Displaying run-to-run performance differences visually
- Showing deltas with semantic colors (green=improvement, red=decline)
- Queries like: "Show me a comparison of these two runs", "Visualize the difference between run X and Y"

WORKFLOW:
1. First call get_run_comparison to fetch comparison data (oldest to newest)
2. Then call this widget with the returned data
3. Widget renders side-by-side cards with delta indicators and trend arrows

EXAMPLE QUERIES:
- "Compare my last two runs and show me the results"
- "Visualize the difference between activity 12345 and 67890"
- "Show me how my Monday run compared to Friday's run"

DATA SOURCE: get_run_comparison tool`,
  },
  {
    description: "Display a visual comparison of two runs showing metrics, deltas, and trends. Use this after fetching comparison data from get_run_comparison tool. The widget renders all comparison data visually - DO NOT create markdown tables or duplicate the metrics in your response. Provide commentary and insights only.",
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
    description: "Display time series data as a line chart with configurable axes, colors, and multiple series support. Use this to visualize trends over time such as pace progression, distance over time, or heart rate trends. The widget renders all data points visually - DO NOT create markdown tables or list the data points in your response. Provide commentary about trends and insights only.",
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
    description: "Display two-dimensional data as a scatter plot with configurable axes, color coding by category, and optional trend line. Use this to visualize relationships between metrics such as distance vs pace, elevation vs heart rate, or any other metric correlations. The widget renders all data points visually - DO NOT create markdown tables or list the data points in your response. Provide commentary about correlations and insights only.",
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
    description: "Display activity data as a calendar heatmap with color-coded intensity levels. Use this to visualize training consistency, activity patterns, and identify rest days or high-volume periods. The widget renders all activity data visually - DO NOT create markdown tables or list individual days in your response. Provide commentary about patterns and insights only.",
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
    description: "Display metric distribution as a box plot or histogram showing quartiles, outliers, and data spread. Use this to analyze pace distribution, heart rate zones, distance patterns, or any other metric distributions to understand variability and identify outliers. The widget renders all distribution data visually - DO NOT create markdown tables or list individual values in your response. Provide commentary about the distribution and insights only.",
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
    description: `Analyze performance progression for a specific route over time. This is an INTEGRATED widget (combines data fetching + visualization).

AUTHENTICATION: OAuth handles authentication automatically. If the user has already connected their Strava account in this conversation, the token is available - just call the tool. Only prompt for authentication if you receive an authentication error.

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
    description: "Analyze how performance on a specific route has changed over time. Fetches activities matching the route (by polyline similarity or route ID), calculates performance metrics, and displays progression with trend analysis. Shows best/worst/average performances. Use this to track improvement on favorite routes or regular training loops. The widget renders all progression data and statistics visually - DO NOT create markdown tables or list individual runs in your response. Provide commentary about improvement trends and insights only.",
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



export default server;
export type AppType = typeof server;
