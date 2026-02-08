/**
 * Route generation logic with LLM-controlled parameters
 */

import {
  geocodeLocation,
  generateCircularRoute,
  getWalkingDirections,
  encodePolyline,
  getElevationProfile,
  calculateDifficulty,
  generateRouteName,
  queryPOIs,
  orderWaypointsByProximity,
  filterAvoidAreas,
  type RouteRequest,
  type GeneratedRoute,
} from "./mapbox.js";

/**
 * Generate multiple route options based on request with LLM-controlled parameters
 */
export async function generateRoutes(
  request: RouteRequest,
  accessToken: string
): Promise<GeneratedRoute[]> {
  // 1. Geocode the main location
  const center = await geocodeLocation(request.location, accessToken);

  // 2. Process mustInclude landmarks
  const landmarkWaypoints: Array<{ lat: number; lng: number; name: string }> =
    [];
  if (request.mustInclude && request.mustInclude.length > 0) {
    for (const landmark of request.mustInclude) {
      try {
        const coords = await geocodeLocation(landmark, accessToken);
        landmarkWaypoints.push({ ...coords, name: landmark });
      } catch (error) {
        console.warn(`Could not geocode landmark: ${landmark}`, error);
      }
    }
  }

  // 3. Process avoidAreas
  const avoidZones: Array<{ lat: number; lng: number; radius: number }> = [];
  if (request.avoidAreas && request.avoidAreas.length > 0) {
    for (const area of request.avoidAreas) {
      try {
        const coords = await geocodeLocation(area, accessToken);
        avoidZones.push({ ...coords, radius: 0.5 }); // 500m avoid radius
      } catch (error) {
        console.warn(`Could not geocode avoid area: ${area}`, error);
      }
    }
  }

  // 4. Query POIs for scenic routes
  let scenicPOIs: Array<{ name: string; lat: number; lng: number; type: string }> =
    [];
  if ((request.scenicPriority || 0) > 50) {
    const poiTypes = ["park", "viewpoint", "monument", "lake", "river"];
    scenicPOIs = await queryPOIs(
      center,
      request.distance / 2,
      poiTypes,
      accessToken
    );
  }

  // 5. Generate route variations
  const routes: GeneratedRoute[] = [];
  const baseRadius = request.distance / (2 * Math.PI);

  // Strategy 1: If landmarks specified, create route through them
  if (landmarkWaypoints.length > 0) {
    try {
      const orderedLandmarks = orderWaypointsByProximity(
        landmarkWaypoints,
        center
      );
      const waypointsWithReturn = [center, ...orderedLandmarks, center];

      const directions = await getWalkingDirections(
        waypointsWithReturn,
        accessToken
      );

      // Filter out avoid areas
      let filteredPath = directions.path;
      if (avoidZones.length > 0) {
        filteredPath = filterAvoidAreas(directions.path, avoidZones);
      }

      const elevationProfile = await getElevationProfile(
        filteredPath,
        accessToken
      );
      const elevationGain = calculateElevationGain(elevationProfile);
      const polyline = encodePolyline(filteredPath);
      const difficulty = calculateDifficulty(directions.distance, elevationGain);

      routes.push({
        id: "route-landmarks",
        name: `${request.location} via ${landmarkWaypoints.map((l) => l.name).join(", ")}`,
        distance: Math.round(directions.distance * 10) / 10,
        elevationGain: Math.round(elevationGain),
        elevationProfile,
        difficulty,
        highlights: generateHighlights(
          request,
          directions.distance,
          elevationGain,
          landmarkWaypoints.map((l) => l.name)
        ),
        path: filteredPath,
        polyline,
        waypoints: directions.instructions.map((inst, idx) => ({
          lat: filteredPath[idx * 10]?.lat || center.lat,
          lng: filteredPath[idx * 10]?.lng || center.lng,
          instruction: inst.instruction,
        })),
        pointsOfInterest: scenicPOIs.slice(0, 5).map((poi) => ({
          type: "water" as const,
          lat: poi.lat,
          lng: poi.lng,
          name: poi.name,
        })),
        safetyScore: calculateSafetyScore(request),
        scenicScore: calculateScenicScore(request, scenicPOIs.length),
        trafficLevel: estimateTrafficLevel(request),
      });
    } catch (error) {
      console.error("Failed to generate landmark route:", error);
    }
  }

  // Strategy 2: Scenic route (if high scenic priority)
  if ((request.scenicPriority || 0) > 70 && scenicPOIs.length > 0) {
    try {
      const topPOIs = scenicPOIs.slice(0, 3);
      const orderedPOIs = orderWaypointsByProximity(topPOIs, center);
      const waypointsWithReturn = [center, ...orderedPOIs, center];

      const directions = await getWalkingDirections(
        waypointsWithReturn,
        accessToken
      );

      let filteredPath = directions.path;
      if (avoidZones.length > 0) {
        filteredPath = filterAvoidAreas(directions.path, avoidZones);
      }

      const elevationProfile = await getElevationProfile(
        filteredPath,
        accessToken
      );
      const elevationGain = calculateElevationGain(elevationProfile);
      const polyline = encodePolyline(filteredPath);
      const difficulty = calculateDifficulty(directions.distance, elevationGain);

      routes.push({
        id: "route-scenic",
        name: `Scenic ${request.location} Loop`,
        distance: Math.round(directions.distance * 10) / 10,
        elevationGain: Math.round(elevationGain),
        elevationProfile,
        difficulty,
        highlights: [
          "Highly scenic route",
          ...topPOIs.map((poi) => `Passes ${poi.name}`),
          ...generateHighlights(request, directions.distance, elevationGain, []),
        ],
        path: filteredPath,
        polyline,
        waypoints: directions.instructions.map((inst, idx) => ({
          lat: filteredPath[idx * 10]?.lat || center.lat,
          lng: filteredPath[idx * 10]?.lng || center.lng,
          instruction: inst.instruction,
        })),
        pointsOfInterest: topPOIs.map((poi) => ({
          type: "water" as const,
          lat: poi.lat,
          lng: poi.lng,
          name: poi.name,
        })),
        safetyScore: calculateSafetyScore(request),
        scenicScore: 95,
        trafficLevel: "low" as const,
      });
    } catch (error) {
      console.error("Failed to generate scenic route:", error);
    }
  }

  // Strategy 3: Standard circular routes (fallback or additional options)
  // Use tighter variations to stay closer to requested distance
  const variations = [
    { radiusMultiplier: 0.95, name: "Compact Loop" },
    { radiusMultiplier: 1.0, name: "Standard Loop" },
    { radiusMultiplier: 1.05, name: "Extended Loop" },
  ];

  for (let i = 0; i < Math.min(3 - routes.length, variations.length); i++) {
    const variation = variations[i];
    const radius = baseRadius * variation.radiusMultiplier;

    try {
      const waypoints = await generateCircularRoute(center, radius, accessToken);

      let filteredWaypoints = waypoints;
      if (avoidZones.length > 0) {
        filteredWaypoints = filterAvoidAreas(waypoints, avoidZones);
      }

      const directions = await getWalkingDirections(
        filteredWaypoints,
        accessToken
      );
      const elevationProfile = await getElevationProfile(
        directions.path,
        accessToken
      );
      const elevationGain = calculateElevationGain(elevationProfile);
      const polyline = encodePolyline(directions.path);
      const difficulty = calculateDifficulty(directions.distance, elevationGain);

      routes.push({
        id: `route-${routes.length + 1}`,
        name: generateRouteName(
          request.location,
          directions.distance,
          request.terrain
        ),
        distance: Math.round(directions.distance * 10) / 10,
        elevationGain: Math.round(elevationGain),
        elevationProfile,
        difficulty,
        highlights: generateHighlights(
          request,
          directions.distance,
          elevationGain,
          []
        ),
        path: directions.path,
        polyline,
        waypoints: directions.instructions.map((inst, idx) => ({
          lat: directions.path[idx * 10]?.lat || center.lat,
          lng: directions.path[idx * 10]?.lng || center.lng,
          instruction: inst.instruction,
        })),
        pointsOfInterest: [],
        safetyScore: calculateSafetyScore(request),
        scenicScore: calculateScenicScore(request, scenicPOIs.length),
        trafficLevel: estimateTrafficLevel(request),
      });
    } catch (error) {
      console.error(`Failed to generate route variation ${i}:`, error);
    }
  }

  // Filter routes to keep only those within acceptable distance tolerance
  // Allow ±20% of requested distance (e.g., 10km request → 8-12km acceptable)
  const minDistance = request.distance * 0.8;
  const maxDistance = request.distance * 1.2;
  
  const filteredRoutes = routes.filter(
    route => route.distance >= minDistance && route.distance <= maxDistance
  );

  // If we have filtered routes, use them; otherwise fall back to all routes
  // (better to show something than nothing)
  const finalRoutes = filteredRoutes.length >= 2 ? filteredRoutes : routes;

  // Return at least 2 routes
  if (finalRoutes.length < 2) {
    throw new Error("Failed to generate sufficient route options within distance tolerance");
  }

  return finalRoutes.slice(0, 3);
}

