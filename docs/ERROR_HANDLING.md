# Error Handling and Fallbacks

This document describes the comprehensive error handling and fallback mechanisms implemented in the Strava Running Coach application.

## Overview

The application implements multiple layers of error handling to ensure graceful degradation and clear user feedback when issues occur:

1. **React Error Boundaries** - Catch rendering errors in widgets
2. **Rate Limit Detection** - Handle Strava API rate limits (429 errors)
3. **Authentication Errors** - Guide users through re-authorization
4. **Missing Data Handling** - Gracefully handle optional fields
5. **Text-based Fallbacks** - Provide alternative presentations when visualizations fail

## Error Boundary Implementation

### ErrorBoundary Component

Location: `web/src/ErrorBoundary.tsx`

The `ErrorBoundary` component wraps all widgets and catches React rendering errors:

```typescript
<ErrorBoundary widgetName="get_training_summary">
  <TrainingSummaryContent />
</ErrorBoundary>
```

**Features:**
- Catches all rendering errors in child components
- Displays user-friendly error message with recovery suggestions
- Shows technical details in collapsible section for debugging
- Prevents entire app crash when a single widget fails

**Fallback UI includes:**
- Clear error icon and title
- Error message in readable format
- Widget name for context
- Actionable recovery steps
- Collapsible stack trace for developers

### Usage in Widgets

All widgets are wrapped with error boundaries:

```typescript
function WidgetContent() {
  // Widget implementation
}

export default function Widget() {
  return (
    <ErrorBoundary widgetName="widget_name">
      <WidgetContent />
    </ErrorBoundary>
  );
}
```

## Rate Limit Handling

### RateLimitError Class

Location: `server/src/strava.ts`

Custom error class for 429 responses:

```typescript
export class RateLimitError extends Error {
  public retryAfter?: number;  // seconds until reset
  public limit?: number;        // total rate limit
  public usage?: number;        // current usage
}
```

### Detection and Response

The application detects rate limits in all Strava API calls:

```typescript
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
```

### User-Facing Response

When rate limits are hit, users receive:

```
🚦 Strava API Rate Limit Exceeded

You've hit Strava's API rate limit. This is a temporary restriction.

**Current Status:**
- Usage: 95/100 requests (95%)
- Reset in: 12 minutes

**What you can do:**
1. Wait and retry: The rate limit will reset in ~12 minutes
2. Use cached data: If you've already fetched data, I can use that
3. Reduce requests: Try using integrated widgets
4. Batch operations: Combine multiple queries

**Rate Limit Details:**
- 15-minute limit: 100 requests per 15 minutes
- Daily limit: 1,000 requests per day

**Tips to avoid rate limits:**
- Use integrated widgets (optimized for fewer API calls)
- Fetch data once and analyze multiple times
- Avoid fetching detailed data unless necessary
- Use appropriate date ranges
```

## Authentication Error Handling

### UnauthorizedError Class

Location: `server/src/strava.ts`

Handles 401 Unauthorized responses:

```typescript
export class UnauthorizedError extends Error {
  constructor(message: string = "Strava API returned 401 Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
```

### Auth Error Response

Location: `server/src/auth.ts`

Provides step-by-step re-authorization instructions:

```typescript
export function authErrorResponse(errorType: AuthError["type"]) {
  // Returns structured error with:
  // - Clear error message
  // - Authorization URL
  // - Step-by-step instructions
  // - Guidance on using connect_strava widget
}
```

## Graceful Degradation for Missing Data

### Missing Optional Fields

Widgets handle missing optional data gracefully:

```typescript
// Handle missing optional fields with defaults
const safeStats = {
  totalDistance: stats.totalDistance ?? 0,
  totalRuns: stats.totalRuns ?? 0,
  avgPace: stats.avgPace ?? "0:00",
  totalTime: stats.totalTime ?? 0,
};

const safeRuns = Array.isArray(runs) ? runs : [];
```

### Empty Data States

When no data is available, widgets show informative messages:

