import { generateHelpers } from "skybridge/web";
import type { AppType } from "../../../server/src/server";
import {
  DesignSystem,
  applyGlassmorphism,
  createGradientOverlay,
} from "../design-system";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const { useToolInfo } = generateHelpers<AppType>();

interface DistributionConfig {
  title?: string;
  type: "box" | "histogram";
  metricLabel?: string;
  unit?: string;
  binCount?: number;
  showOutliers?: boolean;
  color?: string;
}

// Calculate quartiles and outliers for box plot
function calculateBoxPlotStats(data: number[]) {
  const sorted = [...data].sort((a, b) => a - b);
  const n = sorted.length;

  if (n === 0) {
    return {
      min: 0,
      q1: 0,
      median: 0,
      q3: 0,
      max: 0,
      outliers: [],
    };
  }

  // Calculate quartiles
  const q1Index = Math.floor(n * 0.25);
  const medianIndex = Math.floor(n * 0.5);
  const q3Index = Math.floor(n * 0.75);

  const q1 = sorted[q1Index];
  const median = n % 2 === 0 
    ? (sorted[medianIndex - 1] + sorted[medianIndex]) / 2 
    : sorted[medianIndex];
  const q3 = sorted[q3Index];

  // Calculate IQR and outlier bounds
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // Find outliers
  const outliers = sorted.filter(v => v < lowerBound || v > upperBound);

  // Find min/max excluding outliers
  const nonOutliers = sorted.filter(v => v >= lowerBound && v <= upperBound);
  const min = nonOutliers.length > 0 ? nonOutliers[0] : sorted[0];
  const max = nonOutliers.length > 0 ? nonOutliers[nonOutliers.length - 1] : sorted[sorted.length - 1];

  return {
    min,
    q1,
    median,
    q3,
    max,
    outliers,
    iqr,
    lowerBound,
    upperBound,
  };
}