/**
 * Calculate total elevation gain from profile
 */
function calculateElevationGain(
  profile: Array<{ distance: number; elevation: number }>
): number {
  let gain = 0;

  for (let i = 1; i < profile.length; i++) {
    const diff = profile[i].elevation - profile[i - 1].elevation;
    if (diff > 0) {
      gain += diff;
    }
  }

  return gain;
}

/**
 * Generate route highlights based on characteristics
 */
function generateHighlights(
  request: RouteRequest,
  distance: number,
  elevationGain: number,
  landmarks: string[]
): string[] {
  const highlights: string[] = [];

  // Landmark highlights
  if (landmarks.length > 0) {
    highlights.push(`Passes ${landmarks.join(", ")}`);
  }

  // Distance-based highlights
  if (distance < 5) {
    highlights.push("Perfect for a quick run");
  } else if (distance < 10) {
    highlights.push("Great mid-distance route");
  } else {
    highlights.push("Excellent long run option");
  }

  // Terrain-based highlights
  if (request.terrain === "flat" || elevationGain < 50) {
    highlights.push("Mostly flat terrain");
  } else if (elevationGain < 150) {
    highlights.push("Moderate elevation changes");
  } else {
    highlights.push("Challenging hills");
  }

  // Preference-based highlights
  if (request.preferences === "park") {
    highlights.push("Scenic park setting");
  } else if (request.preferences === "waterfront") {
    highlights.push("Beautiful waterfront views");
  } else if (request.preferences === "urban") {
    highlights.push("Urban exploration route");
  }

  // Intensity-based highlights
  if (request.intensity === "easy") {
    highlights.push("Relaxed pace recommended");
  } else if (request.intensity === "challenging") {
    highlights.push("Great for tempo work");
  }

  // Traffic level highlights
  if (request.trafficLevel === "low") {
    highlights.push("Low traffic, peaceful route");
  }

  // Elevation preference highlights
  if (request.elevationPreference === "maximize" && elevationGain > 100) {
    highlights.push("Hill training route");
  } else if (request.elevationPreference === "minimize") {
    highlights.push("Flat, fast route");
  }

  return highlights.slice(0, 6);
}

