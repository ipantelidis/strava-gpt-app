import "@/index.css";
import { generateHelpers, mountWidget } from "skybridge/web";
import type { AppType } from "../../../server/src/server";
import {
  DesignSystem,
  applyGlassmorphism,
  createGradientOverlay,
} from "../design-system";
import { ErrorBoundary } from "../ErrorBoundary";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

const { useToolInfo } = generateHelpers<AppType>();

interface GeoPoint {
  lat: number;
  lng: number;
}

interface ElevationPoint {
  distance: number; // km from start
  elevation: number; // meters
}

interface Waypoint {
  lat: number;
  lng: number;
  instruction: string;
}

interface POI {
  type: "water" | "restroom" | "emergency" | "landmark";
  lat: number;
  lng: number;
  name: string;
  description?: string;
}

interface RouteData {
  path: GeoPoint[];
  waypoints?: Waypoint[];
  pointsOfInterest?: POI[];
  elevationProfile?: ElevationPoint[];
  name?: string;
  distance?: number;
  elevationGain?: number;
  difficulty?: "easy" | "moderate" | "hard";
  highlights?: string[];
}

interface MapConfig {
  showElevation?: boolean;
  showPOIs?: boolean;
  showWaypoints?: boolean;
  mapStyle?: "standard" | "satellite" | "terrain";
}

