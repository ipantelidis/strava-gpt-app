import { generateHelpers } from "skybridge/web";
import type { AppType } from "../../../server/src/server";

const { useToolInfo } = generateHelpers<AppType>();

export default function TrainingSummary() {
  const toolInfo = useToolInfo<"get_training_summary">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: "24px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>🏃‍♂️</div>
        <p style={{ color: "#666", margin: 0 }}>Loading your training data...</p>
      </div>
    );
  }

  if (!toolInfo.isSuccess) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "#ef4444" }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>⚠️</div>
        <p style={{ margin: 0 }}>Error loading training data</p>
      </div>
    );
  }

  const { period, stats, runs } = toolInfo.output;

  return (
    <div style={{ 
      maxWidth: "600px",
      margin: "0 auto",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      borderRadius: "16px",
      padding: "1px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
    }}>
      <div style={{ background: "white", borderRadius: "15px", padding: "24px" }}>
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ 
            margin: "0 0 8px 0", 
            fontSize: "24px", 
            fontWeight: "700",
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}>
            Training Summary
          </h2>
          <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
            📅 {period.start} → {period.end}
          </p>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "12px",
          marginBottom: "24px"
        }}>
          <div style={{ 
            padding: "20px", 
            background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
            borderRadius: "12px",
            color: "white",
            boxShadow: "0 4px 12px rgba(240,147,251,0.3)"
          }}>
            <div style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "4px" }}>
              {stats.totalDistance}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.9 }}>km total</div>
          </div>
          
          <div style={{ 
            padding: "20px", 
            background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
            borderRadius: "12px",
            color: "white",
            boxShadow: "0 4px 12px rgba(79,172,254,0.3)"
          }}>
            <div style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "4px" }}>
              {stats.totalRuns}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.9 }}>runs</div>
          </div>
          
          <div style={{ 
            padding: "20px", 
            background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
            borderRadius: "12px",
            color: "white",
            boxShadow: "0 4px 12px rgba(67,233,123,0.3)"
          }}>
            <div style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "4px" }}>
              {stats.avgPace}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.9 }}>avg pace /km</div>
          </div>
          
          <div style={{ 
            padding: "20px", 
            background: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
            borderRadius: "12px",
            color: "white",
            boxShadow: "0 4px 12px rgba(250,112,154,0.3)"
          }}>
            <div style={{ fontSize: "32px", fontWeight: "bold", marginBottom: "4px" }}>
              {stats.totalTime}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.9 }}>minutes</div>
          </div>
        </div>

        {/* Recent Runs */}
        {runs.length > 0 && (
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", color: "#333" }}>
              Recent Runs
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {runs.slice(0, 5).map((run, i) => (
                <div
                  key={i}
                  style={{
                    padding: "16px",
                    background: "#f8f9fa",
                    borderRadius: "10px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "14px",
                    border: "1px solid #e9ecef",
                    transition: "all 0.2s",
                    cursor: "default"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#e9ecef";
                    e.currentTarget.style.transform = "translateX(4px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f8f9fa";
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                >
                  <span style={{ fontWeight: "500", color: "#495057" }}>{run.date}</span>
                  <span style={{ color: "#6c757d" }}>
                    {run.distance} km • {run.pace}/km • {run.duration} min
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
