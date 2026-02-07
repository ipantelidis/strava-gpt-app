/**
 * Unit tests for data tools
 */

import { describe, it, expect } from "vitest";

describe("get_run_comparison logic", () => {
  it("should calculate correct distance delta percentage", () => {
    const run1Distance = 5000; // 5km in meters
    const run2Distance = 6000; // 6km in meters
    
    const distanceDelta = run2Distance - run1Distance;
    const distancePercentage = Math.round((distanceDelta / run1Distance) * 100 * 10) / 10;
    
    expect(distancePercentage).toBe(20.0);
  });

  it("should calculate correct pace delta in seconds per km", () => {
    const run1Speed = 3.33; // ~5:00/km pace
    const run2Speed = 3.57; // ~4:40/km pace (faster)
    
    const run1PaceSecondsPerKm = 1000 / run1Speed;
    const run2PaceSecondsPerKm = 1000 / run2Speed;
    const paceDelta = run2PaceSecondsPerKm - run1PaceSecondsPerKm;
    
    expect(Math.round(paceDelta)).toBe(-20); // Negative means faster
  });

  it("should determine improving trend when pace is faster", () => {
    const paceDelta = -15; // 15 seconds faster per km
    const distancePercentage = 5; // Similar distance
    
    let trend: "improving" | "declining" | "stable" = "stable";
    
    if (paceDelta < -10 || (distancePercentage > 15 && paceDelta < 5)) {
      trend = "improving";
    } else if (paceDelta > 10 || (distancePercentage < -15 && paceDelta > -5)) {
      trend = "declining";
    }
    
    expect(trend).toBe("improving");
  });

  it("should determine declining trend when pace is slower", () => {
    const paceDelta = 15; // 15 seconds slower per km
    const distancePercentage = 0;
    
    let trend: "improving" | "declining" | "stable" = "stable";
    
    if (paceDelta < -10 || (distancePercentage > 15 && paceDelta < 5)) {
      trend = "improving";
    } else if (paceDelta > 10 || (distancePercentage < -15 && paceDelta > -5)) {
      trend = "declining";
    }
    
    expect(trend).toBe("declining");
  });

  it("should determine stable trend when changes are minimal", () => {
    const paceDelta = 5; // 5 seconds difference
    const distancePercentage = 3;
    
    let trend: "improving" | "declining" | "stable" = "stable";
    
    if (paceDelta < -10 || (distancePercentage > 15 && paceDelta < 5)) {
      trend = "improving";
    } else if (paceDelta > 10 || (distancePercentage < -15 && paceDelta > -5)) {
      trend = "declining";
    }
    
    expect(trend).toBe("stable");
  });

  it("should calculate heart rate delta when both runs have HR data", () => {
    const run1HR = 150;
    const run2HR = 145;
    
    const heartRateDelta = run2HR - run1HR;
    
    expect(heartRateDelta).toBe(-5);
  });

  it("should handle missing heart rate data", () => {
    const run1HR = undefined;
    const run2HR = 145;
    
    let heartRateDelta: number | undefined;
    if (run1HR && run2HR) {
      heartRateDelta = run2HR - run1HR;
    }
    
    expect(heartRateDelta).toBeUndefined();
  });
});

