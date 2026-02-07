/**
 * Tests for caching mechanism
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateCacheKey,
  getCachedActivities,
  setCachedActivities,
  clearCache,
  getCacheStats,
  type CacheKey,
} from "./cache.js";
import type { StravaActivity } from "./strava.js";

describe("Cache mechanism", () => {
  beforeEach(() => {
    // Clear cache before each test
    clearCache();
  });

  describe("generateCacheKey", () => {
    it("should generate consistent cache keys", () => {
      const key: CacheKey = {
        userId: "user123",
        days: 7,
        includeDetails: false,
      };

      const cacheKey1 = generateCacheKey(key);
      const cacheKey2 = generateCacheKey(key);

      expect(cacheKey1).toBe(cacheKey2);
      expect(cacheKey1).toBe("user123:7:false");
    });

    it("should generate different keys for different parameters", () => {
      const key1: CacheKey = {
        userId: "user123",
        days: 7,
        includeDetails: false,
      };

      const key2: CacheKey = {
        userId: "user123",
        days: 14,
        includeDetails: false,
      };

      const key3: CacheKey = {
        userId: "user123",
        days: 7,
        includeDetails: true,
      };

      expect(generateCacheKey(key1)).not.toBe(generateCacheKey(key2));
      expect(generateCacheKey(key1)).not.toBe(generateCacheKey(key3));
      expect(generateCacheKey(key2)).not.toBe(generateCacheKey(key3));
    });
  });

  describe("getCachedActivities and setCachedActivities", () => {
    it("should return null for cache miss", () => {
      const key: CacheKey = {
        userId: "user123",
        days: 7,
        includeDetails: false,
      };

      const result = getCachedActivities(key);
      expect(result).toBeNull();
    });

    it("should store and retrieve cached activities", () => {
      const key: CacheKey = {
        userId: "user123",
        days: 7,
        includeDetails: false,
      };

      const activities: StravaActivity[] = [
        {
          id: 1,
          name: "Morning Run",
          distance: 5000,
          moving_time: 1500,
          elapsed_time: 1600,
          total_elevation_gain: 50,
          type: "Run",
          start_date: "2024-01-01T08:00:00Z",
          start_date_local: "2024-01-01T08:00:00",
          average_speed: 3.33,
        },
      ];

      setCachedActivities(key, activities);
      const cached = getCachedActivities(key);

      expect(cached).not.toBeNull();
      expect(cached?.data).toEqual(activities);
      expect(cached?.metadata.days).toBe(7);
      expect(cached?.metadata.includeDetails).toBe(false);
      expect(cached?.metadata.count).toBe(1);
    });

    it("should maintain separate caches for different keys", () => {
      const key1: CacheKey = {
        userId: "user123",
        days: 7,
        includeDetails: false,
      };

      const key2: CacheKey = {
        userId: "user123",
        days: 14,
        includeDetails: false,
      };

      const activities1: StravaActivity[] = [
        {
          id: 1,
          name: "Run 1",
          distance: 5000,
          moving_time: 1500,
          elapsed_time: 1600,
          total_elevation_gain: 50,
          type: "Run",
          start_date: "2024-01-01T08:00:00Z",
          start_date_local: "2024-01-01T08:00:00",
          average_speed: 3.33,
        },
      ];

      const activities2: StravaActivity[] = [
        {
          id: 2,
          name: "Run 2",
          distance: 10000,
          moving_time: 3000,
          elapsed_time: 3100,
          total_elevation_gain: 100,
          type: "Run",
          start_date: "2024-01-02T08:00:00Z",
          start_date_local: "2024-01-02T08:00:00",
          average_speed: 3.33,
        },
      ];

      setCachedActivities(key1, activities1);
      setCachedActivities(key2, activities2);

      const cached1 = getCachedActivities(key1);
      const cached2 = getCachedActivities(key2);

      expect(cached1?.data).toEqual(activities1);
      expect(cached2?.data).toEqual(activities2);
      expect(cached1?.metadata.days).toBe(7);
      expect(cached2?.metadata.days).toBe(14);
    });
  });

  describe("clearCache", () => {
    it("should clear all cache when no userId provided", () => {
      const key1: CacheKey = {
        userId: "user123",
        days: 7,
        includeDetails: false,
      };

      const key2: CacheKey = {
        userId: "user456",
        days: 7,
        includeDetails: false,
      };

      const activities: StravaActivity[] = [
        {
          id: 1,
          name: "Run",
          distance: 5000,
          moving_time: 1500,
          elapsed_time: 1600,
          total_elevation_gain: 50,
          type: "Run",
          start_date: "2024-01-01T08:00:00Z",
          start_date_local: "2024-01-01T08:00:00",
          average_speed: 3.33,
        },
      ];

      setCachedActivities(key1, activities);
      setCachedActivities(key2, activities);

      expect(getCacheStats().size).toBe(2);

      clearCache();

      expect(getCacheStats().size).toBe(0);
      expect(getCachedActivities(key1)).toBeNull();
      expect(getCachedActivities(key2)).toBeNull();
    });

    it("should clear only specific user cache when userId provided", () => {
      const key1: CacheKey = {
        userId: "user123",
        days: 7,
        includeDetails: false,
      };

      const key2: CacheKey = {
        userId: "user456",
        days: 7,
        includeDetails: false,
      };

      const activities: StravaActivity[] = [
        {
          id: 1,
          name: "Run",
          distance: 5000,
          moving_time: 1500,
          elapsed_time: 1600,
          total_elevation_gain: 50,
          type: "Run",
          start_date: "2024-01-01T08:00:00Z",
          start_date_local: "2024-01-01T08:00:00",
          average_speed: 3.33,
        },
      ];

      setCachedActivities(key1, activities);
      setCachedActivities(key2, activities);

      expect(getCacheStats().size).toBe(2);

      clearCache("user123");

      expect(getCacheStats().size).toBe(1);
      expect(getCachedActivities(key1)).toBeNull();
      expect(getCachedActivities(key2)).not.toBeNull();
    });
  });

  describe("getCacheStats", () => {
    it("should return correct cache statistics", () => {
      const key1: CacheKey = {
        userId: "user123",
        days: 7,
        includeDetails: false,
      };

      const key2: CacheKey = {
        userId: "user123",
        days: 14,
        includeDetails: true,
      };

      const activities: StravaActivity[] = [
        {
          id: 1,
          name: "Run",
          distance: 5000,
          moving_time: 1500,
          elapsed_time: 1600,
          total_elevation_gain: 50,
          type: "Run",
          start_date: "2024-01-01T08:00:00Z",
          start_date_local: "2024-01-01T08:00:00",
          average_speed: 3.33,
        },
      ];

      setCachedActivities(key1, activities);
      setCachedActivities(key2, activities);

      const stats = getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.keys).toContain("user123:7:false");
      expect(stats.keys).toContain("user123:14:true");
    });
  });
});
