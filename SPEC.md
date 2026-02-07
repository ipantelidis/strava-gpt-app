# Strava Running Coach App

## Value Proposition

**Problem + User**: Recreational and semi-serious runners (2–6 runs per week) who use Strava generate lots of data but struggle to understand what it means. They want simple answers to questions like "Am I improving?", "Was this a good training week?", or "Am I overdoing it?"

**Pain**: Today, runners check Strava dashboards and graphs, manually compare weeks and runs, and guess whether changes are good or bad. This is cognitively heavy, requires context switching, and provides no conversational feedback or interpretation.

**Core actions**: 
1. **Summarize recent training** – Analyze last 7 days or last 5 runs with clear insights
2. **Week-over-week comparison** – Show trends and patterns in training load
3. **Simple coaching advice** – Provide one actionable next-step suggestion

**Non-goals**: No GPS tracking, medical advice, nutrition guidance, or social features.

---

## Why LLM?

**Conversational win**: "How's my training looking this week?" beats opening Strava, navigating to analytics, mentally comparing numbers, and drawing conclusions. Natural language questions get natural language answers.

**LLM adds**: 
- Intent understanding ("Am I overdoing it?" → analyze volume trends + recovery patterns)
- Contextual reasoning (comparing current week to baseline, spotting patterns)
- Natural language responses with encouragement and coaching tone
- Adaptive conversation flow based on user's training state

**What LLM lacks**: 
- Access to Strava API data (activities, stats, performance metrics)
- Historical training data and trends
- Ability to fetch real-time athlete information

**Architecture**: LLM handles reasoning and interpretation (e.g., "Your volume is up 20% but your pace is steady—you're building endurance well"). MCP server handles data fetching from Strava API. This separation is the winning pattern for AI agents.

---

## UI Overview

**First view**: After connecting Strava, show a summary card with:
- Last 7 days: total distance (km), number of runs, average pace (min/km)
- One insight (e.g., "You're running more consistently this week")
- Quick prompt suggestions: "Analyze my training" or "What should I do next?"

**Key interactions**:

1. **Training summary**: 
   - User asks: "How am I doing?" or "Summarize my week"
   - Widget shows: Weekly stats with coach-like insight and encouraging sentence
   - Example: "5 runs, 32km total, avg 5:20/km. You're building consistency—nice work!"

2. **Week-over-week comparison**:
   - User asks: "Am I improving?" or "How does this week compare?"
   - Widget shows: Current week vs previous week with trend indicators
   - Example: "Distance up 15%, pace improved by 10 sec/km. You're progressing well."

3. **Next-step advice**:
   - User asks: "What should I do next?" or "Am I overdoing it?"
   - Widget shows: Simple, actionable recommendation
   - Example: "You've had 3 solid days. Consider a recovery run or rest day tomorrow."

**End state**: User has clarity on their training status and one clear next action, all without leaving ChatGPT.

**Tone & UX**:
- Friendly running coach voice
- Concise, practical, encouraging
- Use kilometers and min/km (metric system)
- No technical jargon unless explicitly asked
- Conversation-first insight layer, not a Strava replacement

---

## Product Context

