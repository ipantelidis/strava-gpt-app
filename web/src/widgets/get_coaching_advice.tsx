import { generateHelpers } from "skybridge/web";
import type { AppType } from "../../../server/src/server";

const { useToolInfo } = generateHelpers<AppType>();

export default function CoachingAdvice() {
  const toolInfo = useToolInfo<"get_coaching_advice">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: "24px", textAlign: "center" }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>🤔</div>
        <p style={{ color: "#666", margin: 0 }}>Analyzing your training...</p>
      </div>
    );
  }

  if (!toolInfo.isSuccess) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "#ef4444" }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>⚠️</div>
        <p style={{ margin: 0 }}>Error analyzing training</p>
      </div>
    );
  }

  const { recentLoad, recommendation, trainingState } = toolInfo.output;

  const getStateConfig = () => {
    switch (trainingState) {
      case "fresh":
        return { emoji: "💪", color: "#10b981", bg: "#d1fae5", label: "Fresh & Ready" };
      case "building":
        return { emoji: "📈", color: "#3b82f6", bg: "#dbeafe", label: "Building Fitness" };
      case "fatigued":
        return { emoji: "😓", color: "#f59e0b", bg: "#fef3c7", label: "Fatigued" };
      case "recovering":
        return { emoji: "🧘", color: "#8b5cf6", bg: "#ede9fe", label: "Recovering" };
      default:
        return { emoji: "🏃", color: "#6b7280", bg: "#f3f4f6", label: "Training" };
    }
  };

  const stateConfig = getStateConfig();

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
        {/* Header */}
        <h2 style={{ margin: "0 0 20px 0", fontSize: "24px", fontWeight: "700", color: "#111" }}>
          Coaching Advice
        </h2>

        {/* Training State Banner */}
        <div style={{
          padding: "24px",
          background: stateConfig.bg,
          borderRadius: "12px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          border: `2px solid ${stateConfig.color}`
        }}>
          <span style={{ fontSize: "48px" }}>{stateConfig.emoji}</span>
          <div>
            <div style={{ fontSize: "24px", fontWeight: "700", color: stateConfig.color, marginBottom: "4px" }}>
              {stateConfig.label}
            </div>
            <div style={{ fontSize: "14px", color: "#6b7280" }}>
              Current training state
            </div>
          </div>
        </div>

        {/* Recent Load */}
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "12px", color: "#333" }}>
            Recent Load
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
            <div style={{ 
              padding: "16px", 
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "10px",
              color: "white",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "4px" }}>
                {recentLoad.last7Days}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.9 }}>Last 7 days (km)</div>
            </div>
            <div style={{ 
              padding: "16px", 
              background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
              borderRadius: "10px",
              color: "white",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "4px" }}>
                {recentLoad.last3Days}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.9 }}>Last 3 days (km)</div>
            </div>
            <div style={{ 
              padding: "16px", 
              background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
              borderRadius: "10px",
              color: "white",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "4px" }}>
                {recentLoad.consecutiveDays}
              </div>
              <div style={{ fontSize: "12px", opacity: 0.9 }}>Consecutive days</div>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        {recommendation.action && (
          <div style={{
            padding: "24px",
            background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
            border: "2px solid #f59e0b",
            borderRadius: "12px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ fontSize: "24px" }}>💡</span>
              <h3 style={{ fontSize: "18px", margin: 0, fontWeight: "700", color: "#92400e" }}>
                Recommendation
              </h3>
            </div>
            <p style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 12px 0", color: "#78350f" }}>
              {recommendation.action}
            </p>
            {recommendation.reasoning && (
              <p style={{ fontSize: "14px", margin: "0 0 12px 0", color: "#92400e", lineHeight: "1.5" }}>
                {recommendation.reasoning}
              </p>
            )}
            {recommendation.nextRun && (
              <div style={{
                padding: "16px",
                background: "white",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#78350f",
                marginTop: "12px"
              }}>
                <strong style={{ display: "block", marginBottom: "4px" }}>Next run:</strong>
                {recommendation.nextRun}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
