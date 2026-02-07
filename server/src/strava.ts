/**
 * Strava API client utilities
 */

export interface StravaActivity {
  id: number;
  name: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // meters
  type: string;
  start_date: string; // ISO 8601
  start_date_local: string;
  average_speed: number; // meters per second
  average_heartrate?: number;
  max_heartrate?: number;
  splits_metric?: Split[];
  map?: {
    summary_polyline: string;
  };
}

export interface Split {
  distance: number; // meters
  elapsed_time: number; // seconds
  moving_time: number; // seconds
  average_speed: number; // meters per second
  average_heartrate?: number;
}

export interface ActivitySummary {
  date: string;
  distance: number; // km
  pace: string; // min:sec per km
  duration: number; // minutes
}

/**
 * Custom error class for 401 Unauthorized responses
 */
export class UnauthorizedError extends Error {
  constructor(message: string = "Strava API returned 401 Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Custom error class for 429 Rate Limit responses
 */
export class RateLimitError extends Error {
  public retryAfter?: number;
  public limit?: number;
  public usage?: number;

  constructor(
    message: string = "Strava API rate limit exceeded",
    retryAfter?: number,
    limit?: number,
    usage?: number
  ) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    this.limit = limit;
    this.usage = usage;
  }
}

/**
 * Fetch recent activities from Strava
 */
export async function fetchRecentActivities(
  accessToken: string,
  afterTimestamp?: number,
  perPage: number = 30,
): Promise<StravaActivity[]> {
  const params = new URLSearchParams({
    per_page: perPage.toString(),
  });

  if (afterTimestamp) {
    params.append("after", afterTimestamp.toString());
  }

  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  // Detect 401 Unauthorized errors
  if (res.status === 401) {
    throw new UnauthorizedError("Strava API returned 401 Unauthorized - token is invalid or expired");
  }

  // Detect 429 Rate Limit errors
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    const limit = res.headers.get("X-RateLimit-Limit");
    const usage = res.headers.get("X-RateLimit-Usage");
    
    throw new RateLimitError(
      "Strava API rate limit exceeded",
      retryAfter ? parseInt(retryAfter, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      usage ? parseInt(usage, 10) : undefined
    );
  }

  if (!res.ok) {
    throw new Error(`Strava API error: ${res.status} ${res.statusText}`);
  }

  const activities = await res.json();

  // Filter for running activities only
  return activities.filter((a: StravaActivity) => a.type === "Run");
}

/**
 * Fetch detailed activity data including splits, HR, and GPS
 */
export async function fetchDetailedActivity(
  accessToken: string,
  activityId: number,
): Promise<StravaActivity> {
  const res = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  // Detect 401 Unauthorized errors
  if (res.status === 401) {
    throw new UnauthorizedError("Strava API returned 401 Unauthorized - token is invalid or expired");
  }

  // Detect 429 Rate Limit errors
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    const limit = res.headers.get("X-RateLimit-Limit");
    const usage = res.headers.get("X-RateLimit-Usage");
    
    throw new RateLimitError(
      "Strava API rate limit exceeded",
      retryAfter ? parseInt(retryAfter, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      usage ? parseInt(usage, 10) : undefined
    );
  }

  if (!res.ok) {
    throw new Error(`Strava API error: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Fetch activities with optional detailed data
 */
export async function fetchActivitiesWithDetails(
  accessToken: string,
  days: number,
  includeDetails: boolean = false,
): Promise<StravaActivity[]> {
  // Calculate timestamp for date range
  const afterTimestamp = Math.floor(Date.now() / 1000 - days * 24 * 60 * 60);

  // Fetch basic activities
  const activities = await fetchRecentActivities(accessToken, afterTimestamp);

  // If details requested, fetch full data for each activity
  if (includeDetails) {
    const detailedActivities = await Promise.all(
      activities.map(async (activity) => {
        try {
          return await fetchDetailedActivity(accessToken, activity.id);
        } catch (error) {
          // If detailed fetch fails, return basic activity
          console.error(`Failed to fetch details for activity ${activity.id}:`, error);
          return activity;
        }
      })
    );
    return detailedActivities;
  }

  return activities;
}

/**
 * Convert meters per second to min:sec per km pace
 */
export function metersPerSecondToPace(mps: number): string {
  if (mps === 0) return "0:00";

  const secondsPerKm = 1000 / mps;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Convert Strava activity to summary format
 */
export function activityToSummary(activity: StravaActivity): ActivitySummary {
  return {
    date: activity.start_date_local.split("T")[0],
    distance: Math.round((activity.distance / 1000) * 10) / 10, // km, 1 decimal
    pace: metersPerSecondToPace(activity.average_speed),
    duration: Math.round(activity.moving_time / 60), // minutes
  };
}

/**
 * Calculate average pace from multiple activities
 */
export function calculateAveragePace(activities: StravaActivity[]): string {
  if (activities.length === 0) return "0:00";

  const totalDistance = activities.reduce((sum, a) => sum + a.distance, 0);
  const totalTime = activities.reduce((sum, a) => sum + a.moving_time, 0);

  if (totalDistance === 0) return "0:00";

  const avgSpeed = totalDistance / totalTime; // meters per second
  return metersPerSecondToPace(avgSpeed);
}

/**
 * Get activities within a date range
 */
export function filterActivitiesByDateRange(
  activities: StravaActivity[],
  startDate: Date,
  endDate: Date,
): StravaActivity[] {
  return activities.filter((a) => {
    const activityDate = new Date(a.start_date_local);
    return activityDate >= startDate && activityDate <= endDate;
  });
}
