/**
 * Design System Module
 * 
 * Provides shared design tokens, constants, and utility functions
 * for consistent styling across all widgets and visualizations.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import type { CSSProperties } from "react";

/**
 * Color palette with gradients and semantic colors
 */
export interface ColorTokens {
  gradients: {
    primary: string;
    secondary: string;
    tertiary: string;
    quaternary: string;
  };
  semantic: {
    improvement: string;
    decline: string;
    stable: string;
  };
}

/**
 * Glassmorphism effect tokens
 */
export interface GlassmorphismTokens {
  backdropBlur: string;
  background: string;
  border: string;
}

/**
 * Spacing scale tokens
 */
export interface SpacingTokens {
  card: string;
  section: string;
  element: string;
  compact: string;
}

/**
 * Border radius tokens
 */
export interface BorderRadiusTokens {
  card: string;
  element: string;
  small: string;
}

/**
 * Shadow tokens
 */
export interface ShadowTokens {
  card: string;
  element: string;
}

/**
 * Complete design system tokens
 */
export interface DesignTokens {
  colors: ColorTokens;
  glassmorphism: GlassmorphismTokens;
  spacing: SpacingTokens;
  borderRadius: BorderRadiusTokens;
  shadows: ShadowTokens;
}

/**
 * Design System Constants
 * 
 * Central source of truth for all design tokens used across the application.
 */
export const DesignSystem: DesignTokens = {
  colors: {
    gradients: {
      primary: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      secondary: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
      tertiary: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
      quaternary: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    },
    semantic: {
      improvement: "#10b981",
      decline: "#ef4444",
      stable: "#6b7280",
    },
  },
  glassmorphism: {
    backdropBlur: "blur(10px)",
    background: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  },
  spacing: {
    card: "32px",
    section: "24px",
    element: "16px",
    compact: "8px",
  },
  borderRadius: {
    card: "24px",
    element: "16px",
    small: "12px",
  },
  shadows: {
    card: "0 20px 60px rgba(0, 0, 0, 0.08)",
    element: "0 4px 12px rgba(0, 0, 0, 0.05)",
  },
};

/**
 * Utility function to apply glassmorphism effect
 * 
 * @param opacity - Optional custom opacity (0-1)
 * @returns CSSProperties object with glassmorphism styles
 */
export function applyGlassmorphism(opacity?: number): CSSProperties {
  const bgOpacity = opacity !== undefined ? opacity : 0.1;
  
  return {
    backdropFilter: DesignSystem.glassmorphism.backdropBlur,
    background: `rgba(255, 255, 255, ${bgOpacity})`,
    border: DesignSystem.glassmorphism.border,
  };
}

/**
 * Utility function to apply gradient text effect
 * 
 * @param gradient - Gradient string from DesignSystem.colors.gradients
 * @returns CSSProperties object for gradient text
 */
export function applyGradientText(gradient: string): CSSProperties {
  return {
    background: gradient,
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  };
}

/**
 * Utility function to get semantic color based on value change
 * 
 * @param value - Numeric value (positive = improvement, negative = decline, zero = stable)
 * @param inverted - If true, negative values are improvements (e.g., for pace)
 * @returns Semantic color string
 */
export function getSemanticColor(value: number, inverted: boolean = false): string {
  if (value === 0) return DesignSystem.colors.semantic.stable;
  
  const isPositive = inverted ? value < 0 : value > 0;
  return isPositive 
    ? DesignSystem.colors.semantic.improvement 
    : DesignSystem.colors.semantic.decline;
}

/**
 * Utility function to get semantic background color with opacity
 * 
 * @param value - Numeric value
 * @param inverted - If true, negative values are improvements
 * @param opacity - Background opacity (default: 0.08)
 * @returns RGBA color string
 */
export function getSemanticBackground(
  value: number, 
  inverted: boolean = false,
  opacity: number = 0.08
): string {
  const color = getSemanticColor(value, inverted);
  
  // Extract RGB values from hex color
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Utility function to apply card styling
 * 
 * @param variant - Card variant: "default" | "elevated" | "glass"
 * @returns CSSProperties object for card styling
 */
export function applyCardStyle(variant: "default" | "elevated" | "glass" = "default"): CSSProperties {
  const baseStyle: CSSProperties = {
    borderRadius: DesignSystem.borderRadius.card,
    padding: DesignSystem.spacing.card,
    position: "relative",
    overflow: "hidden",
  };

  switch (variant) {
    case "elevated":
      return {
        ...baseStyle,
        background: "white",
        border: "1px solid #e5e7eb",
        boxShadow: DesignSystem.shadows.card,
      };
    
    case "glass":
      return {
        ...baseStyle,
        ...applyGlassmorphism(0.02),
        backdropFilter: "blur(20px)",
        boxShadow: `${DesignSystem.shadows.card}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`,
      };
    
    case "default":
    default:
      return {
        ...baseStyle,
        background: "white",
        border: "1px solid #e5e7eb",
        boxShadow: DesignSystem.shadows.card,
      };
  }
}

/**
 * Utility function to create gradient overlay style
 * 
 * @param gradient - Gradient string
 * @param opacity - Opacity of the overlay (default: 0.08)
 * @returns CSSProperties object for gradient overlay
 */
export function createGradientOverlay(gradient: string, opacity: number = 0.08): CSSProperties {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: gradient,
    opacity,
    pointerEvents: "none",
  };
}

/**
 * Utility function to get trend icon
 * 
 * @param value - Numeric value
 * @returns Arrow icon string
 */
export function getTrendIcon(value: number): string {
  if (value > 0) return "↑";
  if (value < 0) return "↓";
  return "→";
}

/**
 * Utility function to format pace (min:sec per km)
 * 
 * @param paceString - Pace string in "M:SS" format
 * @returns Formatted pace string with unit
 */
export function formatPace(paceString: string): string {
  return `${paceString}/km`;
}

/**
 * Utility function to format distance
 * 
 * @param distanceKm - Distance in kilometers
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted distance string with unit
 */
export function formatDistance(distanceKm: number, decimals: number = 1): string {
  return `${distanceKm.toFixed(decimals)}km`;
}

/**
 * Utility function to format elevation
 * 
 * @param elevationMeters - Elevation in meters
 * @returns Formatted elevation string with unit
 */
export function formatElevation(elevationMeters: number): string {
  return `${Math.round(elevationMeters)}m`;
}
