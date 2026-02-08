import "@/index.css";
import { generateHelpers, mountWidget } from "skybridge/web";
import type { AppType } from "../../../server/src/server";
import {
  DesignSystem,
  applyGlassmorphism,
  createGradientOverlay,
} from "../design-system";
import { ErrorBoundary } from "../ErrorBoundary";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const { useToolInfo } = generateHelpers<AppType>();

interface DataPoint {
  x: string | number;
  y: number;
  series?: Record<string, number>;
}

interface AxisConfig {
  label: string;
  unit?: string;
}

interface ChartConfig {
  title?: string;
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  colors?: string[];
  showLegend?: boolean;
  seriesNames?: string[];
}

function RenderLineChartContent() {
  const toolInfo = useToolInfo<"render_line_chart">();

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
          📈
        </div>
        <p
          style={{
            color: DesignSystem.colors.semantic.stable,
            margin: 0,
            fontSize: "14px",
          }}
        >
          Loading chart...
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
          Error loading chart
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
          No chart data available
        </p>
      </div>
    );
  }

  const { data, config } = toolInfo.output as {
    data: DataPoint[];
    config?: ChartConfig;
  };

  // Graceful degradation: handle missing or invalid data
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>📊</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>
          No data available to display
        </p>
        <p style={{ margin: 0, marginTop: DesignSystem.spacing.compact, color: "rgba(0, 0, 0, 0.5)", fontSize: "12px" }}>
          The chart requires data points to render. Please provide valid data.
        </p>
      </div>
    );
  }

  // Transform data for Recharts
  const chartData = data.map((point) => {
    const transformed: Record<string, any> = {
      x: point.x,
      primary: point.y,
    };

    // Add additional series if present
    if (point.series) {
      Object.entries(point.series).forEach(([key, value]) => {
        transformed[key] = value;
      });
    }

    return transformed;
  });

  // Determine all series keys
  const seriesKeys = ["primary"];
  if (data.length > 0 && data[0].series) {
    seriesKeys.push(...Object.keys(data[0].series));
  }

  // Get colors from config or use design system defaults
  const colors = config?.colors || [
    "#667eea", // Primary gradient color
    "#f5576c", // Secondary gradient color
    "#00f2fe", // Tertiary gradient color
    "#38f9d7", // Quaternary gradient color
  ];

  // Get series names from config or use keys
  const seriesNames = config?.seriesNames || seriesKeys.map((key) => 
    key === "primary" ? (config?.yAxis?.label || "Value") : key
  );

  // Format Y-axis values based on unit
  const formatYAxis = (value: number): string => {
    const unit = config?.yAxis?.unit;
    
    if (unit === "min/km") {
      // Convert seconds to pace format
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
    
    return value.toString();
  };

  // Format X-axis values
  const formatXAxis = (value: string | number): string => {
    const unit = config?.xAxis?.unit;
    
    if (unit === "date") {
      // Format date strings
      if (typeof value === "string") {
        const date = new Date(value);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
    } else if (unit === "km") {
      return `${value}km`;
    }
    
    return value.toString();
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

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
            fontSize: "12px",
            fontWeight: "600",
            color: "rgba(0, 0, 0, 0.7)",
          }}
        >
          {formatXAxis(label)}
        </p>
        {payload.map((entry: any, index: number) => (
          <p
            key={index}
            style={{
              margin: 0,
              fontSize: "11px",
              color: entry.color,
              fontWeight: "500",
            }}
          >
            {seriesNames[index]}: {formatYAxis(entry.value)}
            {config?.yAxis?.unit && ` ${config.yAxis.unit}`}
          </p>
        ))}
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
              DesignSystem.colors.gradients.primary,
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
                  background: colors[0],
                  boxShadow: `0 0 12px ${colors[0]}99`,
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
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(0, 0, 0, 0.1)"
                vertical={false}
              />
              <XAxis
                dataKey="x"
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
              <Tooltip content={<CustomTooltip />} />
              {(config?.showLegend !== false) && (
                <Legend
                  wrapperStyle={{
                    fontSize: "12px",
                    paddingTop: "20px",
                  }}
                  formatter={(_value, _entry, index) => seriesNames[index]}
                />
              )}
              {seriesKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{
                    fill: colors[index % colors.length],
                    strokeWidth: 2,
                    r: 4,
                  }}
                  activeDot={{
                    r: 6,
                    strokeWidth: 0,
                  }}
                  name={seriesNames[index]}
                />
              ))}
            </LineChart>
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
          </div>
        )}
      </div>
    </div>
  );
}


export default function RenderLineChart() {
  return (
    <ErrorBoundary widgetName="render_line_chart">
      <RenderLineChartContent />
    </ErrorBoundary>
  );
}

mountWidget(<RenderLineChart />);
