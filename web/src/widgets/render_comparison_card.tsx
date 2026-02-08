import "@/index.css";
import { generateHelpers, mountWidget } from "skybridge/web";
import type { AppType } from "../../../server/src/server";
import {
  DesignSystem,
  applyGradientText,
  createGradientOverlay,
  getTrendIcon,
  getSemanticColor,
  getSemanticBackground,
  applyGlassmorphism,
} from "../design-system";

const { useToolInfo } = generateHelpers<AppType>();

interface RunData {
  id: number;
  name: string;
  date: string;
  distance: number;
  pace: string;
  duration: number;
  elevation: number;
  heartRate?: number;
}

interface Deltas {
  distance: number; // percentage
  pace: number; // seconds per km
  elevation: number; // meters
  heartRate?: number; // bpm
}

interface RunComparison {
  run1: RunData;
  run2: RunData;
  deltas: Deltas;
  trend: "improving" | "declining" | "stable";
}

export default function RenderComparisonCard() {
  const toolInfo = useToolInfo<"render_comparison_card">();

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
          Loading comparison...
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
          Error loading comparison
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
          No comparison data available
        </p>
      </div>
    );
  }

  const { data, config } = toolInfo.output as {
    data: RunComparison;
    config?: {
      title?: string;
      showTrendBadge?: boolean;
    };
  };

  const { run1, run2, deltas, trend } = data;

  const getTrendConfig = () => {
    if (trend === "improving")
      return {
        color: DesignSystem.colors.semantic.improvement,
        bg: getSemanticBackground(1, false),
        label: "Improving",
      };
    if (trend === "declining")
      return {
        color: DesignSystem.colors.semantic.decline,
        bg: getSemanticBackground(-1, false),
        label: "Declining",
      };
    return {
      color: DesignSystem.colors.semantic.stable,
      bg: getSemanticBackground(0, false),
      label: "Stable",
    };
  };

  const trendConfig = getTrendConfig();

  return (
    <div
      style={{
        maxWidth: "640px",
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
            height: "200px",
          }}
        />

        {/* Header with Trend Badge */}
        <div
          style={{
            position: "relative" as const,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: DesignSystem.spacing.card,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: DesignSystem.spacing.compact,
                marginBottom: DesignSystem.spacing.compact,
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: trendConfig.color,
                  boxShadow: `0 0 12px ${trendConfig.color}99`,
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: "600",
                  color: "rgba(0, 0, 0, 0.5)",
                  textTransform: "uppercase" as const,
                  letterSpacing: "1px",
                }}
              >
                {config?.title || "Run Comparison"}
              </span>
            </div>
          </div>
          {(config?.showTrendBadge !== false) && (
            <div
              style={{
                padding: `${DesignSystem.spacing.compact} ${DesignSystem.spacing.element}`,
                background: trendConfig.bg,
                backdropFilter: DesignSystem.glassmorphism.backdropBlur,
                color: trendConfig.color,
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: "700",
                textTransform: "uppercase" as const,
                letterSpacing: "1px",
                border: `1px solid ${trendConfig.color}33`,
              }}
            >
              {trendConfig.label}
            </div>
          )}
        </div>

        {/* Side-by-side Run Comparison */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: DesignSystem.spacing.element,
            marginBottom: DesignSystem.spacing.card,
            position: "relative" as const,
          }}
        >
          {/* Run 1 */}
          <div
            style={{
              padding: DesignSystem.spacing.section,
              background: "rgba(255, 255, 255, 0.3)",
              backdropFilter: DesignSystem.glassmorphism.backdropBlur,
              borderRadius: DesignSystem.borderRadius.element,
              border: DesignSystem.glassmorphism.border,
              position: "relative" as const,
              overflow: "hidden" as const,
            }}
          >
            <div
              style={{
                ...createGradientOverlay(
                  `linear-gradient(135deg, ${DesignSystem.colors.semantic.stable} 0%, transparent 100%)`,
                  0.05
                ),
              }}
            />
            <div style={{ position: "relative" as const }}>
              <div
                style={{
                  fontSize: "10px",
                  color: "rgba(0, 0, 0, 0.4)",
                  marginBottom: DesignSystem.spacing.compact,
                  fontWeight: "600",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.5px",
                }}
              >
                Run 1
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: DesignSystem.spacing.compact,
                  color: "rgba(0, 0, 0, 0.8)",
                }}
              >
                {run1.name}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "rgba(0, 0, 0, 0.5)",
                  marginBottom: DesignSystem.spacing.element,
                }}
              >
                📅 {run1.date}
              </div>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  marginBottom: "4px",
                  color: "rgba(0, 0, 0, 0.7)",
                }}
              >
                {run1.distance}
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "500",
                    marginLeft: "4px",
                    color: "rgba(0, 0, 0, 0.4)",
                  }}
                >
                  km
                </span>
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "rgba(0, 0, 0, 0.5)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {run1.pace}/km • {run1.duration}min
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "rgba(0, 0, 0, 0.4)",
                  marginTop: DesignSystem.spacing.compact,
                }}
              >
                ⛰️ {run1.elevation}m
                {run1.heartRate && ` • ❤️ ${run1.heartRate} bpm`}
              </div>
            </div>
          </div>

          {/* Run 2 */}
          <div
            style={{
              padding: DesignSystem.spacing.section,
              background: "rgba(255, 255, 255, 0.4)",
              backdropFilter: DesignSystem.glassmorphism.backdropBlur,
              borderRadius: DesignSystem.borderRadius.element,
              border: DesignSystem.glassmorphism.border,
              position: "relative" as const,
              overflow: "hidden" as const,
              boxShadow: "0 8px 24px rgba(102, 126, 234, 0.15)",
            }}
          >
            <div
              style={{
                ...createGradientOverlay(
                  DesignSystem.colors.gradients.primary,
                  0.1
                ),
              }}
            />
            <div style={{ position: "relative" as const }}>
              <div
                style={{
                  fontSize: "10px",
                  color: "rgba(102, 126, 234, 0.7)",
                  marginBottom: DesignSystem.spacing.compact,
                  fontWeight: "600",
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.5px",
                }}
              >
                Run 2
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  marginBottom: DesignSystem.spacing.compact,
                  ...applyGradientText(DesignSystem.colors.gradients.primary),
                }}
              >
                {run2.name}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "rgba(102, 126, 234, 0.7)",
                  marginBottom: DesignSystem.spacing.element,
                }}
              >
                📅 {run2.date}
              </div>
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  marginBottom: "4px",
                  ...applyGradientText(DesignSystem.colors.gradients.primary),
                }}
              >
                {run2.distance}
                <span style={{ fontSize: "14px", fontWeight: "500", marginLeft: "4px" }}>
                  km
                </span>
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "rgba(102, 126, 234, 0.8)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {run2.pace}/km • {run2.duration}min
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "rgba(102, 126, 234, 0.7)",
                  marginTop: DesignSystem.spacing.compact,
                }}
              >
                ⛰️ {run2.elevation}m
                {run2.heartRate && ` • ❤️ ${run2.heartRate} bpm`}
              </div>
            </div>
          </div>
        </div>

        {/* Deltas */}
        <div style={{ position: "relative" as const }}>
          <h3
            style={{
              fontSize: "13px",
              fontWeight: "600",
              marginBottom: DesignSystem.spacing.element,
              color: "rgba(0, 0, 0, 0.6)",
              textTransform: "uppercase" as const,
              letterSpacing: "0.5px",
            }}
          >
            Changes
          </h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column" as const,
              gap: "10px",
            }}
          >
            {/* Distance Delta */}
            <div
              style={{
                padding: `${DesignSystem.spacing.element} 20px`,
                background: getSemanticBackground(deltas.distance),
                backdropFilter: DesignSystem.glassmorphism.backdropBlur,
                borderRadius: DesignSystem.borderRadius.small,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: `1px solid ${getSemanticColor(deltas.distance)}22`,
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "rgba(0, 0, 0, 0.7)",
                }}
              >
                Distance
              </span>
              <span
                style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  color: getSemanticColor(deltas.distance),
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {getTrendIcon(deltas.distance)} {Math.abs(deltas.distance)}%
              </span>
            </div>

            {/* Pace Delta (inverted - negative is better) */}
            <div
              style={{
                padding: `${DesignSystem.spacing.element} 20px`,
                background: getSemanticBackground(-deltas.pace),
                backdropFilter: DesignSystem.glassmorphism.backdropBlur,
                borderRadius: DesignSystem.borderRadius.small,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: `1px solid ${getSemanticColor(-deltas.pace)}22`,
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "rgba(0, 0, 0, 0.7)",
                }}
              >
                Pace
              </span>
              <span
                style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  color: getSemanticColor(-deltas.pace),
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {getTrendIcon(-deltas.pace)} {Math.abs(deltas.pace)}s/km
              </span>
            </div>

            {/* Elevation Delta */}
            <div
              style={{
                padding: `${DesignSystem.spacing.element} 20px`,
                background: getSemanticBackground(deltas.elevation),
                backdropFilter: DesignSystem.glassmorphism.backdropBlur,
                borderRadius: DesignSystem.borderRadius.small,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: `1px solid ${getSemanticColor(deltas.elevation)}22`,
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "rgba(0, 0, 0, 0.7)",
                }}
              >
                Elevation
              </span>
              <span
                style={{
                  fontSize: "20px",
                  fontWeight: "700",
                  color: getSemanticColor(deltas.elevation),
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {getTrendIcon(deltas.elevation)} {Math.abs(deltas.elevation)}m
              </span>
            </div>

            {/* Heart Rate Delta (if available) */}
            {deltas.heartRate !== undefined && (
              <div
                style={{
                  padding: `${DesignSystem.spacing.element} 20px`,
                  background: getSemanticBackground(-deltas.heartRate),
                  backdropFilter: DesignSystem.glassmorphism.backdropBlur,
                  borderRadius: DesignSystem.borderRadius.small,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: `1px solid ${getSemanticColor(-deltas.heartRate)}22`,
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: "500",
                    color: "rgba(0, 0, 0, 0.7)",
                  }}
                >
                  Heart Rate
                </span>
                <span
                  style={{
                    fontSize: "20px",
                    fontWeight: "700",
                    color: getSemanticColor(-deltas.heartRate),
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {getTrendIcon(-deltas.heartRate)} {Math.abs(deltas.heartRate)} bpm
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

mountWidget(<RenderComparisonCard />);
