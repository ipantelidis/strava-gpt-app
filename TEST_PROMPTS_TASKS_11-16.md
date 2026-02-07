# Test Prompts for Tasks 11-16: Visualization Widgets

## Prerequisites
Before testing, ensure you have:
1. A valid Strava access token (use `exchange_strava_code` if needed)
2. The server running (`npm run dev`)
3. Access to ChatGPT with the Strava Running Coach app connected

---

## Task 11: Render Comparison Card Widget

### Test 1: Basic Comparison Card
```
Show me a comparison card for two sample runs with these details:

Run 1: "Morning Easy Run" on 2024-01-15, 10km in 50 minutes (5:00/km pace), 100m elevation
Run 2: "Morning Easy Run" on 2024-01-22, 10.5km in 48 minutes (4:34/km pace), 120m elevation

The trend is improving with a 5% distance increase, 26 seconds faster pace, and 20m more elevation.
```

### Test 2: Comparison with Heart Rate
```
Create a comparison card showing:

Run 1: "Tempo Run" - 8km, 4:45/km, 150 bpm average HR
Run 2: "Tempo Run" - 8km, 4:50/km, 155 bpm average HR

Trend: declining (slower pace, higher heart rate)
```

---

## Task 12: Render Line Chart Widget

### Test 1: Pace Progression Over Time
```
Show me a line chart of my pace progression over the last 30 days. 
Use dates on the x-axis and pace (min/km) on the y-axis.
Title it "Pace Progression - Last 30 Days"
```

### Test 2: Multiple Series Line Chart
```
Create a line chart showing both distance and elevation gain for my last 10 runs.
Use run number on x-axis, and show two series:
- Distance in km (blue)
- Elevation in meters (green)
Title: "Distance vs Elevation - Last 10 Runs"
```

### Test 3: Heart Rate Trend
```
Plot my average heart rate over my last 15 runs as a line chart.
X-axis: Run date
Y-axis: Heart rate (bpm)
Title: "Heart Rate Trend"
```

---

## Task 13: Render Scatter Plot Widget

### Test 1: Distance vs Pace Relationship
```
Create a scatter plot showing the relationship between distance and pace for my last 30 runs.
X-axis: Distance (km)
Y-axis: Pace (min/km)
Add a trend line and title it "Distance vs Pace Analysis"
```

### Test 2: Elevation vs Heart Rate
```
Show me a scatter plot of elevation gain vs average heart rate for my runs.
Color code by run type if possible (easy, tempo, long).
X-axis: Elevation gain (m)
Y-axis: Average HR (bpm)
```

### Test 3: Pace vs Heart Rate Efficiency
```
Create a scatter plot to analyze my running efficiency:
X-axis: Average pace (min/km)
Y-axis: Average heart rate (bpm)
Title: "Pace-HR Efficiency Analysis"
```

---

## Task 14: Render Heatmap Widget

### Test 1: Activity Frequency Heatmap
```
Show me a calendar heatmap of my running activity for the last 90 days.
Use color intensity to show:
- No activity: light gray
- Short run (<5km): light green
- Medium run (5-15km): medium green
- Long run (>15km): dark green
```

### Test 2: Training Load Heatmap
```
Create a heatmap showing my training load intensity over the past 60 days.
Map the intensity based on total weekly distance.
Include tooltips showing the actual distance for each day.
```

### Test 3: Consistency Heatmap
```
Display a heatmap of my running consistency for the last 3 months.
Show which days of the week I typically run.
Use color gradient from white (no runs) to purple (multiple runs).
```

---

## Task 15: Render Distribution Widget

### Test 1: Pace Distribution (Histogram)
```
Show me a histogram of my pace distribution for the last 50 runs.
Use 10 bins and label it "Pace Distribution Analysis"
X-axis: Pace (min/km)
Y-axis: Frequency
```

### Test 2: Distance Distribution (Box Plot)
```
Create a box plot showing the distribution of my run distances over the last 60 days.
Show outliers and label it "Distance Distribution"
Unit: km
```

### Test 3: Heart Rate Distribution (Histogram)
```
Display a histogram of my average heart rate distribution.
Use 12 bins, unit: bpm
Title: "Heart Rate Distribution - Last 30 Runs"
Show the median and quartiles.
```

