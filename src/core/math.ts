/** Small, dependency-free math helpers shared by every effect. */

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/**
 * Frame-rate independent exponential smoothing.
 * `lambda` is the response rate per second (higher = snappier); `dtMs` is the frame delta.
 */
export const damp = (current: number, target: number, lambda: number, dtMs: number): number =>
  lerp(current, target, 1 - Math.exp((-lambda * dtMs) / 1000));

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

export const easeOutBack = (t: number, overshoot = 1.70158): number => {
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
};

/** A smooth 0 → 1 → 0 hump over t ∈ [0, 1]. */
export const hump = (t: number): number => (t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t));

/** Seeded PRNG (mulberry32): deterministic sequences make recordings and tests reproducible. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Parses a numeric attribute, falling back on missing/invalid input and clamping to a range. */
export function parseNumber(
  value: string | null | undefined,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  if (value == null || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

/** Rounds to 2 decimals: keeps per-frame SVG attribute strings short. */
export const r2 = (value: number): number => Math.round(value * 100) / 100;
