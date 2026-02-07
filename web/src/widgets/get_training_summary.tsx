import { generateHelpers } from "skybridge/web";
import type { AppType } from "../../../server/src/server";
import { DesignSystem, applyGradientText, createGradientOverlay } from "../design-system";
import { ErrorBoundary } from "../ErrorBoundary";

const { useToolInfo } = generateHelpers<AppType>();

function TrainingSummaryContent() {
  const toolInfo = useToolInfo<"get_training_summary">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact, animation: "pulse 2s ease-in-out infinite" }}>🏃‍♂️</div>
        <p style={{ color: DesignSystem.colors.semantic.stable, margin: 0, fontSize: "14px" }}>Loading your training data...</p>
      </div>
    );
  }

  if (!toolInfo.isSuccess) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>⚠️</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>Error loading training data</p>
      </div>
    );
  }

  const { period, stats, runs } = toolInfo.output as any;

  // Debug: log what we're getting
  console.log("Widget data:", { period, stats, runs });

  // Safety check - graceful degradation for missing data
  if (!stats || !period) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>⚠️</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>
          No training data available
        </p>
        <p style={{ margin: 0, marginTop: DesignSystem.spacing.compact, color: "rgba(0, 0, 0, 0.5)", fontSize: "12px" }}>
          This may be due to missing data from Strava or an incomplete response.
        </p>
      </div>
    );
  }

  // Handle missing optional fields with defaults
  const safeStats = {
    totalDistance: stats.totalDistance ?? 0,
    totalRuns: stats.totalRuns ?? 0,
    avgPace: stats.avgPace ?? "0:00",
    totalTime: stats.totalTime ?? 0,
  };

  const safeRuns = Array.isArray(runs) ? runs : [];

  return (
    <div style={{ 
      maxWidth: "640px",
      margin: "0 auto",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
    }}>
      <div style={{ 
        background: "white",
        borderRadius: DesignSystem.borderRadius.card, 
        padding: DesignSystem.spacing.card,
        border: "1px solid #e5e7eb",
        boxShadow: DesignSystem.shadows.card,
        position: "relative" as const,
        overflow: "hidden" as const
      }}>
        {/* Subtle gradient overlay */}
        <div style={{
          ...createGradientOverlay(DesignSystem.colors.gradients.primary, 0.03),
          height: "200px",
        }} />

        {/* Header */}
        <div style={{ position: "relative" as const, marginBottom: DesignSystem.spacing.card }}>
          <div style={{ display: "flex", alignItems: "center", gap: DesignSystem.spacing.compact, marginBottom: DesignSystem.spacing.compact }}>
            <div style={{ 
              width: "8px", 
              height: "8px", 
              borderRadius: "50%", 
              background: DesignSystem.colors.semantic.improvement,
              boxShadow: `0 0 12px ${DesignSystem.colors.semantic.improvement}99`
            }} />
            <span style={{ 
              fontSize: "11px", 
              fontWeight: "600", 
              color: "rgba(0, 0, 0, 0.5)",
              textTransform: "uppercase" as const,
              letterSpacing: "1px"
            }}>
              Training Summary
            </span>
          </div>
          <p style={{ color: "rgba(0, 0, 0, 0.4)", fontSize: "13px", margin: 0 }}>
            📅 {period.start} → {period.end}
          </p>
        </div>

        {/* Stats Grid with glassmorphism */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: DesignSystem.spacing.element,
          marginBottom: DesignSystem.spacing.card,
          position: "relative" as const
        }}>
          {[
            { value: safeStats.totalDistance, label: "km total", gradient: DesignSystem.colors.gradients.primary },
            { value: safeStats.totalRuns, label: "runs", gradient: DesignSystem.colors.gradients.secondary },
            { value: safeStats.avgPace, label: "avg pace /km", gradient: DesignSystem.colors.gradients.tertiary },
            { value: safeStats.totalTime, label: "minutes", gradient: DesignSystem.colors.gradients.quaternary }
          ].map((stat, i) => (
            <div key={i} style={{ 
              padding: DesignSystem.spacing.section, 
              background: "#f8f9fa",
              backdropFilter: DesignSystem.glassmorphism.backdropBlur,
              borderRadius: DesignSystem.borderRadius.element,
              border: DesignSystem.glassmorphism.border,
              position: "relative" as const,
              overflow: "hidden" as const,
              transition: "all 0.3s ease"
            }}>
              <div style={createGradientOverlay(stat.gradient)} />
              <div style={{ position: "relative" as const }}>
                <div style={{ 
                  fontSize: "36px", 
                  fontWeight: "700", 
                  marginBottom: "4px",
                  ...applyGradientText(stat.gradient)
                }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: "11px", color: "rgba(0, 0, 0, 0.5)", fontWeight: "500" }}>
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Runs */}
        {safeRuns.length > 0 && (
          <div style={{ position: "relative" as const }}>
            <h3 style={{ 
              fontSize: "13px", 
              fontWeight: "600", 
              marginBottom: DesignSystem.spacing.element, 
              color: "rgba(0, 0, 0, 0.6)",
              textTransform: "uppercase" as const,
              letterSpacing: "0.5px"
            }}>
              Recent Activity
            </h3>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: DesignSystem.spacing.compact }}>
              {safeRuns.slice(0, 5).map((run: any, i: number) => (
                <div
                  key={i}
                  style={{
                    padding: `${DesignSystem.spacing.element} 20px`,
                    background: "#f3f4f6",
                    backdropFilter: DesignSystem.glassmorphism.backdropBlur,
                    borderRadius: DesignSystem.borderRadius.small,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "13px",
                    border: DesignSystem.glassmorphism.border,
                    transition: "all 0.2s ease"
                  }}
                >
                  <span style={{ fontWeight: "600", color: "rgba(0, 0, 0, 0.7)" }}>
                    {run.date ?? "Unknown date"}
                  </span>
                  <span style={{ 
                    color: "rgba(0, 0, 0, 0.5)", 
                    fontSize: "12px",
                    fontFamily: "ui-monospace, monospace"
                  }}>
                    {run.distance ?? "0"}km • {run.pace ?? "0:00"}/km • {run.duration ?? "0"}min
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrainingSummary() {
  return (
    <ErrorBoundary widgetName="get_training_summary">
      <TrainingSummaryContent />
    </ErrorBoundary>
  );
}
