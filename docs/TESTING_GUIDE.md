# Testing Guide

## Overview

This document describes the testing strategy for the Strava Running Coach app, including unit tests, integration tests, and best practices for testing the layered visualization architecture.

## Test Structure

### Test Files

- `server/src/errors.test.ts` - Error handling utilities tests
- `server/src/server.test.ts` - Basic server and widget registration tests
- `server/src/integration.test.ts` - Complete user flow integration tests

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm test -- --watch

# Run specific test file
npm test -- errors.test.ts --run

# Run tests with coverage
npm test -- --coverage
```

## Test Categories

### 1. Unit Tests

Unit tests verify individual functions and components in isolation.

**Example: Error Handling**

```typescript
import { describe, it, expect } from "vitest";
import { RateLimitError, isRateLimitError } from "./errors";

describe("Error Handling", () => {
  it("should create rate limit error with metadata", () => {
    const error = new RateLimitError("Rate limit exceeded", 900, 100, 95);
    
    expect(error.name).toBe("RateLimitError");
    expect(error.retryAfter).toBe(900);
  });
});
```

**What to Test:**
- Error creation and properties
- Data validation functions
- Calculation functions (pace, load, etc.)
- Data transformation utilities

### 2. Integration Tests

Integration tests verify complete user flows from authentication through data fetching to visualization.

**Example: Complete Flow**

```typescript
describe("Flow 1: Auth → Data Tool → Visualization", () => {
  it("should complete full flow from auth to data fetch to visualization", async () => {
    // Step 1: Mock authorization
    const mockToken = "mock_access_token_12345";
    
    // Step 2: Mock data fetching
    const mockActivities = [
      { id: 1, distance: 5000, moving_time: 1500 },
      { id: 2, distance: 8000, moving_time: 2400 },
    ];
    
    // Step 3: Transform data for visualization
    const chartData = mockActivities.map(a => ({
      x: a.start_date_local.split("T")[0],
      y: a.distance / 1000,
    }));
    
    // Step 4: Verify visualization input format
    expect(chartData).toHaveLength(2);
    expect(chartData[0].y).toBe(5);
  });
});
```

**What to Test:**
- Complete user flows (auth → data → visualization)
- GPT orchestration patterns
- Fallback paths when components fail
- Error propagation through layers
- Caching behavior

### 3. Widget Tests

Widget tests verify that UI components render correctly and use the design system.

**Example: Design System Usage**

```typescript
import { DesignSystem } from "../design-system";

it("should use design system constants", () => {
  const widget = render(<TrainingSummary />);
  const card = widget.getByTestId("card");
  
  expect(card.style.background).toBe(DesignSystem.colors.gradients.primary);
  expect(card.style.backdropFilter).toBe(DesignSystem.glassmorphism.backdropBlur);
});
```

**What to Test:**
- Widget renders without errors
- Design system constants are used (no hard-coded values)
- Data is displayed correctly
- Trend indicators use semantic colors

## Testing Patterns

### Pattern 1: Testing Data Tools

Data tools should return structured output matching the declared schema.

```typescript
it("should return data in expected format from fetch_activities", async () => {
  const dataToolOutput = {
    data: [
      {
        id: 1,
        distance: 5000,
        moving_time: 1500,
        average_speed: 3.33,
      },
    ],
    metadata: {
      fetchedAt: new Date().toISOString(),
      source: "strava",
      cached: false,
      count: 1,
    },
  };
  
  // Verify structure
  expect(dataToolOutput.data).toBeInstanceOf(Array);
  expect(dataToolOutput.metadata.source).toBe("strava");
  expect(dataToolOutput.metadata.count).toBe(1);
});
```

### Pattern 2: Testing Orchestration Logic

Test that GPT orchestration chooses the right tool/widget combination.

```typescript
it("should use integrated widget for common queries", async () => {
  const query = "How's my training?";
  
  const shouldUseIntegratedWidget = 
    query.toLowerCase().includes("training") ||
    query.toLowerCase().includes("summary");
  
  expect(shouldUseIntegratedWidget).toBe(true);
});

it("should use data tool + visualization for custom queries", async () => {
  const query = "Show me pace vs elevation";
  
  const needsCustomVisualization = 
    query.toLowerCase().includes("vs") ||
    query.toLowerCase().includes("show me");
  
  expect(needsCustomVisualization).toBe(true);
});
```

### Pattern 3: Testing Error Handling

Test that errors are detected and handled gracefully.

```typescript
it("should detect and handle rate limit errors", async () => {
  const mockResponse = {
    status: 429,
    headers: {
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Usage": "100",
      "Retry-After": "900",
    },
  };
  
  const isRateLimited = mockResponse.status === 429;
  expect(isRateLimited).toBe(true);
  
  const retryAfter = parseInt(mockResponse.headers["Retry-After"]);
  expect(retryAfter).toBe(900);
});

