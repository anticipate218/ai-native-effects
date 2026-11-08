/**
 * A scene is a short, scripted composition used for README GIFs, videos and
 * thumbnails (scripts/capture.mjs) and for the looping stage page.
 * Scenes must only use setTimeout-based timing so the capture clock can drive them.
 */
export interface Scene {
  /** Stage size in CSS pixels (captured at 2x). */
  width: number;
  height: number;
  /** Loop length in ms; the last frame should match the first. */
  duration: number;
  /** Timestamp (ms) of the frame used for the poster and thumbnail. */
  poster: number;
  /** Builds the DOM and schedules the timeline. Returns a disposer. */
  play(stage: HTMLElement): () => void;
}

/** Schedules `[ms, action]` steps; returns a cancel function. */
export function timeline(steps: Array<[number, () => void]>): () => void {
  const ids = steps.map(([at, action]) => window.setTimeout(action, at));
  return () => ids.forEach((id) => window.clearTimeout(id));
}
