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

### Widget: `get_training_summary`
- **Input**: `{ days?: number }` (default: 7)
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
- **Views**: Single view showing stats card with runs list
- **Behavior**: Fetches recent Strava activities, displays summary with coaching insights

### Widget: `compare_training_weeks`
- **Input**: `{ currentWeekStart?: string }` (defaults to current week)
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
- **Views**: Side-by-side comparison with trend indicators (↑↓)
- **Behavior**: Fetches last 2 weeks of activities, calculates deltas and trends

### Widget: `get_coaching_advice`
- **Input**: `{ context?: string }` (optional: "recovery", "intensity", etc.)
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
- **Views**: Single card with recommendation and reasoning
- **Behavior**: Analyzes recent training load, provides actionable next-step advice

### Tool: `refresh_strava_data`
- **Input**: `{ forceRefresh?: boolean }`
- **Output**: `{ success: boolean, lastSync: string }`
- **Purpose**: Manually refresh Strava data if needed (widgets can call this internally)

---

## Implementation Notes

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