function RenderRouteMapContent() {
  const toolInfo = useToolInfo<"render_route_map">();

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
          🗺️
        </div>
        <p
          style={{
            color: DesignSystem.colors.semantic.stable,
            margin: 0,
            fontSize: "14px",
          }}
        >
          Loading route map...
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
          Error loading route map
        </p>
      </div>
    );
  }

  if (!toolInfo.output) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>🗺️</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>
          No route data available
        </p>
      </div>
    );
  }

  const { route, config } = toolInfo.output as {
    route: RouteData;
    config?: MapConfig;
  };

  // Validate route data
  if (!route.path || route.path.length === 0) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>🗺️</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>
          Invalid route data: path is empty
        </p>
      </div>
    );
  }

  // Calculate bounds for the map
  const lats = route.path.map(p => p.lat);
  const lngs = route.path.map(p => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Calculate zoom level based on bounds
  const latDiff = maxLat - minLat;
  const lngDiff = maxLng - minLng;

  // POI type icons
  const getPOIIcon = (type: string): string => {
    switch (type) {
      case "water": return "💧";
      case "restroom": return "🚻";
      case "emergency": return "🚑";
      case "landmark": return "🏛️";
      default: return "📍";
    }
  };

  // Difficulty badge color
  const getDifficultyColor = (difficulty?: string): string => {
    switch (difficulty) {
      case "easy": return DesignSystem.colors.semantic.improvement;
      case "moderate": return "#f59e0b";
      case "hard": return DesignSystem.colors.semantic.decline;
      default: return DesignSystem.colors.semantic.stable;
    }
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
              DesignSystem.colors.gradients.tertiary,
              0.03
            ),
            height: "150px",
          }}
        />

        {/* Header */}
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
              justifyContent: "space-between",
              marginBottom: DesignSystem.spacing.element,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: DesignSystem.spacing.compact }}>
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#4facfe",
                  boxShadow: "0 0 12px #4facfe99",
                }}
              />
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: "600",
                  color: "rgba(0, 0, 0, 0.8)",
                }}
              >
                {route.name || "Running Route"}
              </h2>
            </div>
            
            {route.difficulty && (
              <div
                style={{
                  padding: `${DesignSystem.spacing.compact} ${DesignSystem.spacing.element}`,
                  background: `${getDifficultyColor(route.difficulty)}22`,
                  color: getDifficultyColor(route.difficulty),
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: "700",
                  textTransform: "uppercase" as const,
                  letterSpacing: "1px",
                  border: `1px solid ${getDifficultyColor(route.difficulty)}44`,
                }}
              >
                {route.difficulty}
              </div>
            )}
          </div>

          {/* Route stats */}
          {(route.distance || route.elevationGain) && (
            <div
              style={{
                display: "flex",
                gap: DesignSystem.spacing.section,
                fontSize: "14px",
                color: "rgba(0, 0, 0, 0.6)",
              }}
            >
              {route.distance && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "18px" }}>📏</span>
                  <span style={{ fontWeight: "600" }}>{route.distance.toFixed(1)} km</span>
                </div>
              )}
              {route.elevationGain && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "18px" }}>⛰️</span>
                  <span style={{ fontWeight: "600" }}>{Math.round(route.elevationGain)} m gain</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Map visualization */}
        <div
          style={{
            position: "relative" as const,
            marginBottom: DesignSystem.spacing.section,
            borderRadius: DesignSystem.borderRadius.element,
            overflow: "hidden" as const,
            background: "#f0f0f0",
            border: "2px solid rgba(79, 172, 254, 0.3)",
          }}
        >
          {/* Simple path visualization */}
          <div
            style={{
              width: "100%",
              height: "400px",
              position: "relative" as const,
              background: "linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%)",
            }}
          >
            <svg
              width="100%"
              height="100%"
              viewBox={`${minLng} ${minLat} ${lngDiff} ${latDiff}`}
              preserveAspectRatio="xMidYMid meet"
              style={{
                transform: "scaleY(-1)", // Flip Y axis for correct orientation
              }}
            >
              {/* Route path */}
              <polyline
                points={route.path.map(p => `${p.lng},${p.lat}`).join(" ")}
                fill="none"
                stroke="#4facfe"
                strokeWidth={lngDiff / 200}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.8"
              />
              
              {/* Start point */}
              <circle
                cx={route.path[0].lng}
                cy={route.path[0].lat}
                r={lngDiff / 100}
                fill="#10b981"
                stroke="white"
                strokeWidth={lngDiff / 400}
              />
              
              {/* End point */}
              <circle
                cx={route.path[route.path.length - 1].lng}
                cy={route.path[route.path.length - 1].lat}
                r={lngDiff / 100}
                fill="#ef4444"
                stroke="white"
                strokeWidth={lngDiff / 400}
              />
              
              {/* POIs */}
              {config?.showPOIs !== false && route.pointsOfInterest?.map((poi, idx) => (
                <circle
                  key={idx}
                  cx={poi.lng}
                  cy={poi.lat}
                  r={lngDiff / 150}
                  fill="#f59e0b"
                  stroke="white"
                  strokeWidth={lngDiff / 500}
                  opacity="0.9"
                />
              ))}
            </svg>
            
            {/* Legend overlay */}
            <div
              style={{
                position: "absolute" as const,
                bottom: "16px",
                left: "16px",
                ...applyGlassmorphism(0.95),
                padding: DesignSystem.spacing.element,
                borderRadius: DesignSystem.borderRadius.small,
                fontSize: "11px",
                display: "flex",
                gap: DesignSystem.spacing.element,
                flexWrap: "wrap" as const,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#10b981" }} />
                <span>Start</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#ef4444" }} />
                <span>Finish</span>
              </div>
              {config?.showPOIs !== false && route.pointsOfInterest && route.pointsOfInterest.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#f59e0b" }} />
                  <span>POI</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Elevation profile */}
        {config?.showElevation !== false && route.elevationProfile && route.elevationProfile.length > 0 && (
          <div
            style={{
              position: "relative" as const,
              marginBottom: DesignSystem.spacing.section,
            }}
          >
            <h3
              style={{
                fontSize: "14px",
                fontWeight: "600",
                marginBottom: DesignSystem.spacing.element,
                color: "rgba(0, 0, 0, 0.7)",
                display: "flex",
                alignItems: "center",
                gap: DesignSystem.spacing.compact,
              }}
            >
              <span style={{ fontSize: "18px" }}>📈</span>
              Elevation Profile
            </h3>
            <div style={{ height: "200px", width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={route.elevationProfile}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4facfe" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#4facfe" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.1)" vertical={false} />
                  <XAxis
                    dataKey="distance"
                    stroke="rgba(0, 0, 0, 0.4)"
                    style={{ fontSize: "11px" }}
                    label={{
                      value: "Distance (km)",
                      position: "insideBottom",
                      offset: -5,
                      style: { fontSize: "11px", fill: "rgba(0, 0, 0, 0.6)" },
                    }}
                    tickFormatter={(value) => value.toFixed(1)}
                  />
                  <YAxis
                    stroke="rgba(0, 0, 0, 0.4)"
                    style={{ fontSize: "11px" }}
                    label={{
                      value: "Elevation (m)",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: "11px", fill: "rgba(0, 0, 0, 0.6)" },
                    }}
                    tickFormatter={(value) => Math.round(value).toString()}
                  />
                  <Tooltip
                    contentStyle={{
                      ...applyGlassmorphism(0.95),
                      borderRadius: DesignSystem.borderRadius.small,
                      border: "none",
                      boxShadow: DesignSystem.shadows.element,
                      fontSize: "11px",
                    }}
                    formatter={(value: number | undefined) => {
                      if (value === undefined) return ["", "Elevation"];
                      return [`${Math.round(value)}m`, "Elevation"];
                    }}
                    labelFormatter={(label: any) => {
                      const numLabel = typeof label === 'number' ? label : parseFloat(String(label));
                      return `${numLabel.toFixed(2)} km`;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="elevation"
                    stroke="#4facfe"
                    strokeWidth={2}
                    fill="url(#elevationGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Highlights */}
        {route.highlights && route.highlights.length > 0 && (
          <div
            style={{
              position: "relative" as const,
              marginBottom: DesignSystem.spacing.section,
            }}
          >
            <h3
              style={{
                fontSize: "14px",
                fontWeight: "600",
                marginBottom: DesignSystem.spacing.element,
                color: "rgba(0, 0, 0, 0.7)",
              }}
            >
              ✨ Route Highlights
            </h3>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap" as const,
                gap: DesignSystem.spacing.compact,
              }}
            >
              {route.highlights.map((highlight, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: `${DesignSystem.spacing.compact} ${DesignSystem.spacing.element}`,
                    background: "rgba(79, 172, 254, 0.1)",
                    borderRadius: "16px",
                    fontSize: "12px",
                    color: "rgba(0, 0, 0, 0.7)",
                    border: "1px solid rgba(79, 172, 254, 0.3)",
                  }}
                >
                  {highlight}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Points of Interest */}
        {config?.showPOIs !== false && route.pointsOfInterest && route.pointsOfInterest.length > 0 && (
          <div style={{ position: "relative" as const }}>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: "600",
                marginBottom: DesignSystem.spacing.element,
                color: "rgba(0, 0, 0, 0.7)",
              }}
            >
              📍 Points of Interest
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: DesignSystem.spacing.element,
              }}
            >
              {route.pointsOfInterest.map((poi, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: DesignSystem.spacing.element,
                    background: "rgba(255, 255, 255, 0.5)",
                    backdropFilter: DesignSystem.glassmorphism.backdropBlur,
                    borderRadius: DesignSystem.borderRadius.small,
                    border: DesignSystem.glassmorphism.border,
                  }}
                >
                  <div
                    style={{
                      fontSize: "20px",
                      marginBottom: DesignSystem.spacing.compact,
                    }}
                  >
                    {getPOIIcon(poi.type)}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      marginBottom: "4px",
                      color: "rgba(0, 0, 0, 0.8)",
                    }}
                  >
                    {poi.name}
                  </div>
                  {poi.description && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "rgba(0, 0, 0, 0.5)",
                      }}
                    >
                      {poi.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Waypoints */}
        {config?.showWaypoints !== false && route.waypoints && route.waypoints.length > 0 && (
          <div
            style={{
              position: "relative" as const,
              marginTop: DesignSystem.spacing.section,
            }}
          >
            <h3
              style={{
                fontSize: "14px",
                fontWeight: "600",
                marginBottom: DesignSystem.spacing.element,
                color: "rgba(0, 0, 0, 0.7)",
              }}
            >
              🧭 Turn-by-Turn Directions
            </h3>
            <div
              style={{
                maxHeight: "300px",
                overflowY: "auto" as const,
                padding: DesignSystem.spacing.element,
                background: "rgba(0, 0, 0, 0.02)",
                borderRadius: DesignSystem.borderRadius.small,
              }}
            >
              {route.waypoints.map((waypoint, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: `${DesignSystem.spacing.compact} 0`,
                    borderBottom: idx < route.waypoints!.length - 1 ? "1px solid rgba(0, 0, 0, 0.1)" : "none",
                    display: "flex",
                    gap: DesignSystem.spacing.element,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      minWidth: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      background: "rgba(79, 172, 254, 0.2)",
                      color: "#4facfe",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: "700",
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(0, 0, 0, 0.7)", flex: 1 }}>
                    {waypoint.instruction}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RenderRouteMap() {
  return (
    <ErrorBoundary widgetName="render_route_map">
      <RenderRouteMapContent />
    </ErrorBoundary>
  );
}

mountWidget(<RenderRouteMap />);
