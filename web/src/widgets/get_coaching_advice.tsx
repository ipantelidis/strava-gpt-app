import { generateHelpers } from "skybridge/web";
import type { AppType } from "../../../server/src/server";

const { useToolInfo } = generateHelpers<AppType>();

export default function CoachingAdvice() {
  const toolInfo = useToolInfo<"get_coaching_advice">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>🤔</div>
        <p style={{ color: "#666", margin: 0, fontSize: "14px" }}>Analyzing your training...</p>
      </div>
    );
  }

  if (!toolInfo.isSuccess) {
    return (
      <div style={{ padding: "32px", textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</div>
        <p style={{ margin: 0, color: "#ef4444", fontSize: "14px" }}>Error analyzing training</p>
      </div>
    );
  }

  const { recentLoad, recommendation, trainingState } = toolInfo.output as any;

  const getStateConfig = () => {
    switch (trainingState) {
      case "fresh":
        return { emoji: "💪", color: "#10b981", bg: "rgba(16, 185, 129, 0.1)", label: "Fresh & Ready" };
      case "building":
        return { emoji: "📈", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)", label: "Building Fitness" };
      case "fatigued":
        return { emoji: "😓", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", label: "Fatigued" };
      case "recovering":
        return { emoji: "🧘", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.1)", label: "Recovering" };
      default:
        return { emoji: "🏃", color: "#6b7280", bg: "rgba(107, 114, 128, 0.1)", label: "Training" };
    }
  };

  const stateConfig = getStateConfig();

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

        {/* Header */}
        <div style={{ position: "relative" as const, marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ 
              width: "8px", 
              height: "8px", 
              borderRadius: "50%", 
              background: stateConfig.color,
              boxShadow: `0 0 12px ${stateConfig.color}99`
            }} />
            <span style={{ 
              fontSize: "11px", 
              fontWeight: "600", 
              color: "rgba(0, 0, 0, 0.5)",
              textTransform: "uppercase" as const,
              letterSpacing: "1px"
            }}>
              Coaching Advice
            </span>
          </div>
        </div>

        {/* Training State Banner */}
        <div style={{
          padding: "28px",
          background: stateConfig.bg,
          backdropFilter: "blur(10px)",
          borderRadius: "16px",
          marginBottom: "32px",
          display: "flex",
          alignItems: "center",
          gap: "20px",
          border: `1px solid ${stateConfig.color}33`,
          position: "relative" as const,
          overflow: "hidden" as const
        }}>
          <div style={{
            position: "absolute" as const,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(135deg, ${stateConfig.color}08 0%, transparent 100%)`,
            pointerEvents: "none" as const
          }} />
          <span style={{ fontSize: "56px", position: "relative" as const }}>{stateConfig.emoji}</span>
          <div style={{ position: "relative" as const }}>
            <div style={{ fontSize: "28px", fontWeight: "700", color: stateConfig.color, marginBottom: "4px" }}>
              {stateConfig.label}
            </div>
            <div style={{ fontSize: "13px", color: "rgba(0, 0, 0, 0.5)" }}>
              Current training state
            </div>
          </div>
        </div>

        {/* Recent Load */}
        <div style={{ marginBottom: "32px", position: "relative" as const }}>
          <h3 style={{ 
            fontSize: "13px", 
            fontWeight: "600", 
            marginBottom: "16px", 
            color: "rgba(0, 0, 0, 0.6)",
            textTransform: "uppercase" as const,
            letterSpacing: "0.5px"
          }}>
            Recent Load
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
            {[
              { value: recentLoad.last7Days, label: "Last 7 days", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
              { value: recentLoad.last3Days, label: "Last 3 days", gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
              { value: recentLoad.consecutiveDays, label: "Consecutive", gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" }
            ].map((stat, i) => (
              <div key={i} style={{ 
                padding: "20px", 
                background: "rgba(255, 255, 255, 0.4)",
                backdropFilter: "blur(10px)",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                textAlign: "center" as const,
                position: "relative" as const,
                overflow: "hidden" as const
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
                    fontSize: "32px", 
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
        </div>

        {/* Recommendation */}
        {recommendation.action && (
          <div style={{
            padding: "24px",
            background: "rgba(245, 158, 11, 0.08)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: "16px",
            position: "relative" as const,
            overflow: "hidden" as const
          }}>
            <div style={{
              position: "absolute" as const,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, transparent 100%)",
              pointerEvents: "none" as const
            }} />
            <div style={{ position: "relative" as const }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "24px" }}>💡</span>
                <h3 style={{ fontSize: "16px", margin: 0, fontWeight: "700", color: "#92400e" }}>
                  Recommendation
                </h3>
              </div>
              <p style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 12px 0", color: "#78350f", lineHeight: "1.5" }}>
                {recommendation.action}
              </p>
              {recommendation.reasoning && (
                <p style={{ fontSize: "14px", margin: "0 0 12px 0", color: "#92400e", lineHeight: "1.6" }}>
                  {recommendation.reasoning}
                </p>
              )}
              {recommendation.nextRun && (
                <div style={{
                  padding: "16px",
                  background: "rgba(255, 255, 255, 0.6)",
                  backdropFilter: "blur(10px)",
                  borderRadius: "10px",
                  fontSize: "14px",
                  color: "#78350f",
                  marginTop: "12px",
                  border: "1px solid rgba(245, 158, 11, 0.2)"
                }}>
                  <strong style={{ display: "block", marginBottom: "4px", fontSize: "12px", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>Next run:</strong>
                  {recommendation.nextRun}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
