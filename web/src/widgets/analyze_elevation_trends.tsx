import "@/index.css";
import { generateHelpers, mountWidget } from "skybridge/web";
import type { AppType } from "../../../server/src/server";
import { DesignSystem } from "../design-system";

const { useToolInfo } = generateHelpers<AppType>();

export default function AnalyzeElevationTrends() {
  const toolInfo = useToolInfo<"analyze_elevation_trends">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact, animation: "pulse 2s ease-in-out infinite" }}>⛰️</div>
        <p style={{ color: DesignSystem.colors.semantic.stable, margin: 0, fontSize: "14px" }}>Analyzing elevation impact...</p>
      </div>
    );
  }

  if (!toolInfo.isSuccess || !toolInfo.output) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>⚠️</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>Error loading elevation data</p>
      </div>
    );
  }

  const { summary, topHillyRuns } = toolInfo.output as any;

  if (summary.totalActivities === 0) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>🔍</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.stable, fontSize: "14px" }}>
          No activities found to analyze
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: "800px",
      margin: "0 auto",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
    }}>
      <div style={{ 
        background: "white",
        borderRadius: DesignSystem.borderRadius.card, 
        padding: DesignSystem.spacing.card,
        border: "1px solid #e5e7eb",
        boxShadow: DesignSystem.shadows.card,
      }}>
        {/* Header */}
        <div style={{ marginBottom: DesignSystem.spacing.section }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: "20px", 
            fontWeight: 600,
            color: "#111827",
            marginBottom: "4px"
          }}>
            Elevation Impact Analysis
          </h2>
          <p style={{ 
            margin: 0, 
            fontSize: "14px", 
            color: "#6b7280" 
          }}>
            Analyzed {summary.totalActivities} activities
          </p>
        </div>

        {/* Summary Stats */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(2, 1fr)", 
          gap: DesignSystem.spacing.element,
          marginBottom: DesignSystem.spacing.section,
          padding: DesignSystem.spacing.element,
          background: "#f9fafb",
          borderRadius: DesignSystem.borderRadius.element,
          border: "1px solid #e5e7eb"
        }}>
          <div>
            <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Avg Elevation Gain
            </div>
            <div style={{ fontSize: "24px", fontWeight: 600, color: "#111827" }}>
              {summary.averageElevationGain}m
            </div>
            <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
              per run
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Avg Pace Impact
            </div>
            <div style={{ fontSize: "24px", fontWeight: 600, color: "#111827" }}>
              +{summary.averagePaceAdjustment}s
            </div>
            <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
              per km
            </div>
          </div>
        </div>

        {/* Adjustment Method */}
        <div style={{ 
          padding: DesignSystem.spacing.element,
          background: "#eff6ff",
          borderRadius: DesignSystem.borderRadius.element,
          border: "1px solid #bfdbfe",
          marginBottom: DesignSystem.spacing.section
        }}>
          <div style={{ fontSize: "12px", color: "#1e40af", fontWeight: 500 }}>
            ℹ️ Calculation Method
          </div>
          <div style={{ fontSize: "13px", color: "#3b82f6", marginTop: "4px" }}>
            {summary.adjustmentMethod}
          </div>
        </div>

        {/* Top Hilly Runs */}
        {topHillyRuns && topHillyRuns.length > 0 && (
          <div>
            <h3 style={{ 
              margin: 0, 
              fontSize: "16px", 
              fontWeight: 600,
              color: "#111827",
              marginBottom: DesignSystem.spacing.comfortable
            }}>
              Hilliest Runs
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {topHillyRuns.map((run: any) => (
                <div 
                  key={run.id}
                  style={{
                    padding: DesignSystem.spacing.element,
                    background: "#f9fafb",
                    borderRadius: DesignSystem.borderRadius.element,
                    border: "1px solid #e5e7eb"
                  }}
                >
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "flex-start",
                    marginBottom: "8px"
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: "14px", 
                        fontWeight: 600, 
                        color: "#111827",
                        marginBottom: "2px"
                      }}>
                        {run.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        {run.date} • {run.distance}km
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: "20px", 
                      fontWeight: 700,
                      color: "#059669",
                      textAlign: "right"
                    }}>
                      {run.elevationGain}m
                    </div>
                  </div>

                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(3, 1fr)", 
                    gap: "12px",
                    paddingTop: "8px",
                    borderTop: "1px solid #e5e7eb"
                  }}>
                    <div>
                      <div style={{ fontSize: "10px", color: "#9ca3af", marginBottom: "2px" }}>
                        Actual Pace
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#374151" }}>
                        {run.actualPace}
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ fontSize: "10px", color: "#9ca3af", marginBottom: "2px" }}>
                        Flat-Equivalent
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#059669" }}>
                        {run.adjustedPace}
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ fontSize: "10px", color: "#9ca3af", marginBottom: "2px" }}>
                        Elevation/km
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#6b7280" }}>
                        {run.elevationPerKm}m
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

mountWidget(AnalyzeElevationTrends);
