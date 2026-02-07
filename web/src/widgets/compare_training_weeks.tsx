import { useWidget } from "skybridge/web";
import type { AppType } from "../../../server/src/server";

export default function CompareTrainingWeeks() {
  const { data, error } = useWidget<AppType, "compare_training_weeks">();

  if (error) {
    return (
      <div style={{ padding: "20px", color: "#ef4444" }}>
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: "20px" }}>
        <p>Loading comparison data...</p>
      </div>
    );
  }

  const { currentWeek, previousWeek, changes, trend } = data;

  const getTrendColor = () => {
    if (trend === "improving") return "#10b981";
    if (trend === "declining") return "#ef4444";
    return "#6b7280";
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return "↑";
    if (value < 0) return "↓";
    return "→";
  };

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ marginTop: 0 }}>Week Comparison</h2>
      <div
        style={{
          display: "inline-block",
          padding: "4px 12px",
          background: getTrendColor(),
          color: "white",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: "600",
          marginBottom: "20px",
        }}
      >
        {trend.toUpperCase()}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div style={{ padding: "16px", background: "#f3f4f6", borderRadius: "8px" }}>
          <h3 style={{ fontSize: "14px", color: "#666", margin: "0 0 12px 0" }}>
            Previous Week
          </h3>
          <div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>
            {previousWeek.totalDistance} km
          </div>
          <div style={{ fontSize: "14px", color: "#666" }}>
            {previousWeek.totalRuns} runs • {previousWeek.avgPace}/km
          </div>
        </div>

        <div style={{ padding: "16px", background: "#e0f2fe", borderRadius: "8px" }}>
          <h3 style={{ fontSize: "14px", color: "#0369a1", margin: "0 0 12px 0" }}>
            Current Week
          </h3>
          <div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>
            {currentWeek.totalDistance} km
          </div>
          <div style={{ fontSize: "14px", color: "#0369a1" }}>
            {currentWeek.totalRuns} runs • {currentWeek.avgPace}/km
          </div>
        </div>
      </div>

      <div style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>Changes</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              padding: "12px",
              background: "#f9fafb",
              borderRadius: "6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "14px" }}>Distance</span>
            <span
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: changes.distanceChange > 0 ? "#10b981" : "#ef4444",
              }}
            >
              {getTrendIcon(changes.distanceChange)} {Math.abs(changes.distanceChange)}%
            </span>
          </div>

          <div
            style={{
              padding: "12px",
              background: "#f9fafb",
              borderRadius: "6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "14px" }}>Number of Runs</span>
            <span
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: changes.runsChange > 0 ? "#10b981" : "#ef4444",
              }}
            >
              {getTrendIcon(changes.runsChange)} {Math.abs(changes.runsChange)}
            </span>
          </div>

          <div
            style={{
              padding: "12px",
              background: "#f9fafb",
              borderRadius: "6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "14px" }}>Pace</span>
            <span
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: changes.paceChange < 0 ? "#10b981" : "#ef4444",
              }}
            >
              {getTrendIcon(-changes.paceChange)} {Math.abs(changes.paceChange)}s/km
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
