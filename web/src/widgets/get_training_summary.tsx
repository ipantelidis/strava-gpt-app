import { useWidget } from "skybridge/client";
import type { AppType } from "../../../server/src/server";

export default function TrainingSummary() {
  const { data, error } = useWidget<AppType, "get_training_summary">();

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
        <p>Loading your training data...</p>
      </div>
    );
  }

  const { period, stats, runs } = data;

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ marginTop: 0 }}>Training Summary</h2>
      <p style={{ color: "#666", fontSize: "14px" }}>
        {period.start} to {period.end}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "16px",
          margin: "20px 0",
        }}
      >
        <div style={{ padding: "16px", background: "#f3f4f6", borderRadius: "8px" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>{stats.totalDistance} km</div>
          <div style={{ fontSize: "12px", color: "#666" }}>Total Distance</div>
        </div>
        <div style={{ padding: "16px", background: "#f3f4f6", borderRadius: "8px" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>{stats.totalRuns}</div>
          <div style={{ fontSize: "12px", color: "#666" }}>Runs</div>
        </div>
        <div style={{ padding: "16px", background: "#f3f4f6", borderRadius: "8px" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>{stats.avgPace}/km</div>
          <div style={{ fontSize: "12px", color: "#666" }}>Avg Pace</div>
        </div>
        <div style={{ padding: "16px", background: "#f3f4f6", borderRadius: "8px" }}>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>{stats.totalTime} min</div>
          <div style={{ fontSize: "12px", color: "#666" }}>Total Time</div>
        </div>
      </div>

      {runs.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>Recent Runs</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {runs.slice(0, 5).map((run, i) => (
              <div
                key={i}
                style={{
                  padding: "12px",
                  background: "#f9fafb",
                  borderRadius: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "14px",
                }}
              >
                <span>{run.date}</span>
                <span>
                  {run.distance} km • {run.pace}/km • {run.duration} min
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