describe("compute_training_load logic", () => {
  it("should calculate acute load for 7 days", () => {
    // Mock activities for last 7 days
    const activities = [
      { distance: 5000, average_speed: 3.33 }, // 5km
      { distance: 10000, average_speed: 3.0 }, // 10km slower
      { distance: 8000, average_speed: 3.5 }, // 8km faster
    ];
    
    const avgSpeed = activities.reduce((sum, a) => sum + a.average_speed, 0) / activities.length;
    
    const acuteLoad = activities.reduce((sum, a) => {
      const distanceKm = a.distance / 1000;
      const intensityFactor = a.average_speed / avgSpeed;
      return sum + (distanceKm * intensityFactor);
    }, 0);
    
    expect(Math.round(acuteLoad * 10) / 10).toBeGreaterThan(0);
    expect(Math.round(acuteLoad * 10) / 10).toBe(22.8); // ~23km weighted
  });

  it("should calculate chronic load for 28 days", () => {
    // Mock activities for last 28 days (4 weeks)
    const activities = Array(12).fill(null).map((_, i) => ({
      distance: 5000 + (i * 500), // Varying distances
      average_speed: 3.2 + (i * 0.05), // Varying speeds
    }));
    
    const avgSpeed = activities.reduce((sum, a) => sum + a.average_speed, 0) / activities.length;
    
    const chronicLoad = activities.reduce((sum, a) => {
      const distanceKm = a.distance / 1000;
      const intensityFactor = a.average_speed / avgSpeed;
      return sum + (distanceKm * intensityFactor);
    }, 0);
    
    expect(Math.round(chronicLoad * 10) / 10).toBeGreaterThan(0);
    expect(chronicLoad).toBeGreaterThan(60); // At least 60km weighted
  });

  it("should calculate acute:chronic ratio correctly", () => {
    const acuteLoad = 40; // 40km weighted in last 7 days
    const chronicLoad = 100; // 100km weighted in last 28 days
    
    const ratio = Math.round((acuteLoad / chronicLoad) * 100) / 100;
    
    expect(ratio).toBe(0.4);
  });

  it("should identify optimal training load ratio (0.8-1.3)", () => {
    const acuteLoad = 45;
    const chronicLoad = 50;
    const ratio = acuteLoad / chronicLoad;
    
    const isOptimal = ratio >= 0.8 && ratio <= 1.3;
    
    expect(ratio).toBe(0.9);
    expect(isOptimal).toBe(true);
  });

  it("should identify high injury risk ratio (>1.5)", () => {
    const acuteLoad = 80; // Sudden spike in training
    const chronicLoad = 50;
    const ratio = acuteLoad / chronicLoad;
    
    const isHighRisk = ratio > 1.5;
    
    expect(ratio).toBe(1.6);
    expect(isHighRisk).toBe(true);
  });

  it("should identify undertraining ratio (<0.8)", () => {
    const acuteLoad = 30; // Low recent volume
    const chronicLoad = 50;
    const ratio = acuteLoad / chronicLoad;
    
    const isUndertraining = ratio < 0.8;
    
    expect(ratio).toBe(0.6);
    expect(isUndertraining).toBe(true);
  });

  it("should handle zero chronic load gracefully", () => {
    const acuteLoad = 40;
    const chronicLoad = 0;
    
    const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;
    
    expect(ratio).toBe(0);
  });

  it("should calculate load score based on weekly distance", () => {
    const acuteLoad = 50; // 50km weighted in 7 days
    const loadScore = Math.min(100, Math.round(acuteLoad * 2));
    
    expect(loadScore).toBe(100); // Capped at 100
  });

  it("should calculate load score for moderate training", () => {
    const acuteLoad = 30; // 30km weighted in 7 days
    const loadScore = Math.min(100, Math.round(acuteLoad * 2));
    
    expect(loadScore).toBe(60);
  });

  it("should weight faster runs more heavily in load calculation", () => {
    const avgSpeed = 3.33; // ~5:00/km average
    
    const slowRun = { distance: 10000, average_speed: 3.0 }; // Slower than average
    const fastRun = { distance: 10000, average_speed: 3.7 }; // Faster than average
    
    const slowIntensity = slowRun.average_speed / avgSpeed;
    const fastIntensity = fastRun.average_speed / avgSpeed;
    
    const slowLoad = (slowRun.distance / 1000) * slowIntensity;
    const fastLoad = (fastRun.distance / 1000) * fastIntensity;
    
    expect(fastLoad).toBeGreaterThan(slowLoad);
    expect(Math.round(slowLoad * 10) / 10).toBe(9.0);
    expect(Math.round(fastLoad * 10) / 10).toBe(11.1);
  });

  it("should aggregate total distance correctly", () => {
    const activities = [
      { distance: 5000 }, // 5km
      { distance: 10000 }, // 10km
      { distance: 8000 }, // 8km
    ];
    
    const totalDistance = Math.round(
      activities.reduce((sum, a) => sum + a.distance / 1000, 0) * 10
    ) / 10;
    
    expect(totalDistance).toBe(23.0);
  });

  it("should aggregate total time correctly", () => {
    const activities = [
      { moving_time: 1800 }, // 30 minutes
      { moving_time: 3600 }, // 60 minutes
      { moving_time: 2400 }, // 40 minutes
    ];
    
    const totalTime = Math.round(
      activities.reduce((sum, a) => sum + a.moving_time / 60, 0)
    );
    
    expect(totalTime).toBe(130); // 130 minutes total
  });
});

describe("analyze_elevation_impact logic", () => {
  const SECONDS_PER_100M_ELEVATION = 12;

  it("should calculate pace adjustment based on elevation gain", () => {
    const elevationGainM = 200; // 200m elevation gain
    const distanceKm = 10; // 10km run
    
    // Adjustment = (elevation / 100) * seconds per 100m / distance
    const paceAdjustmentSecondsPerKm = (elevationGainM / 100) * SECONDS_PER_100M_ELEVATION / distanceKm;
    
    expect(paceAdjustmentSecondsPerKm).toBe(2.4); // 2.4 seconds per km adjustment
  });

  it("should compute climb-adjusted pace correctly", () => {
    const actualPaceSecondsPerKm = 300; // 5:00/km actual pace
    const paceAdjustmentSecondsPerKm = 10; // 10 seconds adjustment due to elevation
    
    const adjustedPaceSecondsPerKm = actualPaceSecondsPerKm - paceAdjustmentSecondsPerKm;
    
    expect(adjustedPaceSecondsPerKm).toBe(290); // 4:50/km adjusted pace (faster on flat)
  });

  it("should calculate elevation per km metric", () => {
    const elevationGainM = 150;
    const distanceKm = 10;
    
    const elevationPerKm = Math.round(elevationGainM / distanceKm);
    
    expect(elevationPerKm).toBe(15); // 15m per km
  });

  it("should handle zero distance gracefully", () => {
    const elevationGainM = 100;
    const distanceKm = 0;
    
    const paceAdjustmentSecondsPerKm = distanceKm > 0
      ? (elevationGainM / 100) * SECONDS_PER_100M_ELEVATION / distanceKm
      : 0;
    
    expect(paceAdjustmentSecondsPerKm).toBe(0);
  });

  it("should format pace correctly", () => {
    const formatPace = (seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${minutes}:${secs.toString().padStart(2, "0")}`;
    };
    
    expect(formatPace(300)).toBe("5:00");
    expect(formatPace(285)).toBe("4:45");
    expect(formatPace(330)).toBe("5:30");
  });

  it("should calculate proportional adjustment for hilly runs", () => {
    // Hilly run: 500m elevation over 10km
    const elevationGainM = 500;
    const distanceKm = 10;
    const actualPaceSecondsPerKm = 330; // 5:30/km actual pace
    
    const paceAdjustmentSecondsPerKm = (elevationGainM / 100) * SECONDS_PER_100M_ELEVATION / distanceKm;
    const adjustedPaceSecondsPerKm = actualPaceSecondsPerKm - paceAdjustmentSecondsPerKm;
    
    expect(Math.round(paceAdjustmentSecondsPerKm)).toBe(6); // 6 seconds adjustment
    expect(Math.round(adjustedPaceSecondsPerKm)).toBe(324); // 5:24/km adjusted pace
  });
});