// Calculate histogram bins
function calculateHistogram(data: number[], binCount: number = 10) {
  if (data.length === 0) {
    return [];
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const binWidth = (max - min) / binCount;

  // Initialize bins
  const bins = Array.from({ length: binCount }, (_, i) => ({
    start: min + i * binWidth,
    end: min + (i + 1) * binWidth,
    count: 0,
    label: "",
  }));

  // Count values in each bin
  data.forEach(value => {
    const binIndex = Math.min(
      Math.floor((value - min) / binWidth),
      binCount - 1
    );
    bins[binIndex].count++;
  });

  // Create labels
  bins.forEach(bin => {
    bin.label = `${bin.start.toFixed(1)}-${bin.end.toFixed(1)}`;
  });

  return bins;
}

export default function RenderDistribution() {
  const toolInfo = useToolInfo<"render_distribution">();

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
          Loading distribution...
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
          Error loading distribution
        </p>
      </div>
    );
  }

  const { data, config } = toolInfo.output as {
    data: number[];
    config: DistributionConfig;
  };

  // Get color from config or use design system default
  const primaryColor = config.color || "#667eea";

  // Format value based on unit
  const formatValue = (value: number | undefined): string => {
    if (value === undefined) return "N/A";
    
    const unit = config.unit;
    
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

  // Render box plot
  const renderBoxPlot = () => {
    const stats = calculateBoxPlotStats(data);
    const showOutliers = config.showOutliers !== false;

    // Calculate scale for visualization
    const allValues = showOutliers 
      ? [stats.min, stats.max, ...stats.outliers]
      : [stats.min, stats.max];
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue;
    const padding = range * 0.1;

    // Convert value to pixel position
    const valueToX = (value: number) => {
      const chartWidth = 600;
      const margin = 50;
      const availableWidth = chartWidth - 2 * margin;
      return margin + ((value - minValue + padding) / (range + 2 * padding)) * availableWidth;
    };

    const boxHeight = 60;
    const centerY = 150;

    return (
      <div
        style={{
          position: "relative" as const,
          height: "300px",
          width: "100%",
        }}
      >
        <svg width="100%" height="300" viewBox="0 0 700 300">
          {/* Whisker line (min to max) */}
          <line
            x1={valueToX(stats.min)}
            y1={centerY}
            x2={valueToX(stats.max)}
            y2={centerY}
            stroke="rgba(0, 0, 0, 0.3)"
            strokeWidth="2"
          />

          {/* Min whisker */}
          <line
            x1={valueToX(stats.min)}
            y1={centerY - 15}
            x2={valueToX(stats.min)}
            y2={centerY + 15}
            stroke="rgba(0, 0, 0, 0.5)"
            strokeWidth="2"
          />

          {/* Max whisker */}
          <line
            x1={valueToX(stats.max)}
            y1={centerY - 15}
            x2={valueToX(stats.max)}
            y2={centerY + 15}
            stroke="rgba(0, 0, 0, 0.5)"
            strokeWidth="2"
          />

          {/* Box (Q1 to Q3) */}
          <rect
            x={valueToX(stats.q1)}
            y={centerY - boxHeight / 2}
            width={valueToX(stats.q3) - valueToX(stats.q1)}
            height={boxHeight}
            fill={primaryColor}
            fillOpacity="0.3"
            stroke={primaryColor}
            strokeWidth="2"
            rx="4"
          />

          {/* Median line */}
          <line
            x1={valueToX(stats.median)}
            y1={centerY - boxHeight / 2}
            x2={valueToX(stats.median)}
            y2={centerY + boxHeight / 2}
            stroke={primaryColor}
            strokeWidth="3"
          />

          {/* Outliers */}
          {showOutliers && stats.outliers.map((outlier, i) => (
            <circle
              key={i}
              cx={valueToX(outlier)}
              cy={centerY}
              r="4"
              fill={DesignSystem.colors.semantic.decline}
              opacity="0.7"
            />
          ))}

          {/* Labels */}
          <text
            x={valueToX(stats.min)}
            y={centerY + 50}
            textAnchor="middle"
            fontSize="11"
            fill="rgba(0, 0, 0, 0.6)"
          >
            Min: {formatValue(stats.min)}
          </text>
          <text
            x={valueToX(stats.q1)}
            y={centerY + 50}
            textAnchor="middle"
            fontSize="11"
            fill="rgba(0, 0, 0, 0.6)"
          >
            Q1: {formatValue(stats.q1)}
          </text>
          <text
            x={valueToX(stats.median)}
            y={centerY - boxHeight / 2 - 10}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill={primaryColor}
          >
            Median: {formatValue(stats.median)}
          </text>
          <text
            x={valueToX(stats.q3)}
            y={centerY + 50}
            textAnchor="middle"
            fontSize="11"
            fill="rgba(0, 0, 0, 0.6)"
          >
            Q3: {formatValue(stats.q3)}
          </text>
          <text
            x={valueToX(stats.max)}
            y={centerY + 50}
            textAnchor="middle"
            fontSize="11"
            fill="rgba(0, 0, 0, 0.6)"
          >
            Max: {formatValue(stats.max)}
          </text>
        </svg>

        {/* Statistics summary */}
        <div
          style={{
            marginTop: DesignSystem.spacing.section,
            padding: DesignSystem.spacing.element,
            background: "rgba(0, 0, 0, 0.02)",
            borderRadius: DesignSystem.borderRadius.small,
            fontSize: "12px",
            color: "rgba(0, 0, 0, 0.7)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: DesignSystem.spacing.compact,
          }}
        >
          <div>
            <strong>IQR:</strong> {formatValue(stats.iqr)}
            {config.unit && ` ${config.unit}`}
          </div>
          <div>
            <strong>Range:</strong> {formatValue(stats.max - stats.min)}
            {config.unit && ` ${config.unit}`}
          </div>
          <div>
            <strong>Data points:</strong> {data.length}
          </div>
          {showOutliers && stats.outliers.length > 0 && (
            <div>
              <strong>Outliers:</strong> {stats.outliers.length}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render histogram
  const renderHistogram = () => {
    const binCount = config.binCount || 10;
    const bins = calculateHistogram(data, binCount);

    // Prepare data for Recharts
    const chartData = bins.map(bin => ({
      label: bin.label,
      count: bin.count,
      start: bin.start,
      end: bin.end,
    }));

    // Custom tooltip
    const CustomTooltip = ({ active, payload }: any) => {
      if (!active || !payload || payload.length === 0) return null;

      const bin = payload[0].payload;

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
            }}
          >
            Range: {formatValue(bin.start)} - {formatValue(bin.end)}
            {config.unit && ` ${config.unit}`}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: primaryColor,
              fontWeight: "600",
            }}
          >
            Count: {bin.count}
          </p>
        </div>
      );
    };

    return (
      <div
        style={{
          position: "relative" as const,
          height: "400px",
          width: "100%",
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(0, 0, 0, 0.1)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              stroke="rgba(0, 0, 0, 0.4)"
              style={{ fontSize: "11px" }}
              angle={-45}
              textAnchor="end"
              height={80}
              label={
                config.metricLabel
                  ? {
                      value: config.metricLabel + (config.unit ? ` (${config.unit})` : ""),
                      position: "insideBottom",
                      offset: -50,
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
              stroke="rgba(0, 0, 0, 0.4)"
              style={{ fontSize: "12px" }}
              label={{
                value: "Frequency",
                angle: -90,
                position: "insideLeft",
                style: {
                  fontSize: "12px",
                  fill: "rgba(0, 0, 0, 0.6)",
                  fontWeight: "500",
                },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
              {chartData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={primaryColor} opacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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
              DesignSystem.colors.gradients.quaternary,
              0.03
            ),
            height: "120px",
          }}
        />

        {/* Header */}
        {config.title && (
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
                  background: primaryColor,
                  boxShadow: `0 0 12px ${primaryColor}99`,
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

        {/* Visualization */}
        <div style={{ position: "relative" as const }}>
          {config.type === "box" ? renderBoxPlot() : renderHistogram()}
        </div>

        {/* Metric info */}
        {config.metricLabel && (
          <div
            style={{
              position: "relative" as const,
              marginTop: DesignSystem.spacing.section,
              padding: DesignSystem.spacing.element,
              background: "rgba(0, 0, 0, 0.02)",
              borderRadius: DesignSystem.borderRadius.small,
              fontSize: "11px",
              color: "rgba(0, 0, 0, 0.5)",
            }}
          >
            <strong>Metric:</strong> {config.metricLabel}
            {config.unit && ` (${config.unit})`}
            {" • "}
            <strong>Type:</strong> {config.type === "box" ? "Box Plot" : "Histogram"}
            {" • "}
            <strong>Samples:</strong> {data.length}
          </div>
        )}
      </div>
    </div>
  );
}