/**
 * Calculate safety score based on route characteristics
 */
function calculateSafetyScore(request: RouteRequest): number {
  let score = 80; // Base score

  // Adjust based on safety priority
  if (request.safetyPriority) {
    score = Math.max(score, request.safetyPriority);
  }

  // Adjust based on preferences
  if (request.preferences === "park") {
    score += 10; // Parks are generally safer
  } else if (request.preferences === "urban") {
    score -= 5; // Urban routes may have more traffic
  }

  // Adjust based on terrain
  if (request.terrain === "flat") {
    score += 5; // Flat routes are easier/safer
  } else if (request.terrain === "hilly") {
    score -= 5; // Hills require more caution
  }

  // Adjust based on traffic level preference
  if (request.trafficLevel === "low") {
    score += 10;
  } else if (request.trafficLevel === "high") {
    score -= 10;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate scenic score based on route characteristics
 */
function calculateScenicScore(request: RouteRequest, poiCount: number): number {
  let score = 60; // Base score

  // Adjust based on scenic priority
  if (request.scenicPriority) {
    score = Math.max(score, request.scenicPriority);
  }

  // Adjust based on preferences
  if (request.preferences === "park") {
    score += 25;
  } else if (request.preferences === "waterfront") {
    score += 30;
  } else if (request.preferences === "trail") {
    score += 20;
  } else if (request.preferences === "urban") {
    score += 10;
  }

  // Bonus for POIs found
  score += Math.min(15, poiCount * 3);

  return Math.min(100, Math.max(0, score));
}

/**
 * Estimate traffic level based on route characteristics
 */
function estimateTrafficLevel(request: RouteRequest): "low" | "medium" | "high" {
  if (request.preferences === "park" || request.preferences === "trail") {
    return "low";
  } else if (request.preferences === "waterfront") {
    return "medium";
  } else {
    return "medium"; // Urban routes
  }
}

/**
 * Enrich POIs with web search data via Dust agent (optional)
 */
export async function enrichPOIsWithDust(
  routes: GeneratedRoute[],
  location: string,
  dustClient: any
): Promise<GeneratedRoute[]> {
  try {
    // Import the POI enrichment function
    const { callPOIEnrichmentAgent } = await import("../dust/index.js");

    // Collect all unique POIs from all routes
    const allPOIs = routes.flatMap((r) => r.pointsOfInterest);
    if (allPOIs.length === 0) return routes;

    // Remove duplicates by name
    const uniquePOIs = Array.from(
      new Map(allPOIs.map((poi) => [poi.name, poi])).values()
    );

    // Call Dust agent
    const enriched = await callPOIEnrichmentAgent(dustClient, {
      location,
      pois: uniquePOIs.map((poi) => ({ name: poi.name, type: poi.type })),
      query: "runner amenities water fountains restrooms safety tips",
    });

    // Create a map of enriched data
    const enrichedMap = new Map(
      enriched.enrichedPOIs.map((poi) => [poi.name, poi])
    );

    // Merge enriched data back into routes
    return routes.map((route) => ({
      ...route,
      pointsOfInterest: route.pointsOfInterest.map((poi) => {
        const enrichedPOI = enrichedMap.get(poi.name);
        return enrichedPOI ? { ...poi, ...enrichedPOI } : poi;
      }),
    }));
  } catch (error) {
    console.warn("POI enrichment failed, using basic POIs:", error);
    return routes; // Graceful fallback
  }
}
