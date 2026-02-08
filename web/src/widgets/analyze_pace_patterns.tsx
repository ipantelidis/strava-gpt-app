import "@/index.css";
import { generateHelpers, mountWidget } from "skybridge/web";
import type { AppType } from "../../../server/src/server";
import { DesignSystem } from "../design-system";

const { useToolInfo } = generateHelpers<AppType>();

export default function AnalyzePacePatterns() {
  const toolInfo = useToolInfo<"analyze_pace_patterns">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact, animation: "pulse 2s ease-in-out infinite" }}>📊</div>
        <p style={{ color: DesignSystem.colors.semantic.stable, margin: 0, fontSize: "14px" }}>Analyzing pace patterns...</p>
      </div>
    );
  }

  if (!toolInfo.isSuccess || !toolInfo.output) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>⚠️</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>Error loading pace data</p>
      </div>
    );
  }

  const { groups, groupBy, totalActivities } = toolInfo.output as any;

  if (!groups || groups.length === 0) {
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
            Pace Patterns
          </h2>
          <p style={{ 
            margin: 0, 
            fontSize: "14px", 
            color: "#6b7280" 
          }}>
            Analyzed {totalActivities} activities grouped by {groupBy === "runType" ? "run type" : "distance range"}
          </p>
        </div>

        {/* Groups */}
        <div style={{ display: "flex", flexDirection: "column", gap: DesignSystem.spacing.section }}>
          {groups.map((group: any) => (
            <div 
              key={group.group}
              style={{
                padding: DesignSystem.spacing.element,
                background: "#f9fafb",
                borderRadius: DesignSystem.borderRadius.element,
                border: "1px solid #e5e7eb"
              }}
            >
              {/* Group Header */}
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: DesignSystem.spacing.element
              }}>
                <div>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: "16px", 
                    fontWeight: 600,
                    color: "#111827",
                    textTransform: "capitalize"
                  }}>
                    {group.group}
                  </h3>
                  <p style={{ 
                    margin: 0, 
                    fontSize: "13px", 
                    color: "#6b7280",
                    marginTop: "2px"
                  }}>
                    {group.count} {group.count === 1 ? 'run' : 'runs'}
                  </p>
                </div>
              </div>

              {/* Statistics */}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(3, 1fr)", 
                gap: DesignSystem.spacing.element,
                marginBottom: DesignSystem.spacing.element
              }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Average
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 600, color: "#111827" }}>
                    {group.statistics.mean}
                  </div>
                  <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                    min/km
                  </div>
                </div>
                
                <div>
                  <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Median
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 600, color: "#111827" }}>
                    {group.statistics.median}
                  </div>
                  <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                    min/km
                  </div>
                </div>
                
                <div>
                  <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Std Dev
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 600, color: "#111827" }}>
                    ±{group.statistics.stdDev}s
                  </div>
                  <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                    per km
                  </div>
                </div>
              </div>

              {/* Example Runs */}
              {group.exampleRuns && group.exampleRuns.length > 0 && (
                <div>
                  <div style={{ 
                    fontSize: "11px", 
                    color: "#6b7280", 
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    Example Runs
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {group.exampleRuns.map((run: any) => (
                      <div 
                        key={run.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          background: "white",
                          borderRadius: DesignSystem.borderRadius.element,
                          fontSize: "13px"
                        }}
                      >
                        <div style={{ flex: 1, color: "#374151", fontWeight: 500 }}>
                          {run.name}
                        </div>
                        <div style={{ color: "#6b7280", marginLeft: "12px" }}>
                          {run.distance}km
                        </div>
                        <div style={{ color: "#111827", fontWeight: 600, marginLeft: "12px" }}>
                          {run.pace}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

mountWidget(AnalyzePacePatterns);
