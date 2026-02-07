# Design System Documentation

## Overview

The Strava Running Coach app uses a shared design system to ensure visual consistency across all widgets and visualizations. This document describes the design system structure, usage patterns, and best practices for future development.

## Design System Structure

The design system is defined in `web/src/design-system.ts` and exports a single `DesignSystem` object with all design tokens.

### Colors

#### Gradients

Predefined gradient combinations for backgrounds and chart elements:

```typescript
DesignSystem.colors.gradients = {
  primary: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  secondary: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  tertiary: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  quaternary: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
}
```

**Usage:**
- `primary`: Main data series, primary UI elements
- `secondary`: Accent elements, secondary data series
- `tertiary`: Tertiary data series, cool-toned elements
- `quaternary`: Success states, positive trends

#### Semantic Colors

Color coding for trends and states:

```typescript
DesignSystem.colors.semantic = {
  improvement: "#10b981",  // Green - positive changes
  decline: "#ef4444",      // Red - negative changes
  stable: "#6b7280",       // Gray - neutral/stable
}
```

**Usage:**
- Use `improvement` for faster paces, increased distance, positive trends
- Use `decline` for slower paces, decreased performance, negative trends
- Use `stable` for minimal changes, neutral states

### Glassmorphism

Standardized glassmorphism effects for cards and containers:

```typescript
DesignSystem.glassmorphism = {
  backdropBlur: "blur(10px)",
  background: "rgba(255, 255, 255, 0.1)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
}
```

**Usage:**
Apply all three properties together for consistent glassmorphism:

```typescript
const cardStyle = {
  backdropFilter: DesignSystem.glassmorphism.backdropBlur,
  background: DesignSystem.glassmorphism.background,
  border: DesignSystem.glassmorphism.border,
};
```

### Spacing

Consistent spacing values for layout:

```typescript
DesignSystem.spacing = {
  card: "32px",      // Between cards
  section: "24px",   // Between sections within a card
  element: "16px",   // Between elements
  compact: "8px",    // Compact spacing
}
```

**Usage:**
- `card`: Margin/padding for card containers
- `section`: Spacing between major sections
- `element`: Standard spacing between UI elements
- `compact`: Tight spacing for related items

### Border Radius

Rounded corner values:

```typescript
DesignSystem.borderRadius = {
  card: "24px",      // Large cards
  element: "16px",   // Buttons, inputs
  small: "12px",     // Small elements
}
```

### Shadows

Elevation shadows:

```typescript
DesignSystem.shadows = {
  card: "0 20px 60px rgba(0, 0, 0, 0.08)",      // Card elevation
  element: "0 4px 12px rgba(0, 0, 0, 0.05)",    // Element elevation
}
```

## Usage Patterns

### Widget Development

When creating new widgets, always import and use the design system:

```typescript
import { DesignSystem } from "../design-system";

export function MyWidget({ data }: Props) {
  return (
    <div
      style={{
        background: DesignSystem.colors.gradients.primary,
        backdropFilter: DesignSystem.glassmorphism.backdropBlur,
        border: DesignSystem.glassmorphism.border,
        borderRadius: DesignSystem.borderRadius.card,
        padding: DesignSystem.spacing.card,
        boxShadow: DesignSystem.shadows.card,
      }}
    >
      {/* Widget content */}
    </div>
  );
}
```

### Chart Styling

For Recharts components, use design system colors:

```typescript
import { LineChart, Line } from "recharts";
import { DesignSystem } from "../design-system";

<LineChart data={data}>
  <Line
    type="monotone"
    dataKey="pace"
    stroke={DesignSystem.colors.gradients.primary}
    strokeWidth={3}
  />
</LineChart>
```

### Trend Indicators

Use semantic colors for trend visualization:

```typescript
const getTrendColor = (trend: "improving" | "declining" | "stable") => {
  switch (trend) {
    case "improving":
      return DesignSystem.colors.semantic.improvement;
    case "declining":
      return DesignSystem.colors.semantic.decline;
    case "stable":
      return DesignSystem.colors.semantic.stable;
  }
};

<div style={{ color: getTrendColor(trend) }}>
  {trend === "improving" ? "↑" : trend === "declining" ? "↓" : "→"}
</div>
```

## Best Practices

### DO:
- ✅ Always import and use `DesignSystem` constants
- ✅ Use semantic colors for trend indicators
- ✅ Apply all glassmorphism properties together
- ✅ Use consistent spacing values from the design system
- ✅ Reference gradients by name (primary, secondary, etc.)