### Test 4: Elevation Distribution (Box Plot)
```
Show me a box plot of elevation gain distribution for my runs.
Include outliers and statistics.
Unit: meters
Title: "Elevation Gain Distribution"
```

---

## Task 16: Checkpoint - Integration Tests

### Test 1: End-to-End Flow (Data Tool → Visualization)
```
1. Fetch my last 30 days of activities
2. Calculate the pace distribution
3. Show it as a histogram with 8 bins
```

### Test 2: Multiple Visualizations
```
For my last 20 runs:
1. Show a line chart of pace over time
2. Show a scatter plot of distance vs pace
3. Show a box plot of the pace distribution
```

### Test 3: Comparison Flow
```
1. Get my two most recent runs
2. Compare them using the comparison card
3. Show a line chart of my pace progression over the last 10 runs
```

### Test 4: Complex Analysis
```
Analyze my training over the last 60 days:
1. Show a heatmap of my activity frequency
2. Create a histogram of my pace distribution
3. Display a scatter plot of distance vs elevation
4. Show a line chart of my weekly mileage trend
```

### Test 5: Design System Consistency Check
```
Create three different visualizations and verify they all use consistent:
- Glassmorphism effects
- Color gradients from the design system
- Spacing and border radius
- Typography and shadows

Show:
1. A comparison card
2. A line chart
3. A box plot
```

---

## Expected Behaviors to Verify

### Visual Consistency (All Widgets)
- [ ] All widgets use glassmorphism effects (backdrop blur, transparency)
- [ ] Gradient overlays match design system colors
- [ ] Border radius is consistent (24px for cards, 16px for elements)
- [ ] Spacing follows design system (32px card padding, 24px sections)
- [ ] Shadows are consistent across all cards

### Functional Requirements

#### Comparison Card (Task 11)
- [ ] Shows both runs side-by-side
- [ ] Displays delta indicators with correct signs
- [ ] Shows trend arrows (↑ improving, ↓ declining, → stable)
- [ ] Uses semantic colors (green for improvement, red for decline)
- [ ] Handles optional heart rate data gracefully

#### Line Chart (Task 12)
- [ ] Renders all data points
- [ ] Supports multiple series overlays
- [ ] Formats axes with runner-appropriate units
- [ ] Shows legend when multiple series present
- [ ] Handles date and numeric x-axis values

#### Scatter Plot (Task 13)
- [ ] Plots all data points correctly
- [ ] Supports color coding by category
- [ ] Shows trend line when requested
- [ ] Formats axes with proper units
- [ ] Handles tooltips on hover

#### Heatmap (Task 14)
- [ ] Displays calendar grid layout correctly
- [ ] Maps intensity to color gradient
- [ ] Shows tooltips with activity details
- [ ] Handles missing days (no activity)
- [ ] Covers requested date range

#### Distribution (Task 15)
- [ ] Box plot shows min, Q1, median, Q3, max
- [ ] Box plot identifies and displays outliers
- [ ] Histogram creates appropriate bins
- [ ] Histogram shows frequency distribution
- [ ] Formats values based on unit (pace, distance, HR)
- [ ] Shows statistics summary

### Error Handling
- [ ] Gracefully handles missing optional data (HR, GPS)
- [ ] Shows loading states while fetching
- [ ] Displays error messages clearly
- [ ] Falls back to text when visualization fails

---

## Notes for Testing

1. **Authentication**: If you get auth errors, run the authorization flow first
2. **Data Requirements**: Some tests require actual Strava data - adjust prompts based on your activity history
3. **Visual Inspection**: Check that all widgets maintain the glassmorphism aesthetic
4. **Performance**: Widgets should render in under 3 seconds
5. **Responsiveness**: Test on different screen sizes if possible

---

## Quick Test Commands

### Minimal Test (5 minutes)
```
1. Show me a comparison card for my last two runs
2. Create a line chart of my pace over the last 10 runs
3. Display a histogram of my pace distribution
```

### Comprehensive Test (15 minutes)
Run all tests in order from Tasks 11-15, then verify integration with Task 16 tests.

### Visual Consistency Test (3 minutes)
```
Create one of each visualization type and verify they all use the same design system:
- Comparison card
- Line chart
- Scatter plot
- Heatmap
- Box plot
```
