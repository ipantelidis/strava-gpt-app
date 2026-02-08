import "@/index.css";
import { generateHelpers, mountWidget } from "skybridge/web";
import type { AppType } from "../../../server/src/server";
import { DesignSystem, applyGradientText, createGradientOverlay, getSemanticColor, getTrendIcon } from "../design-system";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const { useToolInfo } = generateHelpers<AppType>();

export default function AnalyzeRunProgression() {
  const toolInfo = useToolInfo<"analyze_run_progression">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact, animation: "pulse 2s ease-in-out infinite" }}>📈</div>
        <p style={{ color: DesignSystem.colors.semantic.stable, margin: 0, fontSize: "14px" }}>Analyzing route progression...</p>
      </div>
    );
  }

  if (!toolInfo.isSuccess) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>⚠️</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>Error loading progression data</p>
      </div>
    );
  }

  const { route, progression, summary } = toolInfo.output as any;

  // Safety check
  if (!route || !progression || progression.length === 0) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>🔍</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.stable, fontSize: "14px" }}>
          No activities found for this route
        </p>
      </div>
    );
  }

  // Prepare chart data
  const chartData = progression.map((run: any) => ({
    date: run.date,
    pace: run.paceSeconds,
    displayPace: run.pace,
  }));

  // Calculate trend line (simple linear regression)
  const n = chartData.length;
  const sumX = chartData.reduce((sum: number, _: any, i: number) => sum + i, 0);
  const sumY = chartData.reduce((sum: number, d: any) => sum + d.pace, 0);
  const sumXY = chartData.reduce((sum: number, d: any, i: number) => sum + i * d.pace, 0);
  const sumX2 = chartData.reduce((sum: number, _: any, i: number) => sum + i * i, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Add trend line to data
  const chartDataWithTrend = chartData.map((d: any, i: number) => ({
    ...d,
    trend: intercept + slope * i,
  }));

  // Get trend color
  const trendColor = getSemanticColor(summary.improvementSeconds, true); // Inverted because lower pace is better

  return (
    <div style={{ 
      maxWidth: "800px",
      margin: "0 auto",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
    }}>
      <div style={{ 
        background: "white",
        borderRadius: DesignSystem.borderRadius.card, 
        padding: DesignSystem.spacing.card,
        border: "1px solid #e5e7eb",
        boxShadow: DesignSystem.shadows.card,
        position: "relative" as const,
        overflow: "hidden" as const
      }}>
        {/* Subtle gradient overlay */}
        <div style={{
          ...createGradientOverlay(DesignSystem.colors.gradients.tertiary, 0.03),
          height: "200px",
        }} />

        {/* Header */}
        <div style={{ position: "relative" as const, marginBottom: DesignSystem.spacing.card }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: DesignSystem.spacing.compact }}>
            <div style={{ display: "flex", alignItems: "center", gap: DesignSystem.spacing.compact }}>
              <div style={{ 
                width: "8px", 
                height: "8px", 
                borderRadius: "50%", 
                background: DesignSystem.colors.gradients.tertiary,
                boxShadow: `0 0 12px ${DesignSystem.colors.semantic.improvement}99`
              }} />
              <span style={{ 
                fontSize: "11px", 
                fontWeight: "600", 
                color: "rgba(0, 0, 0, 0.5)",
                textTransform: "uppercase" as const,
                letterSpacing: "1px"
              }}>
                Route Progression
              </span>
            </div>
            
            {/* Trend Badge */}
            <div style={{
              padding: "6px 12px",
              borderRadius: DesignSystem.borderRadius.small,
              background: `${trendColor}15`,
              border: `1px solid ${trendColor}30`,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}>
              <span style={{ fontSize: "14px" }}>{getTrendIcon(summary.improvementSeconds)}</span>
              <span style={{ 
                fontSize: "12px", 
                fontWeight: "600", 
                color: trendColor,
                textTransform: "capitalize" as const
              }}>
                {summary.trend}
              </span>
            </div>
          </div>
          <p style={{ color: "rgba(0, 0, 0, 0.4)", fontSize: "13px", margin: 0 }}>
            📍 {route.identifier} • {summary.totalRuns} runs • {summary.dateRange.first} → {summary.dateRange.last}
          </p>
        </div>

        {/* Summary Stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: DesignSystem.spacing.element,
          marginBottom: DesignSystem.spacing.card,
          position: "relative" as const
        }}>
          {[
            { 
              value: summary.bestPace, 
              label: "Best Pace /km", 
              gradient: DesignSystem.colors.gradients.quaternary,
              icon: "🏆"
            },
            { 
              value: summary.averagePace, 
              label: "Avg Pace /km", 
              gradient: DesignSystem.colors.gradients.tertiary,
              icon: "📊"
            },
            { 
              value: summary.worstPace, 
              label: "Slowest /km", 
              gradient: DesignSystem.colors.gradients.secondary,
              icon: "🐌"
            },
            { 
              value: `${summary.improvement > 0 ? "+" : ""}${summary.improvement}%`, 
              label: "Change", 
              gradient: DesignSystem.colors.gradients.primary,
              icon: summary.improvement > 0 ? "📈" : summary.improvement < 0 ? "📉" : "➡️"
            }
          ].map((stat, i) => (
            <div key={i} style={{ 
              padding: DesignSystem.spacing.section, 
              background: "#f8f9fa",
              backdropFilter: DesignSystem.glassmorphism.backdropBlur,
              borderRadius: DesignSystem.borderRadius.element,
              border: DesignSystem.glassmorphism.border,
              position: "relative" as const,
              overflow: "hidden" as const,
              transition: "all 0.3s ease"
            }}>
              <div style={createGradientOverlay(stat.gradient)} />
              <div style={{ position: "relative" as const }}>
                <div style={{ fontSize: "20px", marginBottom: "4px" }}>{stat.icon}</div>
                <div style={{ 
                  fontSize: "24px", 
                  fontWeight: "700", 
                  marginBottom: "4px",
                  ...applyGradientText(stat.gradient)
                }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: "10px", color: "rgba(0, 0, 0, 0.5)", fontWeight: "500" }}>
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Progression Chart */}
        <div style={{ 
          position: "relative" as const, 
          marginBottom: DesignSystem.spacing.card,
          background: "#f8f9fa",
          borderRadius: DesignSystem.borderRadius.element,
          padding: DesignSystem.spacing.section,
        }}>
          <h3 style={{ 
            fontSize: "13px", 
            fontWeight: "600", 
            marginBottom: DesignSystem.spacing.element, 
            color: "rgba(0, 0, 0, 0.6)",
            textTransform: "uppercase" as const,
            letterSpacing: "0.5px"
          }}>
            Pace Over Time
          </h3>
          
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartDataWithTrend} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.1)" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11, fill: "rgba(0, 0, 0, 0.5)" }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: "rgba(0, 0, 0, 0.5)" }}
                tickFormatter={(value) => {
                  const minutes = Math.floor(value / 60);
                  const seconds = Math.round(value % 60);
                  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
                }}
                domain={['dataMin - 10', 'dataMax + 10']}
                reversed
              />
              <Tooltip 
                contentStyle={{
                  background: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid rgba(0, 0, 0, 0.1)",
                  borderRadius: DesignSystem.borderRadius.small,
                  fontSize: "12px",
                  boxShadow: DesignSystem.shadows.element,
                }}
                formatter={(value: any, name?: string) => {
                  if (name === "pace") {
                    return [chartDataWithTrend.find((d: any) => d.pace === value)?.displayPace || value, "Pace"];
                  }
                  return [value, name || ""];
                }}
              />
              
              {/* Trend line */}
              <Line 
                type="monotone" 
                dataKey="trend" 
                stroke={trendColor}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Trend"
              />
              
              {/* Actual pace line */}
              <Line 
                type="monotone" 
                dataKey="pace" 
                stroke="url(#colorGradient)" 
                strokeWidth={3}
                dot={{ fill: "#4facfe", r: 4 }}
                activeDot={{ r: 6 }}
                name="Pace"
              />
              
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4facfe" />
                  <stop offset="100%" stopColor="#00f2fe" />
                </linearGradient>
              </defs>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Runs Table */}
        <div style={{ position: "relative" as const }}>
          <h3 style={{ 
            fontSize: "13px", 
            fontWeight: "600", 
            marginBottom: DesignSystem.spacing.element, 
            color: "rgba(0, 0, 0, 0.6)",
            textTransform: "uppercase" as const,
            letterSpacing: "0.5px"
          }}>
            All Runs on This Route
          </h3>
          <div style={{ 
            display: "flex", 
            flexDirection: "column" as const, 
            gap: DesignSystem.spacing.compact,
            maxHeight: "300px",
            overflowY: "auto" as const,
          }}>
            {progression.map((run: any, i: number) => (
              <div
                key={i}
                style={{
                  padding: `${DesignSystem.spacing.element} 20px`,
                  background: "#f3f4f6",
                  backdropFilter: DesignSystem.glassmorphism.backdropBlur,
                  borderRadius: DesignSystem.borderRadius.small,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "13px",
                  border: DesignSystem.glassmorphism.border,
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "4px" }}>
                  <span style={{ fontWeight: "600", color: "rgba(0, 0, 0, 0.7)" }}>
                    {run.date}
                  </span>
                  <span style={{ fontSize: "11px", color: "rgba(0, 0, 0, 0.4)" }}>
                    {run.name}
                  </span>
                </div>
                <span style={{ 
                  color: "rgba(0, 0, 0, 0.5)", 
                  fontSize: "12px",
                  fontFamily: "ui-monospace, monospace",
                  display: "flex",
                  gap: "12px"
                }}>
                  <span style={{ fontWeight: "600" }}>{run.pace}/km</span>
                  <span>•</span>
                  <span>{run.distance}km</span>
                  <span>•</span>
                  <span>{run.duration}min</span>
                  {run.elevation > 0 && (
                    <>
                      <span>•</span>
                      <span>↗ {run.elevation}m</span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


mountWidget(<AnalyzeRunProgression />);