### DON'T:
- ❌ Hard-code color values in components
- ❌ Create custom gradients outside the design system
- ❌ Use arbitrary spacing values
- ❌ Mix glassmorphism properties from different sources
- ❌ Use non-semantic colors for trends

## Unit Formatting

### Distance
- Always display in kilometers (km)
- Round to 1 decimal place: `5.2 km`

### Pace
- Always display as min:sec per km
- Format: `5:20/km` or `5:20`
- Pad seconds with leading zero: `5:05` not `5:5`

### Elevation
- Always display in meters (m)
- Round to whole numbers: `150m`

### Duration
- Display in minutes for short runs: `25 min`
- Display as hours:minutes for long runs: `1:45`

### Heart Rate
- Display in beats per minute (bpm): `150 bpm`

## Testing Design System Usage

When writing tests, verify design system usage:

```typescript
import { DesignSystem } from "../design-system";

it("should use design system colors", () => {
  const widget = render(<MyWidget />);
  const element = widget.getByTestId("card");
  
  expect(element.style.background).toBe(DesignSystem.colors.gradients.primary);
  expect(element.style.backdropFilter).toBe(DesignSystem.glassmorphism.backdropBlur);
});
```

## Extending the Design System

If you need to add new design tokens:

1. Add them to `web/src/design-system.ts`
2. Document them in this file
3. Update existing widgets to use the new tokens
4. Add tests to verify usage

Example:

```typescript
// In design-system.ts
export const DesignSystem = {
  // ... existing tokens
  typography: {
    heading: "24px",
    body: "16px",
    small: "14px",
  },
};
```

## Migration Guide

If you have existing widgets with hard-coded styles:

1. Import the design system:
   ```typescript
   import { DesignSystem } from "../design-system";
   ```

2. Replace hard-coded colors:
   ```typescript
   // Before
   background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
   
   // After
   background: DesignSystem.colors.gradients.primary
   ```

3. Replace hard-coded spacing:
   ```typescript
   // Before
   padding: "32px"
   
   // After
   padding: DesignSystem.spacing.card
   ```

4. Replace hard-coded glassmorphism:
   ```typescript
   // Before
   backdropFilter: "blur(10px)"
   background: "rgba(255, 255, 255, 0.1)"
   border: "1px solid rgba(255, 255, 255, 0.2)"
   
   // After
   backdropFilter: DesignSystem.glassmorphism.backdropBlur
   background: DesignSystem.glassmorphism.background
   border: DesignSystem.glassmorphism.border
   ```

## Examples

### Complete Widget Example

```typescript
import { DesignSystem } from "../design-system";

interface TrainingSummaryProps {
  stats: {
    totalDistance: number;
    totalRuns: number;
    avgPace: string;
  };
  trend: "improving" | "declining" | "stable";
}

export function TrainingSummary({ stats, trend }: TrainingSummaryProps) {
  return (
    <div
      style={{
        background: DesignSystem.colors.gradients.primary,
        backdropFilter: DesignSystem.glassmorphism.backdropBlur,
        border: DesignSystem.glassmorphism.border,
        borderRadius: DesignSystem.borderRadius.card,
        padding: DesignSystem.spacing.card,
        boxShadow: DesignSystem.shadows.card,
      }}
    >
      <h2 style={{ marginBottom: DesignSystem.spacing.section }}>
        Training Summary
      </h2>
      
      <div style={{ marginBottom: DesignSystem.spacing.element }}>
        <span>Distance: {stats.totalDistance} km</span>
      </div>
      
      <div style={{ marginBottom: DesignSystem.spacing.element }}>
        <span>Runs: {stats.totalRuns}</span>
      </div>
      
      <div style={{ marginBottom: DesignSystem.spacing.element }}>
        <span>Avg Pace: {stats.avgPace}/km</span>
      </div>
      
      <div
        style={{
          color: DesignSystem.colors.semantic[trend === "improving" ? "improvement" : trend === "declining" ? "decline" : "stable"],
          marginTop: DesignSystem.spacing.section,
        }}
      >
        {trend === "improving" ? "↑ Improving" : trend === "declining" ? "↓ Declining" : "→ Stable"}
      </div>
    </div>
  );
}
```

## Resources

- Design System Source: `web/src/design-system.ts`
- Widget Examples: `web/src/widgets/`
- Integration Tests: `server/src/integration.test.ts`
- GPT Orchestration Guide: `docs/GPT_ORCHESTRATION_GUIDE.md`