```typescript
if (!data || !Array.isArray(data) || data.length === 0) {
  return (
    <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
      <div style={{ fontSize: "40px" }}>📊</div>
      <p>No data available to display</p>
      <p>The chart requires data points to render. Please provide valid data.</p>
    </div>
  );
}
```

### Missing Heart Rate, GPS, or Splits

The application continues with available data when optional fields are missing:

```typescript
// In fetchActivitiesWithDetails
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
```

## Error Handling Utilities

### Location: `server/src/errors.ts`

Provides utility functions for error handling:

#### rateLimitErrorResponse()
Creates structured rate limit error responses with retry information.

#### missingDataErrorResponse()
Creates warnings for missing optional data fields.

#### validateActivityData()
Checks if activity has required fields.

#### checkOptionalData()
Identifies which optional fields are available/missing.

#### createDegradationMessage()
Generates user-friendly messages for degraded functionality.

#### withErrorHandling()
Wraps async operations with try-catch and error logging.

## Error Handling Flow

### 1. API Request
```
User Request → Tool Handler → Strava API
```

### 2. Error Detection
```
Strava API Response → Check Status Code
  ├─ 401 → UnauthorizedError → Auth Instructions
  ├─ 429 → RateLimitError → Rate Limit Info
  └─ Other → Generic Error → Error Message
```

### 3. Widget Rendering
```
Data → Widget Component → Error Boundary
  ├─ Render Success → Display Widget
  └─ Render Error → Fallback UI
```

### 4. Data Validation
```
Received Data → Validate Required Fields
  ├─ Valid → Render Normally
  ├─ Missing Optional → Graceful Degradation
  └─ Missing Required → Error Message
```

## Testing Error Handling

### Manual Testing

1. **Test Rate Limits:**
   - Make 100+ requests in 15 minutes
   - Verify rate limit error message appears
   - Check retry time is displayed

2. **Test Auth Errors:**
   - Use expired token
   - Verify auth error with instructions
   - Follow re-authorization flow

3. **Test Missing Data:**
   - Use activities without heart rate
   - Verify widget continues with available data
   - Check degradation message appears

4. **Test Rendering Errors:**
   - Pass invalid data to widget
   - Verify error boundary catches error
   - Check fallback UI displays

### Automated Testing

Run tests with:
```bash
npm test -- --run
```

Tests cover:
- Error boundary behavior
- Rate limit detection
- Auth error handling
- Data validation
- Graceful degradation

## Best Practices

### For Developers

1. **Always wrap widgets with ErrorBoundary**
   ```typescript
   export default function Widget() {
     return (
       <ErrorBoundary widgetName="widget_name">
         <WidgetContent />
       </ErrorBoundary>
     );
   }
   ```

2. **Handle optional data with defaults**
   ```typescript
   const safeValue = data.optionalField ?? defaultValue;
   ```

3. **Validate data before rendering**
   ```typescript
   if (!data || !Array.isArray(data) || data.length === 0) {
     return <EmptyState />;
   }
   ```

4. **Catch errors in async operations**
   ```typescript
   try {
     const result = await fetchData();
     return result;
   } catch (error) {
     if (error instanceof RateLimitError) {
       return rateLimitErrorResponse(...);
     }
     // Handle other errors
   }
   ```

### For Users

1. **Rate Limits:**
   - Use integrated widgets when possible
   - Fetch data once, analyze multiple times
   - Wait for rate limit reset if exceeded

2. **Missing Data:**
   - Ensure device records all metrics
   - Check Strava sync is working
   - Use recent activities for best data

3. **Auth Issues:**
   - Follow re-authorization instructions
   - Get fresh authorization through connect_strava widget
   - OAuth flow handles token refresh automatically

## Future Improvements

1. **Retry Logic:**
   - Automatic retry with exponential backoff
   - Queue requests when approaching rate limit

2. **Offline Support:**
   - Cache more data locally
   - Provide offline analysis capabilities

3. **Enhanced Monitoring:**
   - Track error rates
   - Alert on unusual error patterns
   - Log errors for debugging

4. **User Preferences:**
   - Allow users to configure error verbosity
   - Option to auto-retry on transient errors
   - Customizable fallback behavior
