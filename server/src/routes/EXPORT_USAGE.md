# Export Route to Strava - Usage Guide

## Overview

The `export_route_to_strava` tool allows users to export generated running routes to their Strava account as planned activities. The tool creates a GPX file from route data and uploads it to Strava.

## Features

- ✅ Generates GPX 1.1 format files from route data
- ✅ Includes elevation profile in GPX
- ✅ Uploads to Strava as a planned activity
- ✅ Returns Strava activity URL for easy access
- ✅ Provides GPX download as fallback
- ✅ Handles authentication and rate limiting
- ✅ Validates GPX format before upload

## Usage Flow

### 1. Generate a Route

First, use the `generate_running_route` tool to create route options:

```typescript
const result = await generateRunningRoute({
  distance: 10,
  location: "Paris, France",
  mustInclude: ["Eiffel Tower", "Seine River"],
  scenicPriority: 80,
});
```

### 2. Export to Strava

Then, export the selected route to Strava:

```typescript
const exportResult = await exportRouteToStrava({
  routeData: result.routes[0], // Select the route you want
  activityName: "Morning Run in Paris",
  description: "Scenic 10k route along the Seine",
  token: "your_strava_access_token",
});
```

### 3. Access on Strava

The tool returns:
- Strava activity ID
- Direct URL to view the activity on Strava
- GPX download link (as fallback)

## Example Conversation Flow

**User:** "Generate a 10k route in Paris that goes by the Eiffel Tower"

**Assistant:** Calls `generate_running_route` and shows 2-3 options

**User:** "I like option 1, save it to my Strava"

**Assistant:** Calls `export_route_to_strava` with the route data

**Result:** Route is uploaded to Strava and user gets a link to view it

## API Details

### Input Schema

```typescript
{
  routeId?: string;           // Optional route ID (for future use)
  routeData: {                // Required route data
    name: string;
    distance: number;         // km
    elevationGain: number;    // meters
    path: Array<{
      lat: number;
      lng: number;
    }>;
    elevationProfile?: Array<{
      distance: number;
      elevation: number;
    }>;
  };
  activityName?: string;      // Custom name (defaults to route name)
  description?: string;       // Activity description
  token?: string;             // Strava access token (OAuth handles automatically)
}
```

### Output

```typescript
{
  success: boolean;
  stravaActivityId: number;
  stravaUrl: string;          // Direct link to Strava activity
  gpxDownloadUrl: string;     // Base64 data URL for GPX download
  routeName: string;
  distance: number;
  elevationGain: number;
}
```

## Error Handling

The tool handles:
- **401 Unauthorized**: Invalid or expired Strava token
- **429 Rate Limit**: Strava API rate limit exceeded
- **Invalid GPX**: Validation fails before upload
- **Upload Failures**: Network or API errors
- **Processing Timeout**: Strava takes too long to process

All errors return user-friendly messages with actionable guidance.

## Technical Implementation

### Files Created

1. **`server/src/routes/gpx.ts`**
   - GPX 1.1 format generation
   - XML escaping and validation
   - Track point and metadata handling

2. **`server/src/strava-upload.ts`**
   - Strava upload API integration
   - Upload status polling
   - Activity URL generation

3. **`server/src/server.ts`** (modified)
   - Tool registration
   - Input validation
   - Error handling

### Tests

- **`server/src/routes/gpx.test.ts`**: 8 tests for GPX generation
- **`server/src/strava-upload.test.ts`**: 2 tests for URL generation

All tests pass ✅

## Requirements Satisfied

- ✅ **3.1**: GPX format compatible with Strava
- ✅ **3.2**: Offer to create planned activity in Strava
- ✅ **3.3**: Include route name, distance, and elevation profile

## Next Steps

Users can now:
1. Generate custom routes with `generate_running_route`
2. Export routes to Strava with `export_route_to_strava`
3. View and follow routes in the Strava app during runs
4. Track performance against planned routes
