/**
 * Conversation-scoped caching for Strava activities
 */

import type { StravaActivity } from "./strava.js";

export interface CacheEntry {
  data: StravaActivity[];
  fetchedAt: string;
  metadata: {
    days: number;
    includeDetails: boolean;
    count: number;
  };
}

export interface CacheKey {
  userId: string;
  days: number;
  includeDetails: boolean;
}

/**
 * In-memory cache for conversation context
 * Key format: "userId:days:includeDetails"
 */
const activityCache = new Map<string, CacheEntry>();

/**
 * Generate cache key from parameters
 */
export function generateCacheKey(key: CacheKey): string {
  return `${key.userId}:${key.days}:${key.includeDetails}`;
}

/**
 * Get cached activities if available
 */
export function getCachedActivities(key: CacheKey): CacheEntry | null {
  const cacheKey = generateCacheKey(key);
  const entry = activityCache.get(cacheKey);
  
  if (!entry) {
    return null;
  }

  // Check if cache is still valid (within conversation context)
  // For now, we keep cache for the entire session
  return entry;
}

/**
 * Store activities in cache
 */
export function setCachedActivities(
  key: CacheKey,
  activities: StravaActivity[],
): void {
  const cacheKey = generateCacheKey(key);
  
  const entry: CacheEntry = {
    data: activities,
    fetchedAt: new Date().toISOString(),
    metadata: {
      days: key.days,
      includeDetails: key.includeDetails,
      count: activities.length,
    },
  };

  activityCache.set(cacheKey, entry);
}

/**
 * Clear cache for a specific user or all cache
 */
export function clearCache(userId?: string): void {
  if (userId) {
    // Clear all entries for this user
    const keysToDelete: string[] = [];
    for (const key of activityCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => activityCache.delete(key));
  } else {
    // Clear entire cache
    activityCache.clear();
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  keys: string[];
} {
  return {
    size: activityCache.size,
    keys: Array.from(activityCache.keys()),
  };
}
