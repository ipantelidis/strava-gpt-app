import React, { Component, ReactNode } from "react";
import { DesignSystem } from "./design-system";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: React.ErrorInfo) => ReactNode;
  widgetName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary component that catches rendering errors in widgets
 * and provides a fallback UI with text-based presentation
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Widget rendering error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo!);
      }

      // Default fallback UI
      return (
        <div
          style={{
            maxWidth: "640px",
            margin: "0 auto",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: DesignSystem.borderRadius.card,
              padding: DesignSystem.spacing.card,
              border: `2px solid ${DesignSystem.colors.semantic.decline}`,
              boxShadow: DesignSystem.shadows.card,
            }}
          >
            {/* Error Icon */}
            <div
              style={{
                fontSize: "48px",
                textAlign: "center",
                marginBottom: DesignSystem.spacing.element,
              }}
            >
              ⚠️
            </div>

            {/* Error Title */}
            <h2
              style={{
                margin: 0,
                marginBottom: DesignSystem.spacing.element,
                fontSize: "20px",
                fontWeight: "600",
                color: DesignSystem.colors.semantic.decline,
                textAlign: "center",
              }}
            >
              Widget Rendering Error
            </h2>

            {/* Error Message */}
            <div
              style={{
                padding: DesignSystem.spacing.element,
                background: "rgba(239, 68, 68, 0.05)",
                borderRadius: DesignSystem.borderRadius.small,
                marginBottom: DesignSystem.spacing.section,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "14px",
                  color: "rgba(0, 0, 0, 0.7)",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {this.state.error.message}
              </p>
            </div>

            {/* Widget Name */}
            {this.props.widgetName && (
              <p
                style={{
                  margin: 0,
                  marginBottom: DesignSystem.spacing.element,
                  fontSize: "13px",
                  color: "rgba(0, 0, 0, 0.5)",
                }}
              >
                <strong>Widget:</strong> {this.props.widgetName}
              </p>
            )}

            {/* Fallback Instructions */}
            <div
              style={{
                padding: DesignSystem.spacing.element,
                background: "rgba(0, 0, 0, 0.02)",
                borderRadius: DesignSystem.borderRadius.small,
                marginTop: DesignSystem.spacing.section,
              }}
            >
              <p
                style={{
                  margin: 0,
                  marginBottom: DesignSystem.spacing.compact,
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "rgba(0, 0, 0, 0.7)",
                }}
              >
                What you can do:
              </p>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: "20px",
                  fontSize: "13px",
                  color: "rgba(0, 0, 0, 0.6)",
                  lineHeight: "1.6",
                }}
              >
                <li>Try refreshing the page</li>
                <li>Check if your data is in the expected format</li>
                <li>Use a data tool to fetch raw data instead</li>
                <li>Report this issue if it persists</li>
              </ul>
            </div>

            {/* Stack Trace (collapsed by default) */}
            {this.state.errorInfo && (
              <details
                style={{
                  marginTop: DesignSystem.spacing.section,
                  fontSize: "11px",
                  color: "rgba(0, 0, 0, 0.5)",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontWeight: "600",
                    marginBottom: DesignSystem.spacing.compact,
                  }}
                >
                  Technical Details
                </summary>
                <pre
                  style={{
                    margin: 0,
                    padding: DesignSystem.spacing.compact,
                    background: "rgba(0, 0, 0, 0.05)",
                    borderRadius: DesignSystem.borderRadius.small,
                    overflow: "auto",
                    maxHeight: "200px",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "10px",
                  }}
                >
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
