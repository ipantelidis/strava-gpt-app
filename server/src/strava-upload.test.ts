/**
 * Tests for Strava upload utilities
 */

import { describe, it, expect } from "vitest";
import { getStravaActivityURL } from "./strava-upload.js";

describe("Strava Upload Utilities", () => {
  it("should generate correct Strava activity URL", () => {
    const activityId = 12345678;
    const url = getStravaActivityURL(activityId);

    expect(url).toBe("https://www.strava.com/activities/12345678");
  });

  it("should handle large activity IDs", () => {
    const activityId = 9876543210;
    const url = getStravaActivityURL(activityId);

    expect(url).toBe("https://www.strava.com/activities/9876543210");
  });
});

// Note: uploadGPXToStrava, checkUploadStatus, and getStravaActivity
// require actual Strava API calls and valid tokens, so they are tested
// via integration tests or manual testing with real credentials.
