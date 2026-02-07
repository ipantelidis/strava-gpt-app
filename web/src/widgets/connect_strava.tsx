import { generateHelpers } from "skybridge/web";
import type { AppType } from "../../../server/src/server";
import { DesignSystem, applyGlassmorphism, createGradientOverlay } from "../design-system";

const { useToolInfo } = generateHelpers<AppType>();

export default function ConnectStrava() {
  const toolInfo = useToolInfo<"connect_strava">();

  if (toolInfo.isPending) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>
          🔐
        </div>
        <p style={{ color: DesignSystem.colors.semantic.stable, margin: 0, fontSize: "14px" }}>
          Loading...
        </p>
      </div>
    );
  }

  if (!toolInfo.isSuccess) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>
          ⚠️
        </div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>
          Error loading authorization
        </p>
      </div>
    );
  }

  const { authUrl } = toolInfo.output as { authUrl: string; serverUrl: string };

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
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
            ...createGradientOverlay(DesignSystem.colors.gradients.primary, 0.05),
            height: "150px",
          }}
        />

        {/* Content */}
        <div style={{ position: "relative" as const }}>
          {/* Icon */}
          <div style={{ textAlign: "center", fontSize: "64px", marginBottom: DesignSystem.spacing.section }}>
            🔐
          </div>

          {/* Title */}
          <h2
            style={{
              margin: 0,
              marginBottom: DesignSystem.spacing.element,
              fontSize: "24px",
              fontWeight: "600",
              color: "rgba(0, 0, 0, 0.8)",
              textAlign: "center",
            }}
          >
            Connect Your Strava Account
          </h2>

          {/* Description */}
          <p
            style={{
              margin: 0,
              marginBottom: DesignSystem.spacing.card,
              fontSize: "16px",
              color: "rgba(0, 0, 0, 0.6)",
              textAlign: "center",
              lineHeight: "1.5",
            }}
          >
            To analyze your training data, I need access to your Strava activities.
          </p>

          {/* Connect Button */}
          <div style={{ textAlign: "center", marginBottom: DesignSystem.spacing.card }}>
            <a
              href={authUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                background: DesignSystem.colors.gradients.primary,
                color: "white",
                padding: "16px 48px",
                borderRadius: DesignSystem.borderRadius.element,
                fontSize: "18px",
                fontWeight: "600",
                textDecoration: "none",
                boxShadow: "0 4px 12px rgba(102, 126, 234, 0.4)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.5)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(102, 126, 234, 0.4)";
              }}
            >
              Connect Strava
            </a>
          </div>

          {/* Instructions */}
          <div
            style={{
              background: "rgba(102, 126, 234, 0.05)",
              border: "1px solid rgba(102, 126, 234, 0.2)",
              borderRadius: DesignSystem.borderRadius.small,
              padding: DesignSystem.spacing.section,
            }}
          >
            <h4
              style={{
                margin: 0,
                marginBottom: DesignSystem.spacing.element,
                fontSize: "14px",
                fontWeight: "600",
                color: "rgba(0, 0, 0, 0.7)",
              }}
            >
              What happens next:
            </h4>
            <ol
              style={{
                margin: 0,
                paddingLeft: "20px",
                fontSize: "14px",
                color: "rgba(0, 0, 0, 0.6)",
                lineHeight: "1.6",
              }}
            >
              <li>You'll be redirected to Strava's authorization page</li>
              <li>Click "Authorize" to grant access to your activities</li>
              <li>You'll receive an access token on the callback page</li>
              <li>Copy the token and provide it when using the training tools</li>
            </ol>
            <p
              style={{
                margin: 0,
                marginTop: DesignSystem.spacing.element,
                fontSize: "12px",
                color: "rgba(0, 0, 0, 0.5)",
              }}
            >
              💡 The token is valid for 6 hours
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
