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
}

export interface ActivitySummary {
  date: string;
  distance: number; // km
  pace: string; // min:sec per km
  duration: number; // minutes
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

  if (!res.ok) {
    throw new Error(`Strava API error: ${res.status} ${res.statusText}`);
  }

  const activities = await res.json();

  // Filter for running activities only
  return activities.filter((a: StravaActivity) => a.type === "Run");
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
