/**
 * ai-native-effects: animated, accessible Web Components for AI product interfaces.
 * Importing this entry registers every effect. Import `ai-native-effects/<effect-id>`
 * instead to ship only what you use.
 */
export { EffectElement, defineElement } from './core/effect-element';
export { getTickerStats, resetTickerStats } from './core/ticker';
export type { TickerStats } from './core/ticker';
export type { MotionPreference } from './core/motion';

export * from './effects/thinking-buddy';
export * from './effects/orbit-loading-screen';
export * from './effects/token-stream';
export * from './effects/scan-reveal';
export * from './effects/agent-flow';
export * from './effects/glass-lens';
export * from './effects/image-reveal';
export * from './effects/aurora';
export * from './effects/decrypt-text';
export * from './effects/magnet-dock';
export * from './effects/tilt-holo-card';
export * from './effects/spotlight-grid';
export * from './effects/ascii-field';
export * from './effects/dither-gradient';
