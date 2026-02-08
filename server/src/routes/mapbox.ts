/**
 * Mapbox API utilities for route generation
 */

export interface MapboxConfig {
  accessToken: string;
  baseUrl?: string;
}

export interface RouteRequest {
  distance: number; // km
  location: string;
  terrain?: "flat" | "hilly" | "mixed";
  preferences?: "park" | "waterfront" | "urban" | "trail";
  intensity?: "easy" | "moderate" | "challenging";
  
  // LLM-controlled semantic parameters
  mustInclude?: string[]; // Landmark names to include in route
  avoidAreas?: string[]; // Area names to avoid
  scenicPriority?: number; // 0-100, higher = more scenic
  safetyPriority?: number; // 0-100, higher = safer
  trafficLevel?: "low" | "medium" | "high"; // Preferred traffic level
  elevationPreference?: "minimize" | "maximize" | "moderate"; // Hill preference
}

export interface GeneratedRoute {
  id: string;
  name: string;
  distance: number; // km
  elevationGain: number; // meters
  elevationProfile: Array<{ distance: number; elevation: number }>;
  difficulty: "easy" | "moderate" | "hard";
  highlights: string[];
  path: Array<{ lat: number; lng: number }>;
  polyline: string; // Encoded polyline for Strava
  waypoints: Array<{ lat: number; lng: number; instruction: string }>;
  pointsOfInterest: Array<{
    type: "water" | "restroom" | "emergency";
    lat: number;
    lng: number;
    name: string;
  }>;
  safetyScore: number; // 0-100
  scenicScore: number; // 0-100
  trafficLevel: "low" | "medium" | "high";
}

/**
 * Geocode a location to coordinates
 */
export async function geocodeLocation(
  location: string,
  accessToken: string
): Promise<{ lat: number; lng: number }> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(location)}.json?access_token=${accessToken}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Mapbox geocoding failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.features || data.features.length === 0) {
    throw new Error(`Location not found: ${location}`);
  }

  const [lng, lat] = data.features[0].center;
  return { lat, lng };
}

/**
 * Generate a circular route around a center point
 */
export async function generateCircularRoute(
  center: { lat: number; lng: number },
  radiusKm: number,
  _accessToken: string
): Promise<Array<{ lat: number; lng: number }>> {
  // Generate waypoints in a circle
  const numPoints = Math.max(8, Math.floor(radiusKm * 4)); // More points for longer routes
  const points: Array<{ lat: number; lng: number }> = [];

  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const latOffset = (radiusKm / 111) * Math.cos(angle); // 111km per degree latitude
    const lngOffset =
      (radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180))) *
      Math.sin(angle);

    points.push({
      lat: center.lat + latOffset,
      lng: center.lng + lngOffset,
    });
  }

  return points;
}

/**
 * Get walking directions between waypoints
 */
export async function getWalkingDirections(
  waypoints: Array<{ lat: number; lng: number }>,
  accessToken: string
): Promise<{
  path: Array<{ lat: number; lng: number }>;
  distance: number;
  duration: number;
  instructions: Array<{ instruction: string; distance: number }>;
}> {
  // Format coordinates for Mapbox (lng,lat format)
  const coordinates = waypoints
    .map((wp) => `${wp.lng},${wp.lat}`)
    .join(";");

  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?geometries=geojson&steps=true&access_token=${accessToken}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Mapbox directions failed: ${response.status}`);
  }

  const data = await response.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error("No route found");
  }

  const route = data.routes[0];

  // Extract path from geometry
  const path = route.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => ({ lat, lng })
  );

  // Extract turn-by-turn instructions
  const instructions = route.legs.flatMap((leg: any) =>
    leg.steps.map((step: any) => ({
      instruction: step.maneuver.instruction,
      distance: step.distance,
    }))
  );

  return {
    path,
    distance: route.distance / 1000, // Convert to km
    duration: route.duration / 60, // Convert to minutes
    instructions,
  };
}

/**
 * Encode path as polyline for Strava
 */
export function encodePolyline(
  path: Array<{ lat: number; lng: number }>
): string {
  // Simplified polyline encoding (Google's algorithm)
  // For production, use a library like @mapbox/polyline
  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const point of path) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);

    encoded += encodeValue(lat - prevLat);
    encoded += encodeValue(lng - prevLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

function encodeValue(value: number): string {
  let encoded = "";
  let num = value < 0 ? ~(value << 1) : value << 1;

  while (num >= 0x20) {
    encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }

  encoded += String.fromCharCode(num + 63);
  return encoded;
}

/**
 * Calculate elevation profile for a route
 */
export async function getElevationProfile(
  path: Array<{ lat: number; lng: number }>,
  accessToken: string
): Promise<Array<{ distance: number; elevation: number }>> {
  // Sample points along the route (max 100 points for API limits)
  const sampleSize = Math.min(path.length, 100);
  const step = Math.floor(path.length / sampleSize);
  const sampledPoints = path.filter((_, i) => i % step === 0);

  // Mapbox Tilequery API for elevation
  const elevations = await Promise.all(
    sampledPoints.map(async (point, index) => {
      const url = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${point.lng},${point.lat}.json?layers=contour&limit=1&access_token=${accessToken}`;

      try {
        const response = await fetch(url);
        if (!response.ok) return { distance: index, elevation: 0 };

        const data = await response.json();
        const elevation =
          data.features?.[0]?.properties?.ele || 0;

        return {
          distance: index * (1 / sampleSize), // Normalized distance
          elevation,
        };
      } catch {
        return { distance: index, elevation: 0 };
      }
    })
  );

  return elevations;
}

