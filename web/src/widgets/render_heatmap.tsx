import "@/index.css";
import React from "react";
import { generateHelpers, mountWidget } from "skybridge/web";
import type { AppType } from "../../../server/src/server";
import {
  DesignSystem,
  applyGlassmorphism,
  createGradientOverlay,
} from "../design-system";
import { ErrorBoundary } from "../ErrorBoundary";

const { useToolInfo } = generateHelpers<AppType>();

interface HeatmapDataPoint {
  date: string; // ISO date string (YYYY-MM-DD)
  intensity: number; // 0-1 scale representing activity intensity
  details?: {
    distance?: number;
    duration?: number;
    pace?: string;
    activityName?: string;
  };
}

interface HeatmapConfig {
  title?: string;
  startDate?: string; // ISO date string for calendar start
  colorGradient?: string[]; // Array of colors from low to high intensity
  showTooltips?: boolean;
  showMonthLabels?: boolean;
  showDayLabels?: boolean;
}

function RenderHeatmapContent() {
  const toolInfo = useToolInfo<"render_heatmap">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div
          style={{
            fontSize: "40px",
            marginBottom: DesignSystem.spacing.compact,
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          📅
        </div>
        <p
          style={{
            color: DesignSystem.colors.semantic.stable,
            margin: 0,
            fontSize: "14px",
          }}
        >
          Loading heatmap...
        </p>
      </div>
    );
  }

  if (!toolInfo.isSuccess) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div
          style={{
            fontSize: "40px",
            marginBottom: DesignSystem.spacing.compact,
          }}
        >
          ⚠️
        </div>
        <p
          style={{
            margin: 0,
            color: DesignSystem.colors.semantic.decline,
            fontSize: "14px",
          }}
        >
          Error loading heatmap
        </p>
      </div>
    );
  }

  // Safety check - ensure output exists before destructuring
  if (!toolInfo.output) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>📊</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>
          No heatmap data available
        </p>
      </div>
    );
  }

  const { data, config } = toolInfo.output as {
    data: HeatmapDataPoint[];
    config?: HeatmapConfig;
  };

  // Create a map for quick date lookups
  const dataMap = new Map<string, HeatmapDataPoint>();
  data.forEach((point) => {
    dataMap.set(point.date, point);
  });

  // Determine date range
  const dates = data.map((d) => new Date(d.date));
  const minDate = config?.startDate
    ? new Date(config.startDate)
    : dates.length > 0
    ? new Date(Math.min(...dates.map((d) => d.getTime())))
    : new Date();

  // Calculate weeks to display (default: 12 weeks)
  const weeksToShow = 12;
  const daysToShow = weeksToShow * 7;

  // Generate calendar grid
  const calendarStart = new Date(minDate);
  calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay()); // Start on Sunday

  const calendarDays: Array<{
    date: Date;
    dateString: string;
    intensity: number;
    details?: HeatmapDataPoint["details"];
  }> = [];

  for (let i = 0; i < daysToShow; i++) {
    const currentDate = new Date(calendarStart);
    currentDate.setDate(currentDate.getDate() + i);
    const dateString = currentDate.toISOString().split("T")[0];
    const dataPoint = dataMap.get(dateString);

    calendarDays.push({
      date: currentDate,
      dateString,
      intensity: dataPoint?.intensity || 0,
      details: dataPoint?.details,
    });
  }

  // Group by weeks
  const weeks: typeof calendarDays[] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  // Default color gradient from design system
  const defaultGradient = [
    "rgba(0, 0, 0, 0.03)", // No activity
    "rgba(102, 126, 234, 0.2)", // Low intensity
    "rgba(102, 126, 234, 0.4)",
    "rgba(102, 126, 234, 0.6)",
    "rgba(102, 126, 234, 0.8)",
    "rgba(102, 126, 234, 1.0)", // High intensity
  ];

  const colorGradient = config?.colorGradient || defaultGradient;

  // Map intensity to color
  const getColor = (intensity: number): string => {
    if (intensity === 0) return colorGradient[0];
    const index = Math.min(
      Math.floor(intensity * (colorGradient.length - 1)) + 1,
      colorGradient.length - 1
    );
    return colorGradient[index];
  };

  // Month labels
  const monthLabels: Array<{ month: string; weekIndex: number }> = [];
  let lastMonth = -1;
  weeks.forEach((week, weekIndex) => {
    const firstDay = week[0].date;
    const month = firstDay.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({
        month: firstDay.toLocaleDateString("en-US", { month: "short" }),
        weekIndex,
      });
      lastMonth = month;
    }
  });

  // Day labels
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Tooltip state
  const [hoveredDay, setHoveredDay] = React.useState<typeof calendarDays[0] | null>(null);
  const [tooltipPosition, setTooltipPosition] = React.useState<{ x: number; y: number } | null>(null);

  const handleMouseEnter = (day: typeof calendarDays[0], event: React.MouseEvent) => {
    if (config?.showTooltips !== false && day.intensity > 0) {
      setHoveredDay(day);
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
    setTooltipPosition(null);
  };

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
      }}
    >
      <div
        style={{
          ...applyGlassmorphism(0.02),
          borderRadius: DesignSystem.borderRadius.card,
          padding: DesignSystem.spacing.card,
          boxShadow: `${DesignSystem.shadows.card}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
          position: "relative" as const,
          overflow: "hidden" as const,
        }}
      >
        {/* Gradient overlay */}
        <div
          style={{
            ...createGradientOverlay(
              DesignSystem.colors.gradients.quaternary,
              0.03
            ),
            height: "120px",
          }}
        />

        {/* Header */}
        {config?.title && (
          <div
            style={{
              position: "relative" as const,
              marginBottom: DesignSystem.spacing.section,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: DesignSystem.spacing.compact,
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: colorGradient[colorGradient.length - 1],
                  boxShadow: `0 0 12px ${colorGradient[colorGradient.length - 1]}99`,
                }}
              />
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "rgba(0, 0, 0, 0.8)",
                }}
              >
                {config.title}
              </h2>
            </div>
          </div>
        )}

        {/* Calendar Grid */}
        <div
          style={{
            position: "relative" as const,
            display: "flex",
            gap: DesignSystem.spacing.element,
          }}
        >
          {/* Day labels */}
          {(config?.showDayLabels !== false) && (
            <div
              style={{
                display: "flex",
                flexDirection: "column" as const,
                gap: "4px",
                paddingTop: "24px",
              }}
            >
              {dayLabels.map((day, index) => (
                <div
                  key={index}
                  style={{
                    height: "14px",
                    fontSize: "10px",
                    color: "rgba(0, 0, 0, 0.4)",
                    fontWeight: "500",
                    display: "flex",
                    alignItems: "center",
                    paddingRight: DesignSystem.spacing.compact,
                  }}
                >
                  {day}
                </div>
              ))}
            </div>
          )}

          {/* Calendar weeks */}
          <div style={{ flex: 1 }}>
            {/* Month labels */}
            {(config?.showMonthLabels !== false) && (
              <div
                style={{
                  display: "flex",
                  marginBottom: DesignSystem.spacing.compact,
                  height: "20px",
                  position: "relative" as const,
                }}
              >
                {monthLabels.map((label, index) => (
                  <div
                    key={index}
                    style={{
                      position: "absolute" as const,
                      left: `${(label.weekIndex / weeks.length) * 100}%`,
                      fontSize: "11px",
                      fontWeight: "600",
                      color: "rgba(0, 0, 0, 0.5)",
                    }}
                  >
                    {label.month}
                  </div>
                ))}
              </div>
            )}

            {/* Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${weeks.length}, 1fr)`,
                gap: "4px",
              }}
            >
              {weeks.map((week, weekIndex) => (
                <div
                  key={weekIndex}
                  style={{
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: "4px",
                  }}
                >
                  {week.map((day, dayIndex) => (
                    <div
                      key={dayIndex}
                      style={{
                        width: "14px",
                        height: "14px",
                        backgroundColor: getColor(day.intensity),
                        borderRadius: "3px",
                        border: "1px solid rgba(0, 0, 0, 0.05)",
                        cursor: day.intensity > 0 ? "pointer" : "default",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => handleMouseEnter(day, e)}
                      onMouseLeave={handleMouseLeave}
                      title={day.intensity > 0 ? day.dateString : undefined}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            position: "relative" as const,
            marginTop: DesignSystem.spacing.section,
            display: "flex",
            alignItems: "center",
            gap: DesignSystem.spacing.compact,
            fontSize: "11px",
            color: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <span style={{ fontWeight: "500" }}>Less</span>
          <div style={{ display: "flex", gap: "4px" }}>
            {colorGradient.map((color, index) => (
              <div
                key={index}
                style={{
                  width: "14px",
                  height: "14px",
                  backgroundColor: color,
                  borderRadius: "3px",
                  border: "1px solid rgba(0, 0, 0, 0.05)",
                }}
              />
            ))}
          </div>
          <span style={{ fontWeight: "500" }}>More</span>
        </div>

        {/* Tooltip */}
        {hoveredDay && tooltipPosition && (
          <div
            style={{
              position: "fixed" as const,
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: "translate(-50%, -100%)",
              ...applyGlassmorphism(0.95),
              padding: DesignSystem.spacing.element,
              borderRadius: DesignSystem.borderRadius.small,
              boxShadow: DesignSystem.shadows.element,
              pointerEvents: "none" as const,
              zIndex: 1000,
              minWidth: "150px",
            }}
          >
            <p
              style={{
                margin: 0,
                marginBottom: DesignSystem.spacing.compact,
                fontSize: "11px",
                fontWeight: "600",
                color: "rgba(0, 0, 0, 0.7)",
              }}
            >
              {hoveredDay.date.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
            {hoveredDay.details?.activityName && (
              <p
                style={{
                  margin: 0,
                  marginBottom: "4px",
                  fontSize: "12px",
                  fontWeight: "500",
                  color: "rgba(0, 0, 0, 0.8)",
                }}
              >
                {hoveredDay.details.activityName}
              </p>
            )}
            {hoveredDay.details?.distance !== undefined && (
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  color: "rgba(0, 0, 0, 0.6)",
                }}
              >
                <strong>Distance:</strong> {hoveredDay.details.distance}km
              </p>
            )}
            {hoveredDay.details?.duration !== undefined && (
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  color: "rgba(0, 0, 0, 0.6)",
                }}
              >
                <strong>Duration:</strong> {hoveredDay.details.duration}min
              </p>
            )}
            {hoveredDay.details?.pace && (
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  color: "rgba(0, 0, 0, 0.6)",
                }}
              >
                <strong>Pace:</strong> {hoveredDay.details.pace}/km
              </p>
            )}
            <p
              style={{
                margin: 0,
                marginTop: "4px",
                fontSize: "10px",
                color: "rgba(0, 0, 0, 0.4)",
              }}
            >
              Intensity: {Math.round(hoveredDay.intensity * 100)}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RenderHeatmap() {
  return (
    <ErrorBoundary widgetName="render_heatmap">
      <RenderHeatmapContent />
    </ErrorBoundary>
  );
}

mountWidget(<RenderHeatmap />);
