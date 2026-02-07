import { generateHelpers } from "skybridge/web";
import type { AppType } from "../../../server/src/server";

const { useToolInfo } = generateHelpers<AppType>();

export default function CoachingAdvice() {
  const toolInfo = useToolInfo<"get_coaching_advice">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: "20px" }}>
        <p>Analyzing your training...</p>
      </div>
    );
  }

  if (!toolInfo.isSuccess) {
    return (
      <div style={{ padding: "20px", color: "#ef4444" }}>
        <p>Error analyzing training</p>
      </div>
    );
  }

  const { recentLoad, recommendation, trainingState } = toolInfo.output;

  const getStateColor = () => {
    switch (trainingState) {
      case "fresh":
        return "#10b981";
      case "building":
        return "#3b82f6";
      case "fatigued":
        return "#f59e0b";
      case "recovering":
        return "#8b5cf6";
      default:
        return "#6b7280";
    }
  };

  const getStateEmoji = () => {
    switch (trainingState) {
      case "fresh":
        return "💪";
      case "building":
        return "📈";
      case "fatigued":
        return "😓";
      case "recovering":
        return "🧘";
      default:
        return "🏃";
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ marginTop: 0 }}>Coaching Advice</h2>

      <div
        style={{
          padding: "16px",
          background: getStateColor(),
          color: "white",
          borderRadius: "12px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "32px" }}>{getStateEmoji()}</span>
        <div>
          <div style={{ fontSize: "18px", fontWeight: "600" }}>
            {trainingState.charAt(0).toUpperCase() + trainingState.slice(1)}
          </div>
          <div style={{ fontSize: "14px", opacity: 0.9 }}>Current training state</div>
        </div>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>Recent Load</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
          <div style={{ padding: "12px", background: "#f3f4f6", borderRadius: "8px" }}>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{recentLoad.last7Days} km</div>
            <div style={{ fontSize: "12px", color: "#666" }}>Last 7 days</div>
          </div>
          <div style={{ padding: "12px", background: "#f3f4f6", borderRadius: "8px" }}>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>{recentLoad.last3Days} km</div>
            <div style={{ fontSize: "12px", color: "#666" }}>Last 3 days</div>
          </div>
          <div style={{ padding: "12px", background: "#f3f4f6", borderRadius: "8px" }}>
            <div style={{ fontSize: "20px", fontWeight: "bold" }}>
              {recentLoad.consecutiveDays}
            </div>
            <div style={{ fontSize: "12px", color: "#666" }}>Consecutive days</div>
          </div>
        </div>
      </div>

      {recommendation.action && (
        <div
          style={{
            padding: "20px",
            background: "#fef3c7",
            border: "2px solid #fbbf24",
            borderRadius: "12px",
          }}
        >
          <h3 style={{ fontSize: "16px", margin: "0 0 8px 0", color: "#92400e" }}>
            💡 Recommendation
          </h3>
          <p style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 12px 0", color: "#78350f" }}>
            {recommendation.action}
          </p>
          {recommendation.reasoning && (
            <p style={{ fontSize: "14px", margin: "0 0 12px 0", color: "#92400e" }}>
              {recommendation.reasoning}
            </p>
          )}
          {recommendation.nextRun && (
            <div
              style={{
                padding: "12px",
                background: "white",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#78350f",
              }}
            >
              <strong>Next run:</strong> {recommendation.nextRun}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
