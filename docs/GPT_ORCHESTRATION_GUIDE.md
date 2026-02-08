# GPT Orchestration Guide

This guide explains how GPT should intelligently choose between integrated widgets, data tools, and visualization widgets to provide the best user experience.

## Architecture Overview

The Strava Running Coach app uses a **three-layer architecture**:

1. **Data Tools** - Fetch and process data (no UI)
2. **Visualization Widgets** - Render data in various formats (no data fetching)
3. **Integrated Widgets** - Combine data fetching + visualization for common use cases

## Decision Tree: Which Tool/Widget to Use?

### Step 1: Is this a common query?

**Common queries** → Use **Integrated Widgets** (fastest, best UX)

- "How's my training?" → `get_training_summary`
- "Am I improving?" → `compare_training_weeks`
- "What's my training load?" → `compute_training_load`
- "How am I improving on [route]?" → `analyze_run_progression`

**Custom/flexible queries** → Use **Data Tools + Visualization Widgets** (composable)

- "Show me pace vs elevation" → `fetch_activities` + `render_scatter_plot`
- "Visualize my training consistency" → `fetch_activities` + `render_heatmap`
- "Compare two specific runs" → `get_run_comparison` + `render_comparison_card`

### Step 2: Do I need data or visualization?

**Need data for reasoning** → Use **Data Tools**

- `fetch_activities` - Raw activity data
- `get_run_comparison` - Compare two runs
- `calculate_pace_distribution` - Pace statistics by group
- `analyze_elevation_impact` - Elevation-adjusted pace
- `compute_training_load` - Training load metrics

**Need to visualize existing data** → Use **Visualization Widgets**

- `render_line_chart` - Time series trends
- `render_scatter_plot` - Metric relationships
- `render_comparison_card` - Side-by-side comparison
- `render_heatmap` - Calendar activity view
- `render_distribution` - Box plots/histograms

## Tool Relationships

### Data Tool → Visualization Widget Flows

#### Flow 1: Activity Data → Line Chart
```
User: "Show me my pace progression over time"

1. fetch_activities(days=30, includeDetails=false)
2. Transform to [{x: date, y: pace}] in GPT
3. render_line_chart(data, config)
```

#### Flow 2: Activity Data → Heatmap
```
User: "Show me my training consistency"

1. fetch_activities(days=90)
2. Transform to [{date, intensity}] in GPT
3. render_heatmap(data, config)
```

#### Flow 3: Comparison Data → Comparison Card
```
User: "Compare my last two 10k runs"

1. fetch_activities(days=30) to get activity IDs
2. get_run_comparison(run1Id, run2Id)
3. render_comparison_card(data)
```

#### Flow 4: Pace Distribution → Box Plot
```
User: "Show me my pace distribution"

1. calculate_pace_distribution(days=30, groupBy="runType")
2. Extract pace values as array in GPT
3. render_distribution(data, config={type: "box"})
```

#### Flow 5: Elevation Analysis → Scatter Plot
```
User: "How does elevation affect my pace?"

1. analyze_elevation_impact(days=30)
2. Transform to [{x: elevation, y: pace}] in GPT
3. render_scatter_plot(data, config)
```

### Integrated Widget Shortcuts

These widgets combine data fetching + visualization for optimal performance:

#### get_training_summary
- **Replaces**: `fetch_activities` + manual stats calculation + UI rendering
- **Use for**: "How's my training?", "Summarize my week"
- **Returns**: Complete summary with stats, runs list, insights

#### compare_training_weeks
- **Replaces**: `fetch_activities` + date filtering + comparison logic + UI rendering
- **Use for**: "Am I improving?", "Compare this week to last week"
- **Returns**: Week-over-week comparison with deltas and trends

#### compute_training_load
- **Replaces**: Manual training load calculation
- **Use for**: "What's my training load?", "Calculate my acute:chronic ratio"
- **Returns**: Training state, load metrics, actionable advice

#### analyze_run_progression
- **Replaces**: `fetch_activities` + route matching + progression analysis + chart rendering
- **Use for**: "How am I improving on [route]?"
- **Returns**: Route progression with best/worst/average performances

## Example Query Mappings

### Training Overview Queries

| User Query | Tool/Widget | Reasoning |
|------------|-------------|-----------|
| "How's my training?" | `get_training_summary` | Common query, integrated widget is fastest |
| "Summarize my last 14 days" | `get_training_summary(days=14)` | Simple summary, use integrated widget |
| "Show me all my runs from last month" | `fetch_activities(days=30)` | Need raw data, not just summary |

### Comparison Queries

| User Query | Tool/Widget | Reasoning |
|------------|-------------|-----------|
| "Am I improving?" | `compare_training_weeks` | Common query, integrated widget |
| "Compare this week to last week" | `compare_training_weeks` | Week comparison, use integrated widget |
| "Compare my Monday run to Friday's run" | `fetch_activities` → `get_run_comparison` → `render_comparison_card` | Specific runs, need data tool + visualization |

### Analysis Queries

| User Query | Tool/Widget | Reasoning |
|------------|-------------|-----------|
| "What's my training load?" | `compute_training_load` | Need training load metrics |
| "What's my training load?" | `compute_training_load` | Need raw numbers for reasoning |
| "How does elevation affect my pace?" | `analyze_elevation_impact` → `render_scatter_plot` | Custom analysis, compose tools |

