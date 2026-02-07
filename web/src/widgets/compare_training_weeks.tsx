import { generateHelpers } from "skybridge/web";
import type { AppType } from "../../../server/src/server";

const { useToolInfo } = generateHelpers<AppType>();

export default function CompareTrainingWeeks() {
  const toolInfo = useToolInfo<"compare_training_weeks">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: "24px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>📊</div>
        <p style={{ color: "#666", margin: 0 }}>Comparing weeks...</p>
      </div>
    );
  }

  if (!toolInfo.isSuccess) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "#ef4444" }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>⚠️</div>
        <p style={{ margin: 0 }}>Error loading comparison</p>
      </div>
    );
  }

  const { currentWeek, previousWeek, changes, trend } = toolInfo.output;

  const getTrendColor = () => {
    if (trend === "improving") return { bg: "#10b981", light: "#d1fae5" };
    if (trend === "declining") return { bg: "#ef4444", light: "#fee2e2" };
    return { bg: "#6b7280", light: "#f3f4f6" };
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return "↑";
    if (value < 0) return "↓";
    return "→";
  };

  const trendColors = getTrendColor();

  return (
    <div style={{ 
      maxWidth: "600px",
      margin: "0 auto",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      <div style={{ 
        background: "white", 
        borderRadius: "16px", 
        padding: "24px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        border: "1px solid #e5e7eb"
      }}>
        {/* Header with Trend Badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "700", color: "#111" }}>
            Week Comparison
          </h2>
          <div style={{
            padding: "8px 16px",
            background: trendColors.bg,
            color: "white",
            borderRadius: "20px",
            fontSize: "14px",
            fontWeight: "600",
            textTransform: "uppercase",
            letterSpacing: "0.5px"
          }}>
            {trend}
          </div>
        </div>

        {/* Week Comparison Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
          <div style={{ 
            padding: "20px", 
            background: "#f9fafb", 
            borderRadius: "12px",
            border: "2px solid #e5e7eb"
          }}>
            <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px", fontWeight: "600", textTransform: "uppercase" }}>
              Previous Week
            </div>
            <div style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "12px", color: "#374151" }}>
              {previousWeek.totalDistance} km
            </div>
            <div style={{ fontSize: "14px", color: "#6b7280" }}>
              {previousWeek.totalRuns} runs • {previousWeek.avgPace}/km
            </div>
          </div>

          <div style={{ 
            padding: "20px", 
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: "12px",
            color: "white",
            boxShadow: "0 4px 16px rgba(102,126,234,0.4)"
          }}>
            <div style={{ fontSize: "12px", opacity: 0.9, marginBottom: "8px", fontWeight: "600", textTransform: "uppercase" }}>
              Current Week
            </div>
            <div style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "12px" }}>
              {currentWeek.totalDistance} km
            </div>
            <div style={{ fontSize: "14px", opacity: 0.9 }}>
              {currentWeek.totalRuns} runs • {currentWeek.avgPace}/km
            </div>
          </div>
        </div>

        {/* Changes */}
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", color: "#333" }}>
            Changes
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{
              padding: "16px",
              background: changes.distanceChange > 0 ? "#d1fae5" : changes.distanceChange < 0 ? "#fee2e2" : "#f3f4f6",
              borderRadius: "10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: `2px solid ${changes.distanceChange > 0 ? "#10b981" : changes.distanceChange < 0 ? "#ef4444" : "#e5e7eb"}`
            }}>
              <span style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}>Distance</span>
              <span style={{
                fontSize: "20px",
                fontWeight: "700",
                color: changes.distanceChange > 0 ? "#059669" : changes.distanceChange < 0 ? "#dc2626" : "#6b7280"
              }}>
                {getTrendIcon(changes.distanceChange)} {Math.abs(changes.distanceChange)}%
              </span>
            </div>

            <div style={{
              padding: "16px",
              background: changes.runsChange > 0 ? "#d1fae5" : changes.runsChange < 0 ? "#fee2e2" : "#f3f4f6",
              borderRadius: "10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: `2px solid ${changes.runsChange > 0 ? "#10b981" : changes.runsChange < 0 ? "#ef4444" : "#e5e7eb"}`
            }}>
              <span style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}>Number of Runs</span>
              <span style={{
                fontSize: "20px",
                fontWeight: "700",
                color: changes.runsChange > 0 ? "#059669" : changes.runsChange < 0 ? "#dc2626" : "#6b7280"
              }}>
                {getTrendIcon(changes.runsChange)} {Math.abs(changes.runsChange)}
              </span>
            </div>

            <div style={{
              padding: "16px",
              background: changes.paceChange < 0 ? "#d1fae5" : changes.paceChange > 0 ? "#fee2e2" : "#f3f4f6",
              borderRadius: "10px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: `2px solid ${changes.paceChange < 0 ? "#10b981" : changes.paceChange > 0 ? "#ef4444" : "#e5e7eb"}`
            }}>
              <span style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}>Pace</span>
              <span style={{
                fontSize: "20px",
                fontWeight: "700",
                color: changes.paceChange < 0 ? "#059669" : changes.paceChange > 0 ? "#dc2626" : "#6b7280"
              }}>
                {getTrendIcon(-changes.paceChange)} {Math.abs(changes.paceChange)}s/km
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
