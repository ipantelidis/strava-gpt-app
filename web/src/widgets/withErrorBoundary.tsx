import "@/index.css";
import React from "react";
import { ErrorBoundary } from "../ErrorBoundary";

/**
 * Higher-order component that wraps a widget with an error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  widgetName: string
) {
  const WrappedComponent = (props: P) => {
    return (
      <ErrorBoundary widgetName={widgetName}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withErrorBoundary(${widgetName})`;

  return WrappedComponent;
}
