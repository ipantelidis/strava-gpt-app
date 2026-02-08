import "@/index.css";
import { generateHelpers, mountWidget } from "skybridge/web";
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

  // Safety check - ensure output exists before destructuring
  if (!toolInfo.output) {
    return (
      <div style={{ padding: DesignSystem.spacing.card, textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: DesignSystem.spacing.compact }}>⚠️</div>
        <p style={{ margin: 0, color: DesignSystem.colors.semantic.decline, fontSize: "14px" }}>
          No authorization data available
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
              <li>Click the "Connect Strava" button above</li>
              <li>You'll be redirected to Strava's authorization page</li>
              <li>Click "Authorize" to grant access</li>
              <li><strong>Copy the authorization code from the URL</strong> (after <code>?code=</code>)</li>
              <li>Return here and say: "My code is [paste the code]"</li>
              <li>I'll exchange it for an access token</li>
            </ol>
            <p
              style={{
                margin: 0,
                marginTop: DesignSystem.spacing.element,
                fontSize: "12px",
                color: "rgba(0, 0, 0, 0.5)",
                background: "rgba(245, 158, 11, 0.1)",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid rgba(245, 158, 11, 0.3)",
              }}
            >
              💡 <strong>Example:</strong> If the URL is <code>http://localhost:3000/oauth/callback?code=abc123xyz</code>, copy <code>abc123xyz</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
mountWidget(<ConnectStrava />);
