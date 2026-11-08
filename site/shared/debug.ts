/** Exposes ticker statistics to the e2e suite (performance budget checks). Site-only. */
import { getTickerStats, resetTickerStats } from '../../src/core/ticker';

declare global {
  interface Window {
    __ane?: { getTickerStats: typeof getTickerStats; resetTickerStats: typeof resetTickerStats };
  }
}

window.__ane = { getTickerStats, resetTickerStats };
