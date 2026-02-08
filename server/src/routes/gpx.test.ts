/**
 * Tests for GPX generation utilities
 */

import { describe, it, expect } from "vitest";
import { generateGPX, validateGPX, type GPXTrackPoint } from "./gpx.js";

describe("GPX Generation", () => {
  it("should generate valid GPX from track points", () => {
    const trackPoints: GPXTrackPoint[] = [
      { lat: 48.8566, lng: 2.3522, elevation: 35 },
      { lat: 48.8576, lng: 2.3532, elevation: 36 },
      { lat: 48.8586, lng: 2.3542, elevation: 37 },
    ];

    const gpx = generateGPX(trackPoints, {
      name: "Test Route",
      description: "A test route in Paris",
      author: "Test Runner",
    });

    expect(gpx).toContain('<?xml version="1.0"');
    expect(gpx).toContain("<gpx");
    expect(gpx).toContain("<trk>");
    expect(gpx).toContain("<trkseg>");
    expect(gpx).toContain("<trkpt");
    expect(gpx).toContain("Test Route");
    expect(gpx).toContain("A test route in Paris");
    expect(gpx).toContain("Test Runner");
  });

  it("should include elevation data when provided", () => {
    const trackPoints: GPXTrackPoint[] = [
      { lat: 48.8566, lng: 2.3522, elevation: 35 },
      { lat: 48.8576, lng: 2.3532, elevation: 36 },
    ];

    const gpx = generateGPX(trackPoints, {
      name: "Elevation Test",
    });

    expect(gpx).toContain("<ele>35</ele>");
    expect(gpx).toContain("<ele>36</ele>");
  });

  it("should handle track points without elevation", () => {
    const trackPoints: GPXTrackPoint[] = [
      { lat: 48.8566, lng: 2.3522 },
      { lat: 48.8576, lng: 2.3532 },
    ];

    const gpx = generateGPX(trackPoints, {
      name: "No Elevation Test",
    });

    expect(gpx).not.toContain("<ele>");
    expect(gpx).toContain("<trkpt");
  });

  it("should escape XML special characters", () => {
    const trackPoints: GPXTrackPoint[] = [
      { lat: 48.8566, lng: 2.3522 },
    ];

    const gpx = generateGPX(trackPoints, {
      name: "Route with <special> & 'characters'",
      description: 'Test "quotes" & <tags>',
    });

    expect(gpx).toContain("&lt;special&gt;");
    expect(gpx).toContain("&amp;");
    expect(gpx).toContain("&apos;");
    expect(gpx).toContain("&quot;");
  });

  it("should validate correct GPX format", () => {
    const trackPoints: GPXTrackPoint[] = [
      { lat: 48.8566, lng: 2.3522, elevation: 35 },
      { lat: 48.8576, lng: 2.3532, elevation: 36 },
    ];

    const gpx = generateGPX(trackPoints, {
      name: "Valid Route",
    });

    expect(validateGPX(gpx)).toBe(true);
  });

  it("should reject invalid GPX format", () => {
    const invalidGPX = "<invalid>not a gpx file</invalid>";
    expect(validateGPX(invalidGPX)).toBe(false);
  });

  it("should include timestamp in metadata", () => {
    const trackPoints: GPXTrackPoint[] = [
      { lat: 48.8566, lng: 2.3522 },
    ];

    const timestamp = "2024-01-15T10:30:00Z";
    const gpx = generateGPX(trackPoints, {
      name: "Timestamp Test",
      time: timestamp,
    });

    expect(gpx).toContain(`<time>${timestamp}</time>`);
  });

  it("should use current time if not provided", () => {
    const trackPoints: GPXTrackPoint[] = [
      { lat: 48.8566, lng: 2.3522 },
    ];

    const gpx = generateGPX(trackPoints, {
      name: "Auto Timestamp Test",
    });

    expect(gpx).toContain("<time>");
    expect(gpx).toMatch(/<time>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