it("should handle missing optional data gracefully", async () => {
  const activityWithMissingData = {
    id: 1,
    distance: 5000,
    moving_time: 1500,
    // Missing: average_heartrate, splits_metric
  };
  
  // Verify required fields are present
  expect(activityWithMissingData.distance).toBeDefined();
  
  // System should continue with available data
  const canProcessActivity = 
    activityWithMissingData.distance !== undefined &&
    activityWithMissingData.moving_time !== undefined;
  
  expect(canProcessActivity).toBe(true);
});
```

### Pattern 4: Testing Caching

Test that caching works correctly across requests.

```typescript
it("should cache activities within conversation context", async () => {
  const cacheKey = {
    userId: "user123",
    days: 7,
    includeDetails: false,
  };
  
  // First request - cache miss
  const firstRequest = {
    cached: false,
    data: [{ id: 1 }, { id: 2 }],
  };
  
  expect(firstRequest.cached).toBe(false);
  
  // Second request - cache hit
  const secondRequest = {
    cached: true,
    data: firstRequest.data,
  };
  
  expect(secondRequest.cached).toBe(true);
  expect(secondRequest.data).toEqual(firstRequest.data);
});
```

## Best Practices

### DO:
- ✅ Write tests for all new features
- ✅ Test both success and error paths
- ✅ Test edge cases (empty data, missing fields)
- ✅ Use descriptive test names
- ✅ Keep tests focused and isolated
- ✅ Mock external dependencies (Strava API)
- ✅ Test design system usage in widgets

### DON'T:
- ❌ Test implementation details
- ❌ Write tests that depend on external services
- ❌ Use real API tokens in tests
- ❌ Write tests that depend on test execution order
- ❌ Skip error case testing
- ❌ Test multiple things in one test

## Mocking Strategies

### Mocking Strava API Responses

```typescript
const mockStravaActivity = {
  id: 12345,
  name: "Morning Run",
  distance: 5000,
  moving_time: 1500,
  average_speed: 3.33,
  total_elevation_gain: 50,
  start_date_local: "2024-01-15T08:00:00Z",
  average_heartrate: 150,
};

const mockStravaResponse = {
  ok: true,
  status: 200,
  json: async () => [mockStravaActivity],
};
```

### Mocking Authentication

```typescript
const mockAuth = {
  userId: "user123",
  accessToken: "mock_token_12345",
};

const mockAuthResponse = {
  access_token: "mock_token_12345",
  refresh_token: "mock_refresh_token",
  expires_at: Date.now() / 1000 + 21600,
};
```

## Test Coverage Goals

### Minimum Coverage Targets:
- **Unit Tests**: 80% coverage for utility functions
- **Integration Tests**: All major user flows covered
- **Error Handling**: All error types tested
- **Widget Tests**: All widgets have basic render tests

### Critical Paths to Test:
1. Authentication flow (exchange_strava_code)
2. Data fetching (fetch_activities with and without details)
3. Data tools (all 5 data tools)
4. Visualization widgets (all 5 visualization widgets)
5. Integrated widgets (all 4 integrated widgets)
6. Error handling (401, 429, missing data)
7. Caching behavior
8. Design system usage

## Continuous Integration

Tests should run automatically on:
- Every commit
- Every pull request
- Before deployment

```yaml
# Example CI configuration
test:
  script:
    - npm install
    - npm test -- --run
    - npm test -- --coverage
```

## Debugging Tests

### Running Tests in Debug Mode

```bash
# Run with verbose output
npm test -- --reporter=verbose

# Run single test file
npm test -- integration.test.ts --run

# Run tests matching pattern
npm test -- --grep "auth"
```

### Common Issues

**Issue: Tests fail intermittently**
- Cause: Tests depend on timing or external state
- Solution: Use mocks and avoid real API calls

**Issue: Tests pass locally but fail in CI**
- Cause: Environment differences
- Solution: Check environment variables and dependencies

**Issue: Tests are slow**
- Cause: Too many real API calls or heavy computations
- Solution: Use mocks and keep tests focused

## Adding New Tests

When adding new features, follow this checklist:

1. **Write unit tests** for new utility functions
2. **Write integration tests** for new user flows
3. **Write widget tests** if adding new UI components
4. **Test error cases** for all new code paths
5. **Update this guide** if introducing new testing patterns

## Resources

- Vitest Documentation: https://vitest.dev/
- Integration Tests: `server/src/integration.test.ts`
- Error Tests: `server/src/errors.test.ts`
- Design System: `docs/DESIGN_SYSTEM.md`
- GPT Orchestration: `docs/GPT_ORCHESTRATION_GUIDE.md`
