import { generateHelpers } from "skybridge/web";
import type { AppType } from "../../../server/src/server";

const { useToolInfo } = generateHelpers<AppType>();

export default function CompareTrainingWeeks() {
  const toolInfo = useToolInfo<"compare_training_weeks">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>📊</div>
        <p style={{ color: "#666", margin: 0, fontSize: "14px" }}>Comparing weeks...</p>
      </div>
    );
  }

  if (!toolInfo.isSuccess) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</div>
        <p style={{ margin: 0, color: "#ef4444", fontSize: "14px" }}>Error loading comparison</p>
      </div>
    );
  }

  const { currentWeek, previousWeek, changes, trend } = toolInfo.output as any;

  const getTrendConfig = () => {
    if (trend === "improving") return { color: "#10b981", bg: "rgba(16, 185, 129, 0.1)", label: "Improving" };
    if (trend === "declining") return { color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)", label: "Declining" };
    return { color: "#6b7280", bg: "rgba(107, 114, 128, 0.1)", label: "Stable" };
  };

  const getTrendIcon = (value: number) => value > 0 ? "↑" : value < 0 ? "↓" : "→";
  const trendConfig = getTrendConfig();

  return (
    <div style={{ 
      maxWidth: "640px",
      margin: "0 auto",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    }}>
      <div style={{ 
        background: "rgba(255, 255, 255, 0.02)",
        backdropFilter: "blur(20px)",
        borderRadius: "24px", 
        padding: "32px",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        position: "relative" as const,
        overflow: "hidden" as const
      }}>
        {/* Gradient overlay */}
        <div style={{
          position: "absolute" as const,
          top: 0,
          left: 0,
          right: 0,
          height: "200px",
          background: "linear-gradient(180deg, rgba(102, 126, 234, 0.03) 0%, transparent 100%)",
          pointerEvents: "none" as const
        }} />

        {/* Header with Trend Badge */}
        <div style={{ position: "relative" as const, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <div style={{ 
                width: "8px", 
                height: "8px", 
                borderRadius: "50%", 
                background: trendConfig.color,
                boxShadow: `0 0 12px ${trendConfig.color}99`
              }} />
              <span style={{ 
                fontSize: "11px", 
                fontWeight: "600", 
                color: "rgba(0, 0, 0, 0.5)",
                textTransform: "uppercase" as const,
                letterSpacing: "1px"
              }}>
                Week Comparison
              </span>
            </div>
          </div>
          <div style={{
            padding: "8px 16px",
            background: trendConfig.bg,
            backdropFilter: "blur(10px)",
            color: trendConfig.color,
            borderRadius: "20px",
            fontSize: "11px",
            fontWeight: "700",
            textTransform: "uppercase" as const,
            letterSpacing: "1px",
            border: `1px solid ${trendConfig.color}33`
          }}>
            {trendConfig.label}
          </div>
        </div>

        {/* Week Comparison Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "32px", position: "relative" as const }}>
          <div style={{ 
            padding: "24px", 
            background: "rgba(255, 255, 255, 0.3)",
            backdropFilter: "blur(10px)",
            borderRadius: "16px",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            position: "relative" as const,
            overflow: "hidden" as const
          }}>
            <div style={{
              position: "absolute" as const,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "linear-gradient(135deg, rgba(107, 114, 128, 0.05) 0%, transparent 100%)",
              pointerEvents: "none" as const
            }} />
            <div style={{ position: "relative" as const }}>
              <div style={{ fontSize: "10px", color: "rgba(0, 0, 0, 0.4)", marginBottom: "12px", fontWeight: "600", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>
                Previous Week
              </div>
              <div style={{ fontSize: "36px", fontWeight: "700", marginBottom: "12px", color: "rgba(0, 0, 0, 0.7)" }}>
                {previousWeek.totalDistance}
                <span style={{ fontSize: "16px", fontWeight: "500", marginLeft: "4px", color: "rgba(0, 0, 0, 0.4)" }}>km</span>
              </div>
              <div style={{ fontSize: "12px", color: "rgba(0, 0, 0, 0.5)", fontFamily: "ui-monospace, monospace" }}>
                {previousWeek.totalRuns} runs • {previousWeek.avgPace}/km
              </div>
            </div>
          </div>

          <div style={{ 
            padding: "24px", 
            background: "rgba(255, 255, 255, 0.4)",
            backdropFilter: "blur(10px)",
            borderRadius: "16px",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            position: "relative" as const,
            overflow: "hidden" as const,
            boxShadow: "0 8px 24px rgba(102, 126, 234, 0.15)"
          }}>
            <div style={{
              position: "absolute" as const,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
              pointerEvents: "none" as const
            }} />
            <div style={{ position: "relative" as const }}>
              <div style={{ fontSize: "10px", color: "rgba(102, 126, 234, 0.7)", marginBottom: "12px", fontWeight: "600", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>
                Current Week
              </div>
              <div style={{ 
                fontSize: "36px", 
                fontWeight: "700", 
                marginBottom: "12px",
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text"
              }}>
                {currentWeek.totalDistance}
                <span style={{ fontSize: "16px", fontWeight: "500", marginLeft: "4px" }}>km</span>
              </div>
              <div style={{ fontSize: "12px", color: "rgba(102, 126, 234, 0.8)", fontFamily: "ui-monospace, monospace" }}>
                {currentWeek.totalRuns} runs • {currentWeek.avgPace}/km
              </div>
            </div>
          </div>
        </div>

        {/* Changes */}
        <div style={{ position: "relative" as const }}>
          <h3 style={{ 
            fontSize: "13px", 
            fontWeight: "600", 
            marginBottom: "16px", 
            color: "rgba(0, 0, 0, 0.6)",
            textTransform: "uppercase" as const,
            letterSpacing: "0.5px"
          }}>
            Changes
          </h3>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px" }}>
            {[
              { label: "Distance", value: changes.distanceChange, suffix: "%", isGood: changes.distanceChange > 0 },
              { label: "Number of Runs", value: changes.runsChange, suffix: "", isGood: changes.runsChange > 0 },
              { label: "Pace", value: changes.paceChange, suffix: "s/km", isGood: changes.paceChange < 0, invertIcon: true }
            ].map((change, i) => {
              const isPositive = change.invertIcon ? change.value < 0 : change.value > 0;
              const color = isPositive ? "#10b981" : change.value < 0 ? "#ef4444" : "#6b7280";
              const bgColor = isPositive ? "rgba(16, 185, 129, 0.08)" : change.value < 0 ? "rgba(239, 68, 68, 0.08)" : "rgba(107, 114, 128, 0.08)";
              
              return (
                <div key={i} style={{
                  padding: "16px 20px",
                  background: bgColor,
                  backdropFilter: "blur(10px)",
                  borderRadius: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: `1px solid ${color}22`
                }}>
                  <span style={{ fontSize: "13px", fontWeight: "500", color: "rgba(0, 0, 0, 0.7)" }}>
                    {change.label}
                  </span>
                  <span style={{
                    fontSize: "20px",
                    fontWeight: "700",
                    color: color,
                    fontFamily: "ui-monospace, monospace"
                  }}>
                    {getTrendIcon(change.invertIcon ? -change.value : change.value)} {Math.abs(change.value)}{change.suffix}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
