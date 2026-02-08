/**
 * Strava activity upload utilities
 */

import { UnauthorizedError, RateLimitError } from "./strava.js";

export interface StravaActivityUpload {
  name: string;
  description?: string;
  type: "Run";
  sport_type?: "Run";
  data_type: "gpx";
  file: string; // GPX file content
  external_id?: string;
}

export interface StravaUploadResponse {
  id: number;
  id_str: string;
  external_id: string;
  error: string | null;
  status: string;
  activity_id: number | null;
}

export interface StravaActivityResponse {
  id: number;
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  type: string;
  start_date: string;
}

/**
 * Upload GPX file to Strava and create a planned activity
 */
export async function uploadGPXToStrava(
  accessToken: string,
  gpxContent: string,
  activityName: string,
  description?: string
): Promise<StravaUploadResponse> {
  // Create form data for file upload
  const formData = new FormData();
  
  // Create a Blob from the GPX content
  const gpxBlob = new Blob([gpxContent], { type: "application/gpx+xml" });
  formData.append("file", gpxBlob, "route.gpx");
  formData.append("name", activityName);
  formData.append("data_type", "gpx");
  formData.append("activity_type", "Run");
  
  if (description) {
    formData.append("description", description);
  }

  const response = await fetch("https://www.strava.com/api/v3/uploads", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  // Handle errors
  if (response.status === 401) {
    throw new UnauthorizedError(
      "Strava API returned 401 Unauthorized - token is invalid or expired"
    );
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const limit = response.headers.get("X-RateLimit-Limit");
    const usage = response.headers.get("X-RateLimit-Usage");

    throw new RateLimitError(
      "Strava API rate limit exceeded",
      retryAfter ? parseInt(retryAfter, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      usage ? parseInt(usage, 10) : undefined
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Strava upload failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const uploadResponse: StravaUploadResponse = await response.json();

  // Check for upload errors
  if (uploadResponse.error) {
    throw new Error(`Strava upload error: ${uploadResponse.error}`);
  }

  return uploadResponse;
}

/**
 * Check upload status and wait for processing
 */
export async function checkUploadStatus(
  accessToken: string,
  uploadId: number,
  maxAttempts: number = 10,
  delayMs: number = 2000
): Promise<StravaUploadResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(
      `https://www.strava.com/api/v3/uploads/${uploadId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (response.status === 401) {
      throw new UnauthorizedError(
        "Strava API returned 401 Unauthorized - token is invalid or expired"
      );
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const limit = response.headers.get("X-RateLimit-Limit");
      const usage = response.headers.get("X-RateLimit-Usage");

      throw new RateLimitError(
        "Strava API rate limit exceeded",
        retryAfter ? parseInt(retryAfter, 10) : undefined,
        limit ? parseInt(limit, 10) : undefined,
        usage ? parseInt(usage, 10) : undefined
      );
    }

    if (!response.ok) {
      throw new Error(`Failed to check upload status: ${response.status}`);
    }

    const status: StravaUploadResponse = await response.json();

    // Check if processing is complete
    if (status.activity_id) {
      return status;
    }

    // Check for errors
    if (status.error) {
      throw new Error(`Upload processing error: ${status.error}`);
    }

    // Wait before next attempt
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    "Upload processing timeout - activity may still be processing on Strava"
  );
}

/**
 * Get activity details by ID
 */
export async function getStravaActivity(
  accessToken: string,
  activityId: number
): Promise<StravaActivityResponse> {
  const response = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (response.status === 401) {
    throw new UnauthorizedError(
      "Strava API returned 401 Unauthorized - token is invalid or expired"
    );
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const limit = response.headers.get("X-RateLimit-Limit");
    const usage = response.headers.get("X-RateLimit-Usage");

    throw new RateLimitError(
      "Strava API rate limit exceeded",
      retryAfter ? parseInt(retryAfter, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
      usage ? parseInt(usage, 10) : undefined
    );
  }

  if (!response.ok) {
    throw new Error(`Failed to get activity: ${response.status}`);
  }

  return await response.json();
}

/**
 * Generate Strava activity URL
 */
export function getStravaActivityURL(activityId: number): string {
  return `https://www.strava.com/activities/${activityId}`;
}