/**
 * Calculate difficulty based on distance and elevation
 */
export function calculateDifficulty(
  distance: number,
  elevationGain: number
): "easy" | "moderate" | "hard" {
  const score = distance + elevationGain / 100;

  if (score < 8) return "easy";
  if (score < 15) return "moderate";
  return "hard";
}

/**
 * Generate route name based on location and characteristics
 */
export function generateRouteName(
  location: string,
  distance: number,
  terrain?: string
): string {
  const roundedDistance = Math.round(distance * 10) / 10;
  const terrainSuffix = terrain ? ` ${terrain}` : "";

  return `${location} ${roundedDistance}km${terrainSuffix} Loop`;
}

/**
 * Query Points of Interest near a location
 */
export async function queryPOIs(
  center: { lat: number; lng: number },
  radiusKm: number,
  types: string[],
  accessToken: string
): Promise<Array<{ name: string; lat: number; lng: number; type: string }>> {
  const pois: Array<{ name: string; lat: number; lng: number; type: string }> = [];

  for (const type of types) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${type}.json?proximity=${center.lng},${center.lat}&limit=10&access_token=${accessToken}`;

      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json();

      for (const feature of data.features || []) {
        const [lng, lat] = feature.center;
        const distance = calculateDistance(center, { lat, lng });

        if (distance <= radiusKm) {
          pois.push({
            name: feature.text || feature.place_name,
            lat,
            lng,
            type,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to query POIs for type ${type}:`, error);
    }
  }

  return pois;
}

/**
 * Calculate distance between two points in km (Haversine formula)
 */
function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((point1.lat * Math.PI) / 180) *
      Math.cos((point2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Order waypoints by proximity to create a logical route
 */
export function orderWaypointsByProximity(
  waypoints: Array<{ lat: number; lng: number; name?: string }>,
  start: { lat: number; lng: number }
): Array<{ lat: number; lng: number; name?: string }> {
  if (waypoints.length === 0) return [];

  const ordered: Array<{ lat: number; lng: number; name?: string }> = [];
  const remaining = [...waypoints];
  let current = start;

  while (remaining.length > 0) {
    // Find closest waypoint to current position
    let closestIndex = 0;
    let closestDistance = calculateDistance(current, remaining[0]);

    for (let i = 1; i < remaining.length; i++) {
      const distance = calculateDistance(current, remaining[i]);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    const closest = remaining.splice(closestIndex, 1)[0];
    ordered.push(closest);
    current = closest;
  }

  return ordered;
}

/**
 * Check if a point is within an avoid area
 */
export function isInAvoidArea(
  point: { lat: number; lng: number },
  avoidAreas: Array<{ lat: number; lng: number; radius: number }>
): boolean {
  return avoidAreas.some(
    (area) => calculateDistance(point, area) < area.radius
  );
}

/**
 * Filter route path to avoid specified areas
 */
export function filterAvoidAreas(
  path: Array<{ lat: number; lng: number }>,
  avoidAreas: Array<{ lat: number; lng: number; radius: number }>
): Array<{ lat: number; lng: number }> {
  if (avoidAreas.length === 0) return path;

  return path.filter((point) => !isInAvoidArea(point, avoidAreas));
}
