import "@/index.css";
import { generateHelpers, mountWidget } from "skybridge/web";
import type { AppType } from "../../../server/src/server";
import {
  DesignSystem,
  applyGlassmorphism,
  createGradientOverlay,
} from "../design-system";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ZAxis,
} from "recharts";

const { useToolInfo } = generateHelpers<AppType>();

interface DataPoint {
  x: number;
  y: number;
  category?: string;
}

interface AxisConfig {
  label: string;
  unit?: string;
}

interface ScatterConfig {
  title?: string;
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  colors?: Record<string, string>;
  showTrendLine?: boolean;
  showLegend?: boolean;
}

export default function RenderScatterPlot() {
  const toolInfo = useToolInfo<"render_scatter_plot">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div
          style={{
            fontSize: "40px",
            marginBottom: DesignSystem.spacing.compact,
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          📊
        </div>
        <p
          style={{
            color: DesignSystem.colors.semantic.stable,
            margin: 0,
            fontSize: "14px",
          }}
        >
          Loading scatter plot...
        </p>
      </div>
    );
  }

  if (!toolInfo.isSuccess) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div
          style={{
            fontSize: "40px",
            marginBottom: DesignSystem.spacing.compact,
          }}
        >
          ⚠️
        </div>
        <p
          style={{
            margin: 0,
            color: DesignSystem.colors.semantic.decline,
            fontSize: "14px",
          }}
        >
          Error loading scatter plot
        </p>
      </div>
    );
  }

  // Safety check - ensure output exists before destructuring
  if (!toolInfo.output) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>📊</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>
          No scatter plot data available
        </p>
      </div>
    );
  }

  const { data, config } = toolInfo.output as {
    data: DataPoint[];
    config?: ScatterConfig;
  };

  // Group data by category if present
  const categories = new Set(data.map((d) => d.category || "default"));
  const categoryArray = Array.from(categories);

  // Default colors from design system
  const defaultColors: Record<string, string> = {
    default: "#667eea", // Primary gradient color
  };

  // Assign colors to categories
  const gradientColors = [
    "#667eea", // Primary
    "#f5576c", // Secondary
    "#00f2fe", // Tertiary
    "#38f9d7", // Quaternary
  ];

  categoryArray.forEach((cat, index) => {
    if (!defaultColors[cat]) {
      defaultColors[cat] = gradientColors[index % gradientColors.length];
    }
  });

  const colors = config?.colors || defaultColors;

  // Calculate trend line if requested
  let trendLineData: Array<{ x: number; y: number }> | null = null;
  
  if (config?.showTrendLine && data.length > 1) {
    // Simple linear regression
    const n = data.length;
    const sumX = data.reduce((sum, d) => sum + d.x, 0);
    const sumY = data.reduce((sum, d) => sum + d.y, 0);
    const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0);
    const sumX2 = data.reduce((sum, d) => sum + d.x * d.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate trend line points
    const xValues = data.map((d) => d.x).sort((a, b) => a - b);
    const minX = xValues[0];
    const maxX = xValues[xValues.length - 1];

    trendLineData = [
      { x: minX, y: slope * minX + intercept },
      { x: maxX, y: slope * maxX + intercept },
    ];
  }

  // Format axis values based on unit
  const formatYAxis = (value: number): string => {
    const unit = config?.yAxis?.unit;
    
    if (unit === "min/km") {
      const minutes = Math.floor(value / 60);
      const seconds = Math.round(value % 60);
      return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    } else if (unit === "km") {
      return `${value.toFixed(1)}`;
    } else if (unit === "m") {
      return `${Math.round(value)}`;
    } else if (unit === "bpm") {
      return `${Math.round(value)}`;
    }
    
    return value.toFixed(1);
  };

  const formatXAxis = (value: number): string => {
    const unit = config?.xAxis?.unit;
    
    if (unit === "km") {
      return `${value.toFixed(1)}`;
    } else if (unit === "m") {
      return `${Math.round(value)}`;
    } else if (unit === "bpm") {
      return `${Math.round(value)}`;
    }
    
    return value.toFixed(1);
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const point = payload[0].payload;

    return (
      <div
        style={{
          ...applyGlassmorphism(0.95),
          padding: DesignSystem.spacing.element,
          borderRadius: DesignSystem.borderRadius.small,
          boxShadow: DesignSystem.shadows.element,
        }}
      >
        <p
          style={{
            margin: 0,
            marginBottom: DesignSystem.spacing.compact,
            fontSize: "11px",
            fontWeight: "600",
            color: "rgba(0, 0, 0, 0.5)",
            textTransform: "uppercase" as const,
          }}
        >
          {point.category || "Data Point"}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            color: "rgba(0, 0, 0, 0.7)",
            fontWeight: "500",
          }}
        >
          <strong>X:</strong> {formatXAxis(point.x)}
          {config?.xAxis?.unit && ` ${config.xAxis.unit}`}
        </p>
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            color: "rgba(0, 0, 0, 0.7)",
            fontWeight: "500",
          }}
        >
          <strong>Y:</strong> {formatYAxis(point.y)}
          {config?.yAxis?.unit && ` ${config.yAxis.unit}`}
        </p>
      </div>
    );
  };

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
      }}
    >
      <div
        style={{
          ...applyGlassmorphism(0.02),
          borderRadius: DesignSystem.borderRadius.card,
          padding: DesignSystem.spacing.card,
          boxShadow: `${DesignSystem.shadows.card}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
          position: "relative" as const,
          overflow: "hidden" as const,
        }}
      >
        {/* Gradient overlay */}
        <div
          style={{
            ...createGradientOverlay(
              DesignSystem.colors.gradients.tertiary,
              0.03
            ),
            height: "120px",
          }}
        />

        {/* Header */}
        {config?.title && (
          <div
            style={{
              position: "relative" as const,
              marginBottom: DesignSystem.spacing.section,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: DesignSystem.spacing.compact,
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: colors[categoryArray[0]] || colors.default,
                  boxShadow: `0 0 12px ${colors[categoryArray[0]] || colors.default}99`,
                }}
              />
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "rgba(0, 0, 0, 0.8)",
                }}
              >
                {config.title}
              </h2>
            </div>
          </div>
        )}

        {/* Chart */}
        <div
          style={{
            position: "relative" as const,
            height: "400px",
            width: "100%",
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(0, 0, 0, 0.1)"
                vertical={false}
              />
              <XAxis
                type="number"
                dataKey="x"
                name={config?.xAxis?.label || "X"}
                tickFormatter={formatXAxis}
                stroke="rgba(0, 0, 0, 0.4)"
                style={{ fontSize: "12px" }}
                label={
                  config?.xAxis?.label
                    ? {
                        value: config.xAxis.label,
                        position: "insideBottom",
                        offset: -5,
                        style: {
                          fontSize: "12px",
                          fill: "rgba(0, 0, 0, 0.6)",
                          fontWeight: "500",
                        },
                      }
                    : undefined
                }
              />
              <YAxis
                type="number"
                dataKey="y"
                name={config?.yAxis?.label || "Y"}
                tickFormatter={formatYAxis}
                stroke="rgba(0, 0, 0, 0.4)"
                style={{ fontSize: "12px" }}
                label={
                  config?.yAxis?.label
                    ? {
                        value: config.yAxis.label,
                        angle: -90,
                        position: "insideLeft",
                        style: {
                          fontSize: "12px",
                          fill: "rgba(0, 0, 0, 0.6)",
                          fontWeight: "500",
                        },
                      }
                    : undefined
                }
              />
              <ZAxis range={[60, 60]} />
              <Tooltip content={<CustomTooltip />} />
              {(config?.showLegend !== false) && categoryArray.length > 1 && (
                <Legend
                  wrapperStyle={{
                    fontSize: "12px",
                    paddingTop: "20px",
                  }}
                />
              )}
              
              {/* Render scatter points by category */}
              {categoryArray.map((category) => {
                const categoryData = data.filter(
                  (d) => (d.category || "default") === category
                );
                return (
                  <Scatter
                    key={category}
                    name={category}
                    data={categoryData}
                    fill={colors[category] || colors.default}
                    shape="circle"
                  />
                );
              })}

              {/* Trend line */}
              {trendLineData && (
                <Scatter
                  name="Trend"
                  data={trendLineData}
                  fill="rgba(0, 0, 0, 0.3)"
                  line={{ stroke: "rgba(0, 0, 0, 0.3)", strokeWidth: 2 }}
                  shape={() => null}
                  legendType="line"
                />
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Axis labels info */}
        {(config?.xAxis || config?.yAxis) && (
          <div
            style={{
              position: "relative" as const,
              marginTop: DesignSystem.spacing.section,
              padding: DesignSystem.spacing.element,
              background: "rgba(0, 0, 0, 0.02)",
              borderRadius: DesignSystem.borderRadius.small,
              fontSize: "11px",
              color: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              gap: DesignSystem.spacing.element,
              flexWrap: "wrap" as const,
            }}
          >
            {config.xAxis && (
              <span>
                <strong>X-axis:</strong> {config.xAxis.label}
                {config.xAxis.unit && ` (${config.xAxis.unit})`}
              </span>
            )}
            {config.yAxis && (
              <span>
                <strong>Y-axis:</strong> {config.yAxis.label}
                {config.yAxis.unit && ` (${config.yAxis.unit})`}
              </span>
            )}
            {config.showTrendLine && (
              <span>
                <strong>Trend line:</strong> Linear regression
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

mountWidget(<RenderScatterPlot />);
