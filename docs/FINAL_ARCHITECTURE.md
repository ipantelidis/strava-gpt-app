# Final Architecture: Simplified & Realistic

## What We're Building

### ✅ Weather (Dust Agent)
- **Why**: Your Dust agent already provides perfect output
- **What**: Natural language weather queries with running recommendations
- **How**: MCP tool calls Dust agent, returns structured data

### ✅ Routes (Mapbox API)
- **Why**: Too complex for Dust without API access
- **What**: Generate 2-3 running route options with full details
- **How**: MCP tool uses Mapbox utilities we built

### ✅ Strava Export (Your Server)
- **Why**: Straightforward API integration
- **What**: Export routes as GPX and create Strava activities
- **How**: MCP tool generates GPX and calls Strava API

### ❌ Safety Agent (Removed)
- **Why**: Simple scoring can be done in your server
- **What**: Basic safety scores based on time/terrain
- **How**: Calculated in route generation logic

## Architecture Diagram

```
User: "Generate a 10km route in Paris"
    ↓
ChatGPT
    ↓
┌─────────────────────────────────────────────┐
│         MCP Server (Your App)               │
│                                             │
│  Tool: generate_running_route              │
│    ↓                                        │
│  server/src/routes/generator.ts            │
│    ↓                                        │
│  Mapbox API                                 │
│    ↓                                        │
│  Returns: 3 route options                  │
└─────────────────────────────────────────────┘
    ↓
ChatGPT presents routes
    ↓
User: "What's the weather like?"
    ↓
ChatGPT
    ↓
┌─────────────────────────────────────────────┐
│         MCP Server (Your App)               │
│                                             │
│  Tool: get_weather_recommendation          │
│    ↓                                        │
│  server/src/dust/client.ts                 │
│    ↓                                        │
│  Dust Weather Agent                        │
│    ↓                                        │
│  Returns: Weather + recommendations        │
└─────────────────────────────────────────────┘
    ↓
ChatGPT presents weather
    ↓
User: "Export route 1 to Strava"
    ↓
ChatGPT
    ↓
┌─────────────────────────────────────────────┐
│         MCP Server (Your App)               │
│                                             │
│  Tool: export_route_to_strava              │
│    ↓                                        │
│  Generate GPX from route                   │
│    ↓                                        │
│  Strava API (create activity)              │
│    ↓                                        │
│  Returns: Strava activity URL              │
└─────────────────────────────────────────────┘
```

## File Structure

```
server/src/
├── dust/
│   ├── client.ts          # Dust API client
│   ├── agents.ts          # Weather agent only
│   ├── errors.ts          # Error handling
│   └── index.ts           # Exports
│
├── routes/
│   ├── mapbox.ts          # Mapbox utilities
│   ├── generator.ts       # Route generation
│   └── index.ts           # Exports
│
├── strava.ts              # Existing Strava utilities
├── auth.ts                # Existing auth
├── errors.ts              # Existing error handling
└── server.ts              # MCP tools (next step)
```

## Environment Variables

```bash
# Dust (Weather only - 1 agent)
DUST_API_KEY=dust_sk_xxxxx
DUST_WEATHER_AGENT_ID=weather-agent-xxxxx

# Mapbox (Routes)
MAPBOX_API_KEY=pk.xxxxx

# Strava (Already configured)
STRAVA_CLIENT_ID=xxxxx
STRAVA_CLIENT_SECRET=xxxxx
```

## What's Complete

✅ **Dust Infrastructure**
- Client with error handling
- Weather agent types (matches your output)
- Configuration validation

✅ **Route Generation**
- Mapbox geocoding
- Circular route generation
- Walking directions
- Elevation profiles
- Polyline encoding
- Multiple variations

✅ **Documentation**
- Setup guides
- Architecture docs
- Simplified tasks

## What's Next (3 MCP Tools)

### 1. Weather Tool (~50 lines)

```typescript
server.registerTool(
  "get_weather_recommendation",
  { /* schema */ },
  async ({ location, query }) => {
    const client = createDustClient();
    const weather = await callWeatherAgent(client, { location, query });
    return weather; // Already perfect format!
  }
);
```

### 2. Route Tool (~80 lines)

```typescript
server.registerTool(
  "generate_running_route",
  { /* schema */ },
  async ({ distance, location, terrain, preferences }) => {
    const mapboxToken = process.env.MAPBOX_API_KEY;
    const routes = await generateRoutes({
      distance,
      location,
      terrain,
      preferences
    }, mapboxToken);
    return { routes };
  }
);
```

### 3. Export Tool (~60 lines)

```typescript
server.registerTool(
  "export_route_to_strava",
  { /* schema */ },
  async ({ routeId, route, token }) => {
    const gpx = generateGPX(route);
    const activity = await createStravaActivity(gpx, token);
    return { stravaUrl: activity.url };
  }
);
```

## Benefits of This Approach

✅ **Simple**: Only 1 Dust agent (weather)
✅ **Reliable**: Direct API calls for routes
✅ **Maintainable**: Clear separation of concerns
✅ **Testable**: Each component is independent
✅ **Realistic**: Uses tools for what they're good at

## Summary

- **Weather**: Dust agent (perfect output, natural language)
- **Routes**: Mapbox API (precise, reliable, complete)
- **Export**: Strava API (straightforward integration)
- **Safety**: Simple scoring (no separate agent needed)

This is what will actually work and be maintainable! 🎯
