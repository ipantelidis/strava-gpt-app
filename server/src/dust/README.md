# Dust AI Agent Integration

This directory contains the integration layer for Dust AI agents that power weather-aware coaching, route generation, and safety analysis features.

## Architecture

The Dust integration follows a three-agent architecture:

1. **Weather Agent** - Fetches and interprets weather data for running recommendations
2. **Route Agent** - Generates custom running routes based on user preferences
3. **Safety Agent** - Evaluates route safety and provides recommendations

## Setup

### 1. Create a Dust Account

1. Go to [dust.tt](https://dust.tt/) and create an account
2. Create a new workspace for your running coach app
3. Get your API key from the workspace settings

### 2. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Dust Configuration
DUST_API_KEY=your_dust_api_key_here
DUST_API_URL=https://dust.tt/api/v1
DUST_TIMEOUT=30000

# Agent IDs (you'll get these after creating agents in Dust)
DUST_WEATHER_AGENT_ID=weather-agent
DUST_ROUTE_AGENT_ID=route-agent
DUST_SAFETY_AGENT_ID=safety-agent

# External APIs (required by agents)
OPENWEATHER_API_KEY=your_openweather_api_key_here
MAPBOX_API_KEY=your_mapbox_api_key_here
```

### 3. Create Agents in Dust

You need to create three agents in your Dust workspace:

#### Weather Agent

**Purpose**: Fetch and interpret weather data for running

**Configuration**:
- Name: `weather-agent`
- Tools: OpenWeatherMap API integration
- Instructions: "You are a weather expert for runners. Fetch current weather, forecasts, and historical data. Provide runner-friendly recommendations based on temperature, precipitation, wind, humidity, and air quality."

**Input Schema**:
```json
{
  "location": "string",
  "timeframe": "now | today | week",
  "includeHistorical": "boolean",
  "historicalDates": "string[]"
}
```

**Output Schema**:
```json
{
  "weather": {
    "temperature": "number",
    "feelsLike": "number",
    "conditions": "string",
    "precipitation": "number",
    "wind": { "speed": "number", "direction": "string" },
    "humidity": "number",
    "airQuality": { "index": "number", "level": "string" }
  },
  "recommendation": {
    "suitable": "boolean",
    "advice": "string",
    "timing": "string",
    "gear": "string[]",
    "hydration": "string"
  }
}
```

#### Route Agent

**Purpose**: Generate custom running routes

**Configuration**:
- Name: `route-agent`
- Tools: Mapbox/Google Maps API integration
- Instructions: "You are a route planning expert for runners. Generate 2-3 route options based on distance, location, terrain, and intensity preferences. Include elevation profiles, waypoints, and points of interest."

**Input Schema**:
```json
{
  "distance": "number",
  "location": "string",
  "terrain": "flat | hilly | mixed",
  "preferences": "park | waterfront | urban | trail",
  "intensity": "easy | moderate | challenging",
  "weatherContext": "object",
  "userContext": "object"
}
```

**Output Schema**:
```json
{
  "routes": [{
    "id": "string",
    "name": "string",
    "distance": "number",
    "elevationGain": "number",
    "path": [{ "lat": "number", "lng": "number" }],
    "polyline": "string",
    "waypoints": "array",
    "pointsOfInterest": "array",
    "safetyScore": "number",
    "scenicScore": "number"
  }]
}
```

#### Safety Agent

**Purpose**: Evaluate route safety

**Configuration**:
- Name: `safety-agent`
- Tools: Crime data APIs, lighting databases
- Instructions: "You are a safety expert for runners. Evaluate routes for lighting, crime risk, pedestrian infrastructure, and provide safety recommendations based on time of day."

**Input Schema**:
```json
{
  "routes": [{ "id": "string", "path": "array" }],
  "timeOfDay": "string",
  "location": "string"
}
```

**Output Schema**:
```json
{
  "routeAssessments": [{
    "routeId": "string",
    "safetyScore": "number",
    "concerns": "string[]",
    "recommendations": "string[]",
    "lighting": "good | moderate | poor"
  }]
}
```

### 4. Get External API Keys

#### OpenWeatherMap

1. Go to [openweathermap.org](https://openweathermap.org/api)
2. Sign up for a free account
3. Get your API key (free tier: 1000 calls/day)

#### Mapbox

1. Go to [mapbox.com](https://www.mapbox.com/)
2. Sign up for a free account
3. Get your API key (free tier: 50,000 requests/month)

## Usage

### Weather Agent

```typescript
import { createDustClient } from "./dust/client.js";
import { callWeatherAgent } from "./dust/agents.js";

const client = createDustClient();

const weather = await callWeatherAgent(client, {
  location: "Paris, France",
  timeframe: "now",
});

console.log(weather.recommendation.advice);
```

### Route Agent

```typescript
import { callRouteAgent } from "./dust/agents.js";

const routes = await callRouteAgent(client, {
  distance: 10,
  location: "Paris, France",
  terrain: "mixed",
  preferences: "park",
  intensity: "moderate",
});

console.log(`Generated ${routes.routes.length} route options`);
```

### Safety Agent

```typescript
import { callSafetyAgent } from "./dust/agents.js";

const safety = await callSafetyAgent(client, {
  routes: [{ id: "route-1", path: [...] }],
  timeOfDay: new Date().toISOString(),
  location: "Paris, France",
});

console.log(safety.routeAssessments[0].safetyScore);
```

## Error Handling

The integration includes comprehensive error handling:

- **Authentication errors**: Clear message to check API credentials
- **Rate limiting**: Retry-after suggestions
- **Timeouts**: User-friendly timeout messages
- **Graceful degradation**: App continues working if agents are unavailable

```typescript
import { dustErrorResponse, isDustConfigured } from "./dust/errors.js";

if (!isDustConfigured()) {
  return dustConfigurationError();
}

try {
  const result = await callWeatherAgent(client, input);
} catch (error) {
  return dustErrorResponse(error);
}
```

## Testing

Run tests with:

```bash
npm test -- server/src/dust
```

## Monitoring

Monitor agent performance in your Dust workspace dashboard:
- Response times
- Success/failure rates
- API usage
- Error logs

## Troubleshooting

### "Unable to connect to AI agents"

- Check that `DUST_API_KEY` is set correctly
- Verify your Dust workspace is active
- Check network connectivity

### "Agent not found"

- Verify agent IDs match your Dust workspace configuration
- Check that agents are deployed and active

### "Rate limit exceeded"

- Check your Dust plan limits
- Implement caching to reduce API calls
- Consider upgrading your plan

## Documentation

- [Dust Documentation](https://docs.dust.tt/)
- [OpenWeatherMap API](https://openweathermap.org/api)
- [Mapbox API](https://docs.mapbox.com/)