### Strava API
- **API**: Strava API v3 (https://developers.strava.com/docs/reference/)
- **Auth**: OAuth2 with standard authorization code flow
- **Required scopes**: 
  - `read` – Basic profile access
  - `activity:read_all` – Access to all activity data
- **Rate limits**: 
  - 100 requests per 15 minutes
  - 1000 requests per day
- **Mitigation strategy**: 
  - Fetch minimal data (recent runs only, typically last 30 days)
  - Cache data within conversation context when possible
  - Avoid refetching on every message

### Setup Requirements
1. Create Strava API application at https://www.strava.com/settings/api
2. Configure OAuth2 callback URL (will be Alpic deployment URL + `/oauth/callback`)
3. Store Client ID and Client Secret as environment variables
4. Implement OAuth2 flow using Skybridge's OAuth helpers

### Data Handling
- **Token storage**: Handled via Skybridge/MCP user context
- **No long-term storage**: Data fetched on demand, not persisted
- **Privacy**: User data only accessible during active conversation session

### Technical Stack
- **Framework**: Skybridge (MCP + ChatGPT Apps)
- **Deployment**: Alpic
- **Language**: TypeScript
- **UI**: React widgets
- **API Client**: Fetch API for Strava endpoints

### Geographic Scope
- Works globally, anywhere Strava works
- No hardcoded geographic assumptions
- Paris examples (Canal Saint-Martin, Bois de Boulogne) for demo purposes only

---

## Future Extensions (Post-MVP)

- **Route generator with maps**: Generate and visualize running routes based on distance and preferences (near water, parks, scenic areas) using mapping APIs (Google Maps, Mapbox, or OpenStreetMap). Display interactive maps with elevation profiles and turn-by-turn directions.
- **Weather-aware recommendations**: Fetch real-time weather data (temperature, precipitation, wind) to provide context-aware coaching advice (e.g., "It's 28°C today—consider an early morning run or hydrate extra"). Integrate with weather APIs like OpenWeatherMap or WeatherAPI.
- **Training plan suggestions**: Multi-week progression recommendations based on goals
- **Race preparation**: Specific advice for upcoming race goals with taper strategies
- **Comparative insights**: Compare to similar runners (anonymized) for motivation

---

## UX Flows

**Flow 1: Get Training Summary**
1. User asks "How's my training?" or "Summarize my week"
2. Show weekly stats with insights and encouragement

**Flow 2: Compare Training Progress**
1. User asks "Am I improving?" or "How does this week compare?"
2. Show current week vs previous week with trend indicators

**Flow 3: Get Coaching Advice**
1. User asks "What should I do next?" or "Am I overdoing it?"
2. Show simple next-step recommendation based on recent load

---

## Tools and Widgets

### Architecture Overview

The app uses a **three-layer architecture** for flexible GPT orchestration:

1. **Data Tools** - Fetch and process data (no UI) - Returns structured JSON for GPT reasoning
2. **Visualization Widgets** - Render data in various formats (no data fetching) - Accepts data + config
3. **Integrated Widgets** - Combine data fetching + visualization for common use cases - Fastest for typical queries

**Decision Framework**:
- **Common queries** (80% case) → Use **Integrated Widgets** (fastest, best UX)
- **Custom analysis** (20% long tail) → Compose **Data Tools + Visualization Widgets**

**Design System**:
All widgets use a shared design system for visual consistency:
- Glassmorphism effects with standardized backdrop blur, opacity, and borders
- Predefined gradient palette for backgrounds and charts
- Semantic color coding (green=improvement, red=decline, gray=stable)
- Consistent spacing, border radius, and shadow values
- Runner-appropriate units (km, min/km pace, meters elevation)

See [Design System Documentation](docs/DESIGN_SYSTEM.md) for complete usage guide and best practices.
See [GPT Orchestration Guide](docs/GPT_ORCHESTRATION_GUIDE.md) for detailed orchestration patterns.

### Data Tools (No UI)

#### Tool: `fetch_activities`
- **Purpose**: Fetch raw Strava running activities with configurable detail level
- **Input**: `{ days?: number, includeDetails?: boolean, token?: string }`
- **Output**: Array of activities with metrics (distance, pace, elevation, time, splits, HR, GPS)
- **Use for**: Custom analysis, flexible data access, building custom visualizations
- **Example queries**: "Fetch my last 30 days", "Get activities with heart rate data"

#### Tool: `get_run_comparison`
- **Purpose**: Compare two specific runs side-by-side
- **Input**: `{ run1Id: number, run2Id: number, token?: string }`
- **Output**: Comparison data with aligned metrics, deltas, and trend analysis
- **Use for**: Analyzing performance differences between two specific activities
- **Example queries**: "Compare run X to run Y", "Show difference between these activities"

#### Tool: `calculate_pace_distribution`
- **Purpose**: Analyze pace distribution across activities
- **Input**: `{ days?: number, groupBy: "runType" | "distanceRange", token?: string }`
- **Output**: Grouped pace statistics (mean, median, std dev) by run type or distance
- **Use for**: Understanding pace patterns, comparing easy vs hard vs long run paces
- **Example queries**: "How does my pace vary by run type?", "Show pace distribution"

#### Tool: `analyze_elevation_impact`
- **Purpose**: Calculate pace adjustments based on elevation gain
- **Input**: `{ days?: number, token?: string }`
- **Output**: Elevation-adjusted pace for each run with adjustment calculations
- **Use for**: Understanding terrain impact, comparing hilly vs flat runs
- **Example queries**: "How does elevation affect my pace?", "What's my flat-equivalent pace?"

#### Tool: `compute_training_load`
- **Purpose**: Calculate training load metrics (acute, chronic, ratio)
- **Input**: `{ days?: number, token?: string }`
- **Output**: Load metrics including acute (7d), chronic (28d), and acute:chronic ratio
- **Use for**: Assessing training volume, injury risk, load trends
- **Example queries**: "What's my training load?", "Am I at risk of injury?"

### Visualization Widgets (No Data Fetching)

#### Widget: `render_line_chart`
- **Purpose**: Display time series data as a line chart
- **Input**: `{ data: Array<{x, y, series?}>, config?: {...} }`
- **Use for**: Pace progression, distance over time, heart rate trends
- **Workflow**: Data tool → Transform in GPT → This widget
- **Example queries**: "Show my pace over time", "Chart weekly distance"

#### Widget: `render_scatter_plot`
- **Purpose**: Visualize relationships between two variables
- **Input**: `{ data: Array<{x, y, category?}>, config?: {...} }`
- **Use for**: Distance vs pace, elevation vs heart rate, metric correlations
- **Workflow**: Data tool → Transform in GPT → This widget
- **Example queries**: "Show distance vs pace", "Plot elevation vs heart rate"

#### Widget: `render_comparison_card`
- **Purpose**: Side-by-side comparison with delta indicators
- **Input**: `{ data: RunComparison, config?: {...} }`
- **Use for**: Visualizing run-to-run performance differences
- **Workflow**: get_run_comparison → This widget
- **Example queries**: "Visualize comparison of two runs"

#### Widget: `render_heatmap`
- **Purpose**: Calendar heatmap showing activity frequency/intensity
- **Input**: `{ data: Array<{date, intensity, details?}>, config?: {...} }`
- **Use for**: Training consistency, activity patterns, rest days
- **Workflow**: fetch_activities → Transform in GPT → This widget
- **Example queries**: "Show training consistency", "Visualize activity calendar"

#### Widget: `render_distribution`
- **Purpose**: Box plot or histogram for metric distributions
- **Input**: `{ data: Array<number>, config: {type: "box" | "histogram", ...} }`
- **Use for**: Pace distribution, heart rate zones, distance patterns
- **Workflow**: Data tool → Extract metrics in GPT → This widget
- **Example queries**: "Show pace distribution", "Visualize heart rate zones"

### Integrated Widgets (Data + Visualization)

#### Widget: `get_training_summary`
- **Purpose**: Analyze recent running activities (INTEGRATED: data + UI)
- **Input**: `{ days?: number, token?: string }` (default: 7)
- **Output**: 
  ```typescript
  {
    period: { start: string, end: string },
    stats: {
      totalDistance: number,  // km
      totalRuns: number,
      avgPace: string,        // "5:20" format (min:sec per km)
      totalTime: number       // minutes
    },
    runs: Array<{
      date: string,
      distance: number,
      pace: string,
      duration: number
    }>,
    insight: string,          // LLM-generated insight
    encouragement: string     // LLM-generated encouragement
  }
  ```
- **Use for**: Quick training overview, "How's my training?", "Summarize my week"
- **Faster than**: fetch_activities + manual analysis
- **Views**: Single view showing stats card with runs list
- **Behavior**: Fetches recent Strava activities, displays summary with coaching insights

### Widget: `compare_training_weeks`
- **Purpose**: Compare training weeks (INTEGRATED: data + UI)
- **Input**: `{ currentWeekStart?: string, token?: string }` (defaults to current week)
- **Output**:
  ```typescript
  {
    currentWeek: {
      totalDistance: number,
      totalRuns: number,
      avgPace: string
    },
    previousWeek: {
      totalDistance: number,
      totalRuns: number,
      avgPace: string
    },
    changes: {
      distanceChange: number,      // percentage
      runsChange: number,          // absolute
      paceChange: number           // seconds per km
    },
    trend: "improving" | "stable" | "declining",
    analysis: string               // LLM-generated analysis
  }
  ```
- **Use for**: Week-over-week comparison, "Am I improving?", "Compare this week to last"
- **Faster than**: fetch_activities + manual comparison
- **Views**: Side-by-side comparison with trend indicators (↑↓)
- **Behavior**: Fetches last 2 weeks of activities, calculates deltas and trends

### Widget: `get_coaching_advice`
- **Purpose**: Get personalized coaching advice (INTEGRATED: data + analysis)
- **Input**: `{ context?: string, token?: string }` (optional: "recovery", "intensity", etc.)
- **Output**:
  ```typescript
  {
    recentLoad: {
      last7Days: number,     // total km
      last3Days: number,
      consecutiveDays: number
    },
    recommendation: {
      action: string,        // "Take a recovery day", "Maintain current volume"
      reasoning: string,     // Why this advice
      nextRun: string        // Specific suggestion for next run
    },
    trainingState: "fresh" | "building" | "fatigued" | "recovering"
  }
  ```
- **Use for**: Training load assessment, "What should I do next?", "Am I overdoing it?"
- **Faster than**: compute_training_load + manual reasoning
- **Views**: Single card with recommendation and reasoning
- **Behavior**: Analyzes recent training load, provides actionable next-step advice

### Widget: `analyze_run_progression`
- **Purpose**: Analyze performance progression on a specific route (INTEGRATED: data + visualization)
- **Input**: `{ polyline?: string, routeName?: string, days?: number, token?: string }`
- **Output**:
  ```typescript
  {
    route: {
      identifier: string,
      matchedActivities: number,
      averageDistance: number
    },
    progression: Array<{
      id: number,
      name: string,
      date: string,
      distance: number,
      pace: string,
      paceSeconds: number,
      duration: number,
      elevation: number,
      heartRate?: number
    }>,
    summary: {
      totalRuns: number,
      bestPace: string,
      worstPace: string,
      averagePace: string,
      improvement: number,      // percentage
      improvementSeconds: number,
      trend: "improving" | "declining" | "stable",
      dateRange: { first: string, last: string }
    }
  }
  ```
- **Use for**: Route-specific progression, "How am I improving on [route]?", "Track performance on this route"
- **Faster than**: fetch_activities + route matching + progression analysis + chart
- **Views**: Progression chart with best/worst/average performances
- **Behavior**: Fetches activities, matches route (by name or polyline), calculates progression

### Tool: `exchange_strava_code`
- **Purpose**: Exchange Strava authorization code for access token
- **Input**: `{ code: string }`
- **Output**: `{ access_token: string, refresh_token: string, expires_at: number, athlete: {...} }`
- **Use for**: Initial authorization, token refresh
- **Behavior**: Exchanges authorization code for access token via Strava OAuth2 flow

---

## Orchestration Patterns

### Pattern 1: Integrated Widget (Fast Path)
```
User: "How's my training?"
→ get_training_summary (single call, complete UI)
```

### Pattern 2: Data Tool + Visualization (Flexible Path)
```
User: "Show me pace vs elevation"
→ analyze_elevation_impact (get data)
→ Transform in GPT to [{x: elevation, y: pace}]
→ render_scatter_plot (visualize)
```

### Pattern 3: Data Tool + Reasoning (Analysis Path)
```
User: "What's my acute:chronic ratio?"
→ compute_training_load (get metrics)
→ GPT reasons about the ratio
→ Provide interpretation
```

See [GPT Orchestration Guide](docs/GPT_ORCHESTRATION_GUIDE.md) for complete patterns and decision framework.

---

## Implementation Notes

### Testing Strategy

The app uses a comprehensive testing approach with three types of tests:

1. **Unit Tests** - Test individual functions and utilities in isolation
2. **Integration Tests** - Test complete user flows from auth to visualization
3. **Widget Tests** - Test UI components and design system usage

**Test Files:**
- `server/src/errors.test.ts` - Error handling tests (13 tests)
- `server/src/server.test.ts` - Server and widget registration tests (3 tests)
- `server/src/integration.test.ts` - Complete user flow tests (18 tests)

**Running Tests:**
```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode for development
```

See [Testing Guide](docs/TESTING_GUIDE.md) for detailed testing patterns and best practices.

### Key Calculations (LLM-driven)

- Weekly volume (total km)
- Average pace (min/km)
- Consistency (number of runs)
- Week-over-week changes (% increase/decrease)
- Recovery indicators (days between runs, pace variation)
- Training load trends (volume × intensity proxy)

### OAuth Flow

1. User initiates connection in ChatGPT
2. App redirects to Strava authorization page
3. User grants permissions
4. Strava redirects back with authorization code
5. App exchanges code for access token + refresh token
6. Tokens stored in user context for session duration

---

## Success Criteria

- User can connect Strava account via OAuth2
- User can ask natural language questions about their training
- App provides clear, coach-like insights based on real Strava data
- Responses are encouraging, actionable, and concise
- No technical errors or rate limit issues during demo
- Conversation feels natural and helpful, not robotic or data-dumpy

---

## Implementation Status

### Completed Features

#### ✅ Layered Architecture (Tasks 1-21)

The app implements a complete three-layer architecture:

**Layer 1: Data Tools (5 tools)**
- `fetch_activities` - Fetch raw Strava activities with configurable detail
- `get_run_comparison` - Compare two specific runs side-by-side
- `calculate_pace_distribution` - Analyze pace patterns by run type or distance
- `analyze_elevation_impact` - Calculate pace adjustments for elevation
- `compute_training_load` - Calculate acute/chronic load and injury risk

**Layer 2: Visualization Widgets (5 widgets)**
- `render_line_chart` - Time series visualization with multiple series
- `render_scatter_plot` - Two-dimensional relationships with color coding
- `render_comparison_card` - Side-by-side comparison with deltas
- `render_heatmap` - Calendar heatmap for activity patterns
- `render_distribution` - Box plots and histograms for metric analysis

**Layer 3: Integrated Widgets (4 widgets)**
- `get_training_summary` - Weekly stats with runs list and insights
- `compare_training_weeks` - Week-over-week comparison with trends
- `get_coaching_advice` - Training load analysis with recommendations
- `analyze_run_progression` - Route-specific performance tracking

#### ✅ Design System

Shared design system ensures visual consistency:
- Glassmorphism effects with standardized values
- Predefined gradient palette (4 gradients)
- Semantic color coding (improvement/decline/stable)
- Consistent spacing, borders, and shadows
- Runner-appropriate unit formatting

See [Design System Documentation](docs/DESIGN_SYSTEM.md)

#### ✅ Error Handling

Comprehensive error handling across all layers:
- 401 Unauthorized detection with re-auth guidance
- 429 Rate limit detection with retry suggestions
- Missing optional data handling (HR, GPS, splits)
- Graceful degradation when visualizations fail
- Clear error messages with actionable next steps

See [Error Handling Documentation](docs/ERROR_HANDLING.md)

#### ✅ Caching

Conversation-context caching for performance:
- Cache key generation (user + date range + detail level)
- Cache hit detection and reuse
- Metadata tracking (cached vs fresh data)
- Reduces API calls and improves response time

#### ✅ Testing

Comprehensive test suite with 34 tests:
- 13 error handling tests
- 3 server/widget registration tests
- 18 integration tests covering complete user flows

Test coverage includes:
- Auth → Data Tool → Visualization flows
- GPT orchestration patterns
- Fallback paths and error handling
- Caching behavior
- Design system consistency
- Data validation and completeness

See [Testing Guide](docs/TESTING_GUIDE.md)

#### ✅ Documentation

Complete documentation for developers:
- [SPEC.md](SPEC.md) - Product specification and architecture
- [GPT Orchestration Guide](docs/GPT_ORCHESTRATION_GUIDE.md) - Tool selection patterns
- [Design System Documentation](docs/DESIGN_SYSTEM.md) - Visual consistency guide
- [Error Handling Documentation](docs/ERROR_HANDLING.md) - Error patterns and responses
- [Testing Guide](docs/TESTING_GUIDE.md) - Testing patterns and best practices

### Architecture Benefits

**Flexibility**: GPT can compose any data tool with any visualization for custom analysis

**Performance**: Integrated widgets provide fast paths for common queries (80% case)

**Consistency**: Shared design system ensures cohesive visual experience

**Reliability**: Comprehensive error handling and fallback paths

**Maintainability**: Clear separation of concerns, well-tested, fully documented

### Future Enhancements

See "Future Extensions (Post-MVP)" section above for planned features including:
- Route generator with maps
- Weather-aware recommendations
- Training plan suggestions
- Race preparation advice
- Comparative insights
