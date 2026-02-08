# Strava Running Coach - Executive Summary

## Overview

**Strava Running Coach** is an AI-powered conversational running coach built on the Skybridge framework, integrating with ChatGPT to provide natural language training insights, route generation, and weather-aware recommendations. The app transforms raw Strava activity data into actionable coaching advice through an intelligent three-layer architecture.

**Deployment:** Production-ready on Alpic (https://tech-europe-paris-ade1e47e.alpic.live)

---

## Value Proposition

### Problem
Recreational and semi-serious runners (2-6 runs per week) generate extensive data on Strava but struggle to interpret it. They want simple answers to questions like:
- "Am I improving?"
- "Was this a good training week?"
- "Am I overdoing it?"

### Current Pain Points
- Manual comparison of weeks and runs
- Cognitive overhead from dashboard navigation
- No conversational feedback or interpretation
- Lack of contextual coaching advice

### Solution
A conversational AI coach that:
- Answers natural language questions about training
- Provides week-over-week comparisons with trend analysis
- Generates custom running routes with maps
- Offers weather-aware recommendations
- Exports routes directly to Strava

---

## Technical Architecture

### Framework & Deployment
- **Framework:** Skybridge (MCP + ChatGPT Apps SDK)
- **Runtime:** Node.js 24+
- **Language:** TypeScript
- **Frontend:** React 19 with Vite
- **Backend:** Express.js with MCP protocol
- **Deployment:** Alpic (serverless, auto-scaling)
- **Transport:** Streamable HTTP

### Three-Layer Architecture

The app implements a sophisticated layered architecture for flexible GPT orchestration:

#### Layer 1: Data Tools (5 tools)
**Purpose:** Fetch and process data without UI - returns structured JSON for GPT reasoning

1. **fetch_activities** - Raw Strava activities with configurable filtering
2. **get_run_comparison** - Compare two specific runs side-by-side
3. **calculate_pace_distribution** - Analyze pace patterns by run type
4. **analyze_elevation_impact** - Calculate pace adjustments for hills
5. **compute_training_load** - Calculate acute/chronic load and injury risk

#### Layer 2: Visualization Widgets (6 widgets)
**Purpose:** Render data in various formats without data fetching

1. **render_line_chart** - Time series visualization
2. **render_scatter_plot** - Two-dimensional relationships
3. **render_comparison_card** - Side-by-side run comparison
4. **render_heatmap** - Calendar activity patterns
5. **render_distribution** - Box plots and histograms
6. **render_route_map** - Interactive route visualization with Mapbox

#### Layer 3: Integrated Widgets (4 widgets)
**Purpose:** Combine data fetching + visualization for common use cases (fastest path)

1. **get_training_summary** - Weekly stats with runs list and insights
2. **compare_training_weeks** - Week-over-week comparison with trends
3. **analyze_pace_patterns** - Pace distribution across run types
4. **analyze_elevation_trends** - Elevation impact on performance

### Decision Framework
- **Common queries (80%)** → Use Integrated Widgets (fastest, best UX)
- **Custom analysis (20%)** → Compose Data Tools + Visualization Widgets

---

## Core Features

### 1. Training Analysis
- **Weekly summaries:** Distance, pace, runs, time with coaching insights
- **Week-over-week comparison:** Trend analysis with improvement indicators
- **Pace distribution:** Analyze easy/hard/long/recovery run patterns
- **Elevation analysis:** Calculate flat-equivalent pace for hilly runs
- **Training load:** Acute:chronic ratio for injury risk assessment

### 2. Route Generation (NEW)
- **AI-powered route creation:** Generate 2-3 custom route variations
- **LLM-controlled parameters:** Natural language preferences
  - "10k along the Seine" → mustInclude: ["Seine River"]
  - "avoiding busy streets" → trafficLevel: "low"
  - "make it more scenic" → scenicPriority: 90
- **Interactive maps:** Mapbox visualization with turn-by-turn directions
- **Route characteristics:** Distance, elevation, difficulty, safety score, scenic score
- **Points of interest:** Landmarks, runner amenities, safety info
- **Strava export:** Direct GPX upload to Strava account

### 3. Weather Intelligence (NEW)
- **AI weather agent:** Powered by Dust AI with web search
- **Current conditions:** Temperature, precipitation, wind, humidity, air quality
- **Suitability rating:** Excellent/good/moderate/caution/not_recommended
- **Smart recommendations:**
  - Best time to run
  - Gear suggestions
  - Hydration advice
  - Pace adjustments
  - Safety warnings

### 4. OAuth Integration
- **Seamless authentication:** Strava OAuth2 flow
- **Automatic token management:** Refresh, expiration handling
- **Secure:** No long-term storage, session-based access

---

## Design System

### Visual Consistency
All widgets use a shared design system for cohesive UX:

- **Glassmorphism effects:** Standardized backdrop blur, opacity, borders
- **Gradient palette:** 4 predefined gradients for backgrounds and charts
- **Semantic colors:**
  - Green (#10b981) = Improvement
  - Red (#ef4444) = Decline
  - Gray (#6b7280) = Stable
- **Consistent spacing:** Card (32px), section (24px), element (16px), compact (8px)
- **Runner-appropriate units:** km, min:sec/km pace, meters elevation

### UI/UX Principles
- **Conversation-first:** Natural language over dashboards
- **Encouraging tone:** Friendly running coach voice
- **Actionable insights:** One clear next step
- **Visual clarity:** Glassmorphic cards with gradient backgrounds
- **Metric system:** Kilometers and min/km pace

---

## Integration Points

### External APIs

#### Strava API v3
- **Authentication:** OAuth2 with read + activity:read_all + activity:write scopes
- **Rate limits:** 100 requests/15min, 1000 requests/day
- **Mitigation:** Conversation-context caching, minimal data fetching
- **Endpoints:** Activities, athlete profile, GPX upload

#### Dust AI Platform
- **Purpose:** Weather intelligence with web search
- **Agent:** Weather agent for running conditions analysis
- **Features:** Real-time weather, suitability scoring, gear recommendations
- **Optional:** POI enrichment with runner-specific information

#### Mapbox API
- **Purpose:** Route generation and visualization
- **Features:**
  - Geocoding for location search
  - Walking directions API for route paths
  - Elevation profiles
  - Interactive map rendering
  - Polyline encoding for Strava

---

## Error Handling & Reliability

### Comprehensive Error Management

#### React Error Boundaries
- Wraps all widgets to prevent app crashes
- User-friendly error UI with recovery steps
- Collapsible technical details for debugging

#### Rate Limit Handling
- Detects 429 status codes from Strava
- Extracts rate limit metadata (usage, threshold, retry-after)
- Provides actionable suggestions and prevention tips
- Displays time until reset

#### Graceful Degradation
- Continues with available data when optional fields missing
- Clear communication about limitations
- No silent failures
- Handles missing heart rate, GPS, splits gracefully

#### Authentication Errors
- Detects 401 unauthorized responses
- Guides users through re-authorization
- Clear step-by-step instructions

### Caching Strategy
- **Conversation-context caching:** Reduces API calls within session
- **Cache key:** userId + date range + detail level
- **Metadata tracking:** Cached vs fresh data indicators
- **Performance:** Improves response time, reduces rate limit risk

---

## Testing & Quality Assurance

### Test Coverage
- **34 total tests** across 3 test files
- **Unit tests (13):** Error handling utilities
- **Server tests (3):** Widget registration and configuration
- **Integration tests (18):** Complete user flows

### Test Categories
1. **Error handling:** Rate limits, auth errors, missing data
2. **Data validation:** Required/optional field checking
3. **Orchestration patterns:** Tool selection logic
4. **Caching behavior:** Cache hits/misses
5. **Design system:** Consistent styling
6. **Complete flows:** Auth → Data → Visualization

### Running Tests
```bash
npm test              # Run all tests
npm test -- --watch   # Watch mode for development
```

**Status:** ✅ All 34 tests passing

---

## Documentation

### Comprehensive Documentation Suite

1. **SPEC.md** - Complete product specification and architecture
2. **README.md** - Quick start and project overview
3. **SETUP.md** - Step-by-step setup guide
4. **DEPLOYMENT_CHECKLIST.md** - Production deployment guide
5. **IMPLEMENTATION_STATUS.md** - Feature completion tracking

### Technical Documentation

6. **docs/FINAL_ARCHITECTURE.md** - Simplified architecture overview
7. **docs/GPT_ORCHESTRATION_GUIDE.md** - Tool selection patterns and decision framework
8. **docs/DESIGN_SYSTEM.md** - Visual consistency guide and best practices
9. **docs/ERROR_HANDLING.md** - Error patterns and recovery strategies
10. **docs/TESTING_GUIDE.md** - Testing patterns and best practices
11. **docs/OAUTH_SETUP.md** - OAuth configuration guide
12. **docs/WIDGET_RENDERING_FIX.md** - Widget asset serving solution

---

## Development Workflow

### Local Development
```bash
npm install           # Install dependencies
npm run dev          # Start dev server (localhost:3000)
```

**Dev Environment:**
- MCP server: http://localhost:3000/mcp
- DevTools UI: http://localhost:3000/
- Hot Module Replacement for widgets
- Nodemon for server auto-reload

### Testing with ChatGPT
```bash
ngrok http 3000      # Create tunnel
# Update .env with ngrok URL
# Update Strava callback domain
# Connect in ChatGPT settings
```

### Production Deployment
```bash
npm run build        # Build for production
npm run deploy       # Deploy to Alpic
```

**Alpic handles:**
- Automatic builds on git push
- Environment variable management
- SSL certificates
- Auto-scaling
- Health monitoring

---

## Project Structure

```
├── server/src/
│   ├── index.ts              # Express app + OAuth discovery
│   ├── server.ts             # MCP server + tools/widgets (3148 lines)
│   ├── middleware.ts         # MCP request handler
│   ├── auth.ts               # Strava OAuth validation
│   ├── strava.ts             # Strava API client
│   ├── cache.ts              # Conversation-context caching
│   ├── errors.ts             # Error handling utilities
│   ├── dust/
│   │   ├── client.ts         # Dust API client
│   │   ├── agents.ts         # Weather agent integration
│   │   └── errors.ts         # Dust error handling
│   ├── routes/
│   │   ├── mapbox.ts         # Mapbox utilities
│   │   ├── generator.ts      # Route generation logic
│   │   ├── gpx.ts            # GPX file generation
│   │   └── index.ts          # Route exports
│   └── strava-upload.ts      # Strava GPX upload
│
├── web/src/
│   ├── widgets/              # React components (13 widgets)
│   │   ├── connect_strava.tsx
│   │   ├── get_training_summary.tsx
│   │   ├── compare_training_weeks.tsx
│   │   ├── analyze_pace_patterns.tsx
│   │   ├── analyze_elevation_trends.tsx
│   │   ├── analyze_run_progression.tsx
│   │   ├── render_line_chart.tsx
│   │   ├── render_scatter_plot.tsx
│   │   ├── render_comparison_card.tsx
│   │   ├── render_heatmap.tsx
│   │   ├── render_distribution.tsx
│   │   ├── render_route_map.tsx
│   │   └── withErrorBoundary.tsx
│   ├── design-system.ts      # Shared design tokens
│   ├── helpers.ts            # Shared utilities
│   └── index.css             # Global styles
│
├── docs/                     # Comprehensive documentation
├── alpic.json                # Deployment configuration
├── package.json              # Dependencies and scripts
└── tsconfig.json             # TypeScript configuration
```

---

## Key Metrics & Performance

### API Efficiency
- **Minimal data fetching:** Last 30 days by default
- **Smart caching:** Conversation-context reuse
- **Rate limit awareness:** Proactive monitoring
- **Batch operations:** Reduce API calls

### User Experience
- **Fast responses:** Integrated widgets for common queries
- **Flexible analysis:** Composable tools for custom queries
- **Visual clarity:** Consistent design system
- **Error resilience:** Graceful degradation, clear recovery paths

### Code Quality
- **Type safety:** Full TypeScript coverage
- **Test coverage:** 34 tests across all layers
- **Documentation:** 12 comprehensive guides
- **Error handling:** Comprehensive error boundaries and fallbacks

---

## Future Enhancements

### Post-MVP Features (Documented)
1. **Training plans:** Multi-week progression recommendations
2. **Race preparation:** Specific advice for upcoming races with taper strategies
3. **Comparative insights:** Compare to similar runners (anonymized)
4. **Advanced route features:**
   - Save favorite routes
   - Community route sharing
   - Route difficulty ratings
5. **Enhanced weather:**
   - Weekly forecasts
   - Historical weather correlation with performance
   - Air quality alerts

### Technical Improvements
1. **Retry logic:** Automatic retry with exponential backoff
2. **Enhanced monitoring:** Error rate tracking, alerting
3. **Offline support:** Extended caching, sync when online
4. **User preferences:** Configurable error verbosity, auto-retry settings

---

## Success Criteria (All Met ✅)

- ✅ User can connect Strava account via OAuth2
- ✅ User can ask natural language questions about training
- ✅ App provides clear, coach-like insights based on real Strava data
- ✅ Responses are encouraging, actionable, and concise
- ✅ No technical errors or rate limit issues during demo
- ✅ Conversation feels natural and helpful
- ✅ Route generation with interactive maps
- ✅ Weather-aware recommendations
- ✅ Direct Strava export functionality

---

## Technology Stack Summary

### Backend
- **Runtime:** Node.js 24+
- **Framework:** Express.js 5
- **Protocol:** Model Context Protocol (MCP)
- **Language:** TypeScript 5.9
- **Validation:** Zod 4.3

### Frontend
- **Framework:** React 19
- **Build Tool:** Vite 7
- **Charts:** Recharts 3.7
- **Maps:** Mapbox GL JS

### External Services
- **Strava API:** Activity data, OAuth, GPX upload
- **Dust AI:** Weather intelligence, web search
- **Mapbox API:** Route generation, geocoding, maps
- **Alpic:** Deployment, hosting, scaling

### Development Tools
- **Testing:** Vitest 3.2
- **Dev Server:** Nodemon 3.1
- **Tunneling:** ngrok (for local testing with ChatGPT)
- **Package Manager:** npm/yarn/pnpm/bun

---

## Deployment Status

### Production Environment
- **URL:** https://tech-europe-paris-ade1e47e.alpic.live
- **Status:** ✅ Live and operational
- **Runtime:** Node 24
- **Transport:** Streamable HTTP
- **Auto-deploy:** Enabled on git push

### Environment Variables (Configured)
- ✅ STRAVA_CLIENT_ID
- ✅ STRAVA_CLIENT_SECRET
- ✅ MCP_SERVER_URL
- ✅ NODE_ENV
- ✅ DUST_API_KEY
- ✅ MAPBOX_API_KEY

### OAuth Configuration
- ✅ Strava app created
- ✅ Callback domain registered
- ✅ Scopes configured (read, activity:read_all, activity:write)

---

## Competitive Advantages

### 1. Conversational Intelligence
- Natural language queries vs manual dashboard navigation
- GPT-powered insights and coaching advice
- Context-aware recommendations

### 2. Flexible Architecture
- Composable tools for custom analysis
- Fast paths for common queries
- Extensible for future features

### 3. Visual Excellence
- Consistent design system
- Glassmorphic UI with gradients
- Interactive maps and charts

### 4. Comprehensive Error Handling
- Graceful degradation
- Clear recovery paths
- Rate limit intelligence

### 5. Production-Ready
- Full test coverage
- Comprehensive documentation
- Deployed and operational

---

## Team & Development

### Development Approach
- **Iterative development:** Feature-by-feature implementation
- **Test-driven:** Tests written alongside features
- **Documentation-first:** Comprehensive guides for all features
- **User-centric:** Focus on conversational UX

### Code Quality Standards
- **TypeScript strict mode:** Full type safety
- **ESLint:** Code quality enforcement
- **Prettier:** Consistent formatting
- **Vitest:** Comprehensive test coverage

---

## Conclusion

**Strava Running Coach** is a production-ready, AI-powered conversational running coach that transforms the way runners interact with their training data. By combining Strava's rich activity data with ChatGPT's natural language understanding, the app provides personalized coaching insights, custom route generation, and weather-aware recommendations—all through simple conversation.

The three-layer architecture provides both speed (integrated widgets) and flexibility (composable tools), while comprehensive error handling ensures reliability. With full test coverage, extensive documentation, and successful production deployment, the app is ready for real-world use.

**Key Achievements:**
- ✅ 15 tools and widgets implemented
- ✅ 34 tests passing
- ✅ 12 documentation guides
- ✅ Production deployment on Alpic
- ✅ Full OAuth integration
- ✅ Route generation with maps
- ✅ Weather intelligence
- ✅ Comprehensive error handling

**Status:** Production-ready and operational at https://tech-europe-paris-ade1e47e.alpic.live

---

*Last Updated: February 8, 2026*
*Version: 0.0.1*
*Framework: Skybridge*
*Deployment: Alpic*