### Visualization Queries

| User Query | Tool/Widget | Reasoning |
|------------|-------------|-----------|
| "Show me my pace over time" | `fetch_activities` → `render_line_chart` | Time series visualization |
| "Visualize my training consistency" | `fetch_activities` → `render_heatmap` | Calendar visualization |
| "Show me my pace distribution" | `calculate_pace_distribution` → `render_distribution` | Distribution analysis |

## Best Practices

### 1. Prefer Integrated Widgets for Common Queries

✅ **Good**: User asks "How's my training?" → Use `get_training_summary`

❌ **Bad**: User asks "How's my training?" → Use `fetch_activities` + manual analysis

**Why**: Integrated widgets are faster, provide better UX, and handle common cases optimally.

### 2. Compose Data Tools + Visualizations for Custom Queries

✅ **Good**: User asks "Show me pace vs elevation" → `analyze_elevation_impact` + `render_scatter_plot`

❌ **Bad**: User asks "Show me pace vs elevation" → Try to force into `get_training_summary`

**Why**: Composable tools enable the long tail of custom queries without building 20+ specialized widgets.

### 3. Use Data Tools When You Need to Reason

✅ **Good**: User asks "What's my acute:chronic ratio?" → `compute_training_load` (returns raw numbers)

❌ **Bad**: User asks "Show me my training summary" → `compute_training_load` (use get_training_summary instead)

**Why**: Data tools return structured data that GPT can reason about and manipulate.

### 4. Chain Tools When Needed

✅ **Good**: User asks "Compare my last two 10k runs"
1. `fetch_activities` to get activity IDs
2. `get_run_comparison` with the IDs
3. `render_comparison_card` to visualize

❌ **Bad**: Try to do everything in one tool call

**Why**: Each tool has a specific purpose. Chain them for complex workflows.

### 5. Transform Data in GPT

✅ **Good**: 
1. `fetch_activities` returns raw activities
2. GPT transforms to `[{x: date, y: pace}]`
3. `render_line_chart` visualizes

❌ **Bad**: Expect data tools to return pre-formatted visualization data

**Why**: GPT is the orchestration layer. Data tools return structured data, GPT transforms it for visualization.

## Common Patterns

### Pattern 1: Summary → Detail Drill-Down

```
User: "How's my training?"
→ get_training_summary

User: "Show me more detail on my pace"
→ fetch_activities + render_line_chart
```

### Pattern 2: Data → Multiple Visualizations

```
User: "Analyze my last 30 days"

1. fetch_activities(days=30)
2. render_line_chart (pace over time)
3. render_heatmap (consistency calendar)
4. render_distribution (pace distribution)
```

### Pattern 3: Comparison Workflow

```
User: "Compare my performance on hilly vs flat runs"

1. fetch_activities(days=60)
2. analyze_elevation_impact(days=60)
3. Group by elevation in GPT
4. render_comparison_card or render_scatter_plot
```

## Error Handling

### Authentication Errors

All tools/widgets require authorization. To avoid repeatedly prompting for authentication:

**Best Practice: Use connect_strava at conversation start**
```
User: "Show me my training summary"

1. connect_strava() - checks auth and shows connect UI if needed
2. If authenticated → proceed with get_training_summary
3. If not authenticated → user clicks auth button, then retry
```

**Alternative: Use check_strava_auth for lightweight checks**
- Use `check_strava_auth` when you just need to verify auth status without showing UI
- Use `connect_strava` when you want to check AND provide the auth button if needed

**When to check auth:**
- At the start of a conversation (first data request) → use `connect_strava`
- After user completes OAuth flow (verify it worked) → use `check_strava_auth`
- Mid-conversation when unsure if token is still valid → use `check_strava_auth`

**Don't check auth:**
- On every single tool call (wasteful)
- After you just successfully fetched data (token is clearly working)

If auth fails during a tool call:

1. Detect 401 or missing token error
2. Call `connect_strava` to show auth UI
3. After auth, proceed with the original request

### Rate Limiting

If rate limit exceeded (429):

1. Suggest using cached data
2. Wait for rate limit reset
3. Avoid redundant API calls

### Missing Data

If optional data is missing (HR, GPS):

1. Continue with available data
2. Note limitations in response
3. Don't fail entire request

## Performance Considerations

### Caching

- Data tools cache results within conversation context
- Cache key: `userId + days + includeDetails`
- Reuse cached data when possible

### API Efficiency

- Fetch minimal data needed
- Use `includeDetails=false` unless splits/HR/GPS required
- Batch requests when possible

### Integrated Widgets vs Composed Flows

**Integrated widgets are faster** because they:
- Make fewer API calls
- Have optimized data fetching
- Skip GPT transformation steps

**Use integrated widgets for the 80% case, compose tools for the 20% long tail.**

## Summary

**Decision Framework**:

1. **Is it a common query?** → Use integrated widget
2. **Need raw data for reasoning?** → Use data tool
3. **Need to visualize data?** → Use visualization widget
4. **Custom analysis?** → Compose data tools + visualization widgets

**Key Principle**: Integrated widgets for speed, composable tools for flexibility.
