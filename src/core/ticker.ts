/**
 * One shared requestAnimationFrame loop for every effect on the page.
 * The loop only runs while at least one effect is subscribed and visible,
 * and it records how much main-thread time effects spend per frame so the
 * e2e suite can enforce a performance budget.
 */

export type TickCallback = (now: number, deltaMs: number) => void;

/** Longest frame delta handed to effects; avoids jumps after a background tab resumes. */
export const MAX_DELTA_MS = 100;

const subscribers = new Set<TickCallback>();
let frameId = 0;
let lastTime = -1;

const stats = { frames: 0, workTotal: 0, workMax: 0 };

const hasRaf = (): boolean => typeof requestAnimationFrame === 'function';

function loop(now: number): void {
  frameId = requestAnimationFrame(loop);
  const delta = lastTime < 0 ? 1000 / 60 : Math.min(Math.max(now - lastTime, 0), MAX_DELTA_MS);
  lastTime = now;

  const start = performance.now();
  for (const callback of subscribers) {
    try {
      callback(now, delta);
    } catch (error) {
      console.error('[ai-native-effects] frame callback failed', error);
    }
  }
  const work = performance.now() - start;
  stats.frames += 1;
  stats.workTotal += work;
  if (work > stats.workMax) stats.workMax = work;
}

/** Registers a per-frame callback. Returns an unsubscribe function. */
export function subscribe(callback: TickCallback): () => void {
  subscribers.add(callback);
  if (!frameId && hasRaf()) {
    lastTime = -1;
    frameId = requestAnimationFrame(loop);
  }
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && frameId) {
      cancelAnimationFrame(frameId);
      frameId = 0;
    }
  };
}

export interface TickerStats {
  /** Callbacks currently subscribed. */
  subscribers: number;
  /** Frames rendered since the last reset. */
  frames: number;
  /** Mean main-thread time (ms) spent in effect callbacks per frame. */
  averageWorkMs: number;
  /** Worst single frame (ms). */
  maxWorkMs: number;
}

export function getTickerStats(): TickerStats {
  return {
    subscribers: subscribers.size,
    frames: stats.frames,
    averageWorkMs: stats.frames ? stats.workTotal / stats.frames : 0,
    maxWorkMs: stats.workMax,
  };
}

export function resetTickerStats(): void {
  stats.frames = 0;
  stats.workTotal = 0;
  stats.workMax = 0;
}
