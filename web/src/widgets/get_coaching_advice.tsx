import { generateHelpers } from "skybridge/web";
import type { AppType } from "../../../server/src/server";
import { DesignSystem, applyGradientText, createGradientOverlay, applyGlassmorphism, getSemanticBackground } from "../design-system";

const { useToolInfo } = generateHelpers<AppType>();

export default function CoachingAdvice() {
  const toolInfo = useToolInfo<"get_coaching_advice">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>🤔</div>
        <p style={{ color: DesignSystem.colors.semantic.stable, margin: 0, fontSize: "14px" }}>Analyzing your training...</p>
      </div>
    );
  }

  if (!toolInfo.isSuccess) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>⚠️</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>Error analyzing training</p>
      </div>
    );
  }

  const { recentLoad, recommendation, trainingState } = toolInfo.output as any;

  const getStateConfig = () => {
    switch (trainingState) {
      case "fresh":
        return { emoji: "💪", color: DesignSystem.colors.semantic.improvement, bg: getSemanticBackground(1, false, 0.1), label: "Fresh & Ready" };
      case "building":
        return { emoji: "📈", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)", label: "Building Fitness" };
      case "fatigued":
        return { emoji: "😓", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", label: "Fatigued" };
      case "recovering":
        return { emoji: "🧘", color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.1)", label: "Recovering" };
      default:
        return { emoji: "🏃", color: DesignSystem.colors.semantic.stable, bg: getSemanticBackground(0, false, 0.1), label: "Training" };
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
        ...applyGlassmorphism(0.02),
        borderRadius: DesignSystem.borderRadius.card, 
        padding: DesignSystem.spacing.card,
        boxShadow: `${DesignSystem.shadows.card}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
        position: "relative" as const,
        overflow: "hidden" as const
      }}>
        {/* Gradient overlay */}
        <div style={{
          ...createGradientOverlay(DesignSystem.colors.gradients.primary, 0.03),
          height: "200px",
        }} />

        {/* Header */}
        <div style={{ position: "relative" as const, marginBottom: DesignSystem.spacing.section }}>
          <div style={{ display: "flex", alignItems: "center", gap: DesignSystem.spacing.compact }}>
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
          backdropFilter: DesignSystem.glassmorphism.backdropBlur,
          borderRadius: DesignSystem.borderRadius.element,
          marginBottom: DesignSystem.spacing.card,
          display: "flex",
          alignItems: "center",
          gap: "20px",
          border: `1px solid ${stateConfig.color}33`,
          position: "relative" as const,
          overflow: "hidden" as const
        }}>
          <div style={{
            ...createGradientOverlay(`linear-gradient(135deg, ${stateConfig.color} 0%, transparent 100%)`, 0.08)
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
        <div style={{ marginBottom: DesignSystem.spacing.card, position: "relative" as const }}>
          <h3 style={{ 
            fontSize: "13px", 
            fontWeight: "600", 
            marginBottom: DesignSystem.spacing.element, 
            color: "rgba(0, 0, 0, 0.6)",
            textTransform: "uppercase" as const,
            letterSpacing: "0.5px"
          }}>
            Recent Load
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: DesignSystem.spacing.compact }}>
            {[
              { value: recentLoad.last7Days, label: "Last 7 days", gradient: DesignSystem.colors.gradients.primary },
              { value: recentLoad.last3Days, label: "Last 3 days", gradient: DesignSystem.colors.gradients.secondary },
              { value: recentLoad.consecutiveDays, label: "Consecutive", gradient: DesignSystem.colors.gradients.tertiary }
            ].map((stat, i) => (
              <div key={i} style={{ 
                padding: "20px", 
                background: "rgba(255, 255, 255, 0.4)",
                backdropFilter: DesignSystem.glassmorphism.backdropBlur,
                borderRadius: DesignSystem.borderRadius.small,
                border: DesignSystem.glassmorphism.border,
                textAlign: "center" as const,
                position: "relative" as const,
                overflow: "hidden" as const
              }}>
                <div style={{
                  ...createGradientOverlay(stat.gradient)
                }} />
                <div style={{ position: "relative" as const }}>
                  <div style={{ 
                    fontSize: "32px", 
                    fontWeight: "700", 
                    marginBottom: "4px",
                    ...applyGradientText(stat.gradient)
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
            padding: DesignSystem.spacing.section,
            background: "rgba(245, 158, 11, 0.08)",
            backdropFilter: DesignSystem.glassmorphism.backdropBlur,
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: DesignSystem.borderRadius.element,
            position: "relative" as const,
            overflow: "hidden" as const
          }}>
            <div style={{
              ...createGradientOverlay("linear-gradient(135deg, rgba(245, 158, 11, 1) 0%, transparent 100%)", 0.05)
            }} />
            <div style={{ position: "relative" as const }}>
              <div style={{ display: "flex", alignItems: "center", gap: DesignSystem.spacing.compact, marginBottom: DesignSystem.spacing.compact }}>
                <span style={{ fontSize: "24px" }}>💡</span>
                <h3 style={{ fontSize: "16px", margin: 0, fontWeight: "700", color: "#92400e" }}>
                  Recommendation
                </h3>
              </div>
              <p style={{ fontSize: "16px", fontWeight: "600", margin: `0 0 ${DesignSystem.spacing.compact} 0`, color: "#78350f", lineHeight: "1.5" }}>
                {recommendation.action}
              </p>
              {recommendation.reasoning && (
                <p style={{ fontSize: "14px", margin: `0 0 ${DesignSystem.spacing.compact} 0`, color: "#92400e", lineHeight: "1.6" }}>
                  {recommendation.reasoning}
                </p>
              )}
              {recommendation.nextRun && (
                <div style={{
                  padding: DesignSystem.spacing.element,
                  background: "rgba(255, 255, 255, 0.6)",
                  backdropFilter: DesignSystem.glassmorphism.backdropBlur,
                  borderRadius: "10px",
                  fontSize: "14px",
                  color: "#78350f",
                  marginTop: DesignSystem.spacing.compact,
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
