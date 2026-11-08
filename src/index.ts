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
