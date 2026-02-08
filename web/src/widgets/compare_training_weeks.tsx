import "@/index.css";
import { generateHelpers, mountWidget } from "skybridge/web";
import type { AppType } from "../../../server/src/server";
import { DesignSystem, applyGradientText, createGradientOverlay, getTrendIcon, getSemanticColor, getSemanticBackground, applyGlassmorphism } from "../design-system";

const { useToolInfo } = generateHelpers<AppType>();

export default function CompareTrainingWeeks() {
  const toolInfo = useToolInfo<"compare_training_weeks">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>📊</div>
        <p style={{ color: DesignSystem.colors.semantic.stable, margin: 0, fontSize: "14px" }}>Comparing weeks...</p>
      </div>
    );
  }

  if (!toolInfo.isSuccess) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>⚠️</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>Error loading comparison</p>
      </div>
    );
  }

  // Safety check - ensure output exists before destructuring
  if (!toolInfo.output) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>⚠️</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>
          No comparison data available
        </p>
      </div>
    );
  }

  const { currentWeek, previousWeek, changes, trend } = toolInfo.output as any;

  const getTrendConfig = () => {
    if (trend === "improving") return { color: DesignSystem.colors.semantic.improvement, bg: getSemanticBackground(1, false), label: "Improving" };
    if (trend === "declining") return { color: DesignSystem.colors.semantic.decline, bg: getSemanticBackground(-1, false), label: "Declining" };
    return { color: DesignSystem.colors.semantic.stable, bg: getSemanticBackground(0, false), label: "Stable" };
  };

  const trendConfig = getTrendConfig();

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

        {/* Header with Trend Badge */}
        <div style={{ position: "relative" as const, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: DesignSystem.spacing.card }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: DesignSystem.spacing.compact, marginBottom: DesignSystem.spacing.compact }}>
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
            padding: `${DesignSystem.spacing.compact} ${DesignSystem.spacing.element}`,
            background: trendConfig.bg,
            backdropFilter: DesignSystem.glassmorphism.backdropBlur,
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: DesignSystem.spacing.element, marginBottom: DesignSystem.spacing.card, position: "relative" as const }}>
          <div style={{ 
            padding: DesignSystem.spacing.section, 
            background: "rgba(255, 255, 255, 0.3)",
            backdropFilter: DesignSystem.glassmorphism.backdropBlur,
            borderRadius: DesignSystem.borderRadius.element,
            border: DesignSystem.glassmorphism.border,
            position: "relative" as const,
            overflow: "hidden" as const
          }}>
            <div style={{
              ...createGradientOverlay(`linear-gradient(135deg, ${DesignSystem.colors.semantic.stable} 0%, transparent 100%)`, 0.05)
            }} />
            <div style={{ position: "relative" as const }}>
              <div style={{ fontSize: "10px", color: "rgba(0, 0, 0, 0.4)", marginBottom: DesignSystem.spacing.compact, fontWeight: "600", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>
                Previous Week
              </div>
              <div style={{ fontSize: "36px", fontWeight: "700", marginBottom: DesignSystem.spacing.compact, color: "rgba(0, 0, 0, 0.7)" }}>
                {previousWeek.totalDistance}
                <span style={{ fontSize: "16px", fontWeight: "500", marginLeft: "4px", color: "rgba(0, 0, 0, 0.4)" }}>km</span>
              </div>
              <div style={{ fontSize: "12px", color: "rgba(0, 0, 0, 0.5)", fontFamily: "ui-monospace, monospace" }}>
                {previousWeek.totalRuns} runs • {previousWeek.avgPace}/km
              </div>
            </div>
          </div>

          <div style={{ 
            padding: DesignSystem.spacing.section, 
            background: "rgba(255, 255, 255, 0.4)",
            backdropFilter: DesignSystem.glassmorphism.backdropBlur,
            borderRadius: DesignSystem.borderRadius.element,
            border: DesignSystem.glassmorphism.border,
            position: "relative" as const,
            overflow: "hidden" as const,
            boxShadow: "0 8px 24px rgba(102, 126, 234, 0.15)"
          }}>
            <div style={{
              ...createGradientOverlay(DesignSystem.colors.gradients.primary, 0.1)
            }} />
            <div style={{ position: "relative" as const }}>
              <div style={{ fontSize: "10px", color: "rgba(102, 126, 234, 0.7)", marginBottom: DesignSystem.spacing.compact, fontWeight: "600", textTransform: "uppercase" as const, letterSpacing: "0.5px" }}>
                Current Week
              </div>
              <div style={{ 
                fontSize: "36px", 
                fontWeight: "700", 
                marginBottom: DesignSystem.spacing.compact,
                ...applyGradientText(DesignSystem.colors.gradients.primary)
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
            marginBottom: DesignSystem.spacing.element, 
            color: "rgba(0, 0, 0, 0.6)",
            textTransform: "uppercase" as const,
            letterSpacing: "0.5px"
          }}>
            Changes
          </h3>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px" }}>
            {[
              { label: "Distance", value: changes.distanceChange, suffix: "%", invertIcon: false },
              { label: "Number of Runs", value: changes.runsChange, suffix: "", invertIcon: false },
              { label: "Pace", value: changes.paceChange, suffix: "s/km", invertIcon: true }
            ].map((change, i) => {
              const color = getSemanticColor(change.invertIcon ? -change.value : change.value);
              const bgColor = getSemanticBackground(change.invertIcon ? -change.value : change.value);
              
              return (
                <div key={i} style={{
                  padding: `${DesignSystem.spacing.element} 20px`,
                  background: bgColor,
                  backdropFilter: DesignSystem.glassmorphism.backdropBlur,
                  borderRadius: DesignSystem.borderRadius.small,
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


mountWidget(<CompareTrainingWeeks />);
