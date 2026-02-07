import { describe, it, expect } from "vitest";
import {
  RateLimitError,
  MissingDataError,
  isRateLimitError,
  extractRateLimitInfo,
  rateLimitErrorResponse,
  validateActivityData,
  checkOptionalData,
} from "./errors";

describe("Error Handling", () => {
  describe("RateLimitError", () => {
    it("should create rate limit error with metadata", () => {
      const error = new RateLimitError("Rate limit exceeded", 900, 100, 95);
      
      expect(error.name).toBe("RateLimitError");
      expect(error.message).toBe("Rate limit exceeded");
      expect(error.retryAfter).toBe(900);
      expect(error.limit).toBe(100);
      expect(error.usage).toBe(95);
    });
  });

  describe("MissingDataError", () => {
    it("should create missing data error with field list", () => {
      const error = new MissingDataError("Missing fields", ["heartRate", "gps"]);
      
      expect(error.name).toBe("MissingDataError");
      expect(error.message).toBe("Missing fields");
      expect(error.missingFields).toEqual(["heartRate", "gps"]);
    });
  });

  describe("isRateLimitError", () => {
    it("should detect 429 status code", () => {
      const response = new Response(null, { status: 429 });
      expect(isRateLimitError(response)).toBe(true);
    });

    it("should return false for non-429 status", () => {
      const response = new Response(null, { status: 200 });
      expect(isRateLimitError(response)).toBe(false);
    });
  });

  describe("extractRateLimitInfo", () => {
    it("should extract rate limit headers", () => {
      const headers = new Headers({
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Usage": "95",
        "Retry-After": "900",
      });
      const response = new Response(null, { headers });
      
      const info = extractRateLimitInfo(response);
      
      expect(info.limit).toBe(100);
      expect(info.usage).toBe(95);
      expect(info.retryAfter).toBe(900);
    });

    it("should handle missing headers", () => {
      const response = new Response(null);
      
      const info = extractRateLimitInfo(response);
      
      expect(info.limit).toBeUndefined();
      expect(info.usage).toBeUndefined();
      expect(info.retryAfter).toBeUndefined();
    });
  });

  describe("rateLimitErrorResponse", () => {
    it("should create structured rate limit response", () => {
      const response = rateLimitErrorResponse(900, 100, 95);
      
      expect(response.isError).toBe(true);
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe("text");
      expect(response.content[0].text).toContain("Rate Limit Exceeded");
      expect(response.content[0].text).toContain("95/100");
      expect(response._meta?.rateLimitError).toBeDefined();
      expect(response._meta?.rateLimitError?.usagePercent).toBe(95);
    });

    it("should handle missing metadata", () => {
      const response = rateLimitErrorResponse();
      
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain("Rate Limit Exceeded");
    });
  });

  describe("validateActivityData", () => {
    it("should validate activity with all required fields", () => {
      const activity = {
        distance: 5000,
        moving_time: 1800,
        total_elevation_gain: 100,
      };
      
      const result = validateActivityData(activity, [
        "distance",
        "moving_time",
        "total_elevation_gain",
      ]);
      
      expect(result.valid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
    });

    it("should detect missing required fields", () => {
      const activity = {
        distance: 5000,
        // missing moving_time and total_elevation_gain
      };
      
      const result = validateActivityData(activity, [
        "distance",
        "moving_time",
        "total_elevation_gain",
      ]);
      
      expect(result.valid).toBe(false);
      expect(result.missingFields).toEqual(["moving_time", "total_elevation_gain"]);
    });
  });

  describe("checkOptionalData", () => {
    it("should identify available and missing optional fields", () => {
      const activity = {
        distance: 5000,
        average_heartrate: 150,
        // missing max_heartrate and splits_metric
      };
      
      const result = checkOptionalData(activity, [
        "average_heartrate",
        "max_heartrate",
        "splits_metric",
      ]);
      
      expect(result.available).toEqual(["average_heartrate"]);
      expect(result.missing).toEqual(["max_heartrate", "splits_metric"]);
    });

    it("should handle all fields missing", () => {
      const activity = {
        distance: 5000,
      };
      
      const result = checkOptionalData(activity, [
        "average_heartrate",
        "max_heartrate",
      ]);
      
      expect(result.available).toHaveLength(0);
      expect(result.missing).toEqual(["average_heartrate", "max_heartrate"]);
    });

    it("should handle all fields present", () => {
      const activity = {
        average_heartrate: 150,
        max_heartrate: 180,
      };
      
      const result = checkOptionalData(activity, [
        "average_heartrate",
        "max_heartrate",
      ]);
      
      expect(result.available).toEqual(["average_heartrate", "max_heartrate"]);
      expect(result.missing).toHaveLength(0);
    });
  });
});
