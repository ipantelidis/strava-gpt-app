import { generateHelpers } from "skybridge/web";
import type { AppType } from "../../../server/src/server";

const { useToolInfo } = generateHelpers<AppType>();

export default function TrainingSummary() {
  const toolInfo = useToolInfo<"get_training_summary">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px", animation: "pulse 2s ease-in-out infinite" }}>🏃‍♂️</div>
        <p style={{ color: "#666", margin: 0, fontSize: "14px" }}>Loading your training data...</p>
      </div>
    );
  }

  if (!toolInfo.isSuccess) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</div>
        <p style={{ margin: 0, color: "#ef4444", fontSize: "14px" }}>Error loading training data</p>
      </div>
    );
  }

  const { period, stats, runs } = toolInfo.output as any;

  // Debug: log what we're getting
  console.log("Widget data:", { period, stats, runs });

  // Safety check
  if (!stats || !period) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</div>
        <p style={{ margin: 0, color: "#ef4444", fontSize: "14px" }}>No training data available</p>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: "640px",
      margin: "0 auto",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
    }}>
      <div style={{ 
        background: "white",
        borderRadius: "24px", 
        padding: "32px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.08)",
        position: "relative" as const,
        overflow: "hidden" as const
      }}>
        {/* Subtle gradient overlay */}
        <div style={{
          position: "absolute" as const,
          top: 0,
          left: 0,
          right: 0,
          height: "200px",
          background: "linear-gradient(180deg, rgba(102, 126, 234, 0.03) 0%, transparent 100%)",
          pointerEvents: "none" as const
        }} />

        {/* Header */}
        <div style={{ position: "relative" as const, marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <div style={{ 
              width: "8px", 
              height: "8px", 
              borderRadius: "50%", 
              background: "#10b981",
              boxShadow: "0 0 12px rgba(16, 185, 129, 0.6)"
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
          gap: "16px",
          marginBottom: "32px",
          position: "relative" as const
        }}>
          {[
            { value: stats.totalDistance, label: "km total", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
            { value: stats.totalRuns, label: "runs", gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
            { value: stats.avgPace, label: "avg pace /km", gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
            { value: stats.totalTime, label: "minutes", gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" }
          ].map((stat, i) => (
            <div key={i} style={{ 
              padding: "24px", 
              background: "#f8f9fa",
              backdropFilter: "blur(10px)",
              borderRadius: "16px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              position: "relative" as const,
              overflow: "hidden" as const,
              transition: "all 0.3s ease"
            }}>
              <div style={{
                position: "absolute" as const,
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: stat.gradient,
                opacity: 0.08,
                pointerEvents: "none" as const
              }} />
              <div style={{ position: "relative" as const }}>
                <div style={{ 
                  fontSize: "36px", 
                  fontWeight: "700", 
                  marginBottom: "4px",
                  background: stat.gradient,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text"
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
        {runs.length > 0 && (
          <div style={{ position: "relative" as const }}>
            <h3 style={{ 
              fontSize: "13px", 
              fontWeight: "600", 
              marginBottom: "16px", 
              color: "rgba(0, 0, 0, 0.6)",
              textTransform: "uppercase" as const,
              letterSpacing: "0.5px"
            }}>
              Recent Activity
            </h3>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "8px" }}>
              {runs.slice(0, 5).map((run, i) => (
                <div
                  key={i}
                  style={{
                    padding: "16px 20px",
                    background: "#f3f4f6",
                    backdropFilter: "blur(10px)",
                    borderRadius: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "13px",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    transition: "all 0.2s ease"
                  }}
                >
                  <span style={{ fontWeight: "600", color: "rgba(0, 0, 0, 0.7)" }}>
                    {run.date}
                  </span>
                  <span style={{ 
                    color: "rgba(0, 0, 0, 0.5)", 
                    fontSize: "12px",
                    fontFamily: "ui-monospace, monospace"
                  }}>
                    {run.distance}km • {run.pace}/km • {run.duration}min
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
