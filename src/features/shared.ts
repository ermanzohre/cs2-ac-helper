import type { MetricStats } from "../domain/types";

export function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

export function angleDelta(current: number, previous: number): number {
  let delta = current - previous;
  while (delta > 180) {
    delta -= 360;
  }

  while (delta < -180) {
    delta += 360;
  }

  return delta;
}

export function percentile(values: number[], q: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1))),
  );
  return sorted[index];
}

export function buildStats(values: number[]): MetricStats {
  if (values.length === 0) {
    return {};
  }

  const min = Math.min(...values);
  const sum = values.reduce((acc, value) => acc + value, 0);

  return {
    min,
    avg: sum / values.length,
    p95: percentile(values, 0.95),
  };
}
