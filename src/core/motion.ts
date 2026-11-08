/** Reduced-motion support shared by every effect. */

export type MotionPreference = 'auto' | 'reduce' | 'full';

const QUERY = '(prefers-reduced-motion: reduce)';

export function systemPrefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia(QUERY).matches;
}

/**
 * Resolves an effect's `motion` attribute:
 * `reduce` and `full` force a mode, anything else follows the OS setting.
 */
export function resolveReducedMotion(preference: string | null): boolean {
  if (preference === 'reduce') return true;
  if (preference === 'full') return false;
  return systemPrefersReducedMotion();
}

/** Calls `onChange` whenever the OS reduced-motion setting flips. Returns a disposer. */
export function watchReducedMotion(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const query = matchMedia(QUERY);
  query.addEventListener?.('change', onChange);
  return () => query.removeEventListener?.('change', onChange);
}
