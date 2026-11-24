import '../../src/effects/glass-tabs';
import type { GlassTabsElement } from '../../src/effects/glass-tabs';
import { timeline, type Scene } from '../shared/scene';

const icon = (d: string): string =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;margin:0 auto">${d}</svg>`;

const APP_TABS: Array<[string, string]> = [
  ['Home', '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'],
  ['Explore', '<circle cx="12" cy="12" r="8"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'],
  ['Library', '<rect x="4" y="4" width="6" height="16" rx="1.5"/><rect x="12" y="4" width="4" height="16" rx="1"/><path d="m18 5 2.5 14.5"/>'],
  ['Profile', '<circle cx="12" cy="9" r="3.5"/><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5"/>'],
];

/** App tab bar buttons: icon over label. */
export const APP_TAB_BUTTONS = APP_TABS.map(
  ([label, d]) =>
    `<button type="button" style="display:grid;gap:2px;justify-items:center;padding:6px 2px 5px;font:600 9.5px/1 ui-sans-serif,system-ui,'Segoe UI',sans-serif;letter-spacing:.01em">${icon(d)}<span>${label}</span></button>`,
).join('');

/** Segmented control buttons. */
export const RANGE_BUTTONS = ['Day', 'Week', 'Month', 'Year']
  .map((t) => `<button type="button" style="padding:8px 14px;font:600 12.5px/1 ui-sans-serif,system-ui,'Segoe UI',sans-serif">${t}</button>`)
  .join('');

// Photo-like tiles drawn with gradients (no image assets).
const TILES = [
  'radial-gradient(60% 70% at 30% 30%,#ffd29a,transparent),linear-gradient(160deg,#ff7a59,#7b2ff7)',
  'radial-gradient(50% 60% at 70% 30%,#b8f3ff,transparent),linear-gradient(200deg,#1fa2ff,#12d8a6)',
  'radial-gradient(60% 50% at 40% 70%,#ffe3f1,transparent),linear-gradient(140deg,#f857a6,#ff5858)',
  'radial-gradient(60% 60% at 60% 40%,#fff6c8,transparent),linear-gradient(180deg,#f7971e,#ffd200)',
  'radial-gradient(60% 60% at 30% 60%,#d6ccff,transparent),linear-gradient(160deg,#5f2c82,#49a09d)',
  'radial-gradient(60% 60% at 70% 70%,#c9ffd9,transparent),linear-gradient(200deg,#11998e,#38ef7d)',
];

const BARS = [38, 52, 44, 66, 58, 74, 62, 88, 70, 82, 76, 94];

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 9000,
  poster: 3500,
  play(stage) {
    stage.innerHTML = `
      <div style="position:absolute;inset:0;background:
          radial-gradient(45% 60% at 18% 30%, #7b5cff 0%, transparent 70%),
          radial-gradient(40% 55% at 85% 75%, #ff6fa8 0%, transparent 70%),
          radial-gradient(50% 60% at 60% 10%, #34c3ff 0%, transparent 70%),
          #120f2e"></div>

      <!-- Phone -->
      <div style="position:absolute;left:58px;top:24px;width:226px;height:404px;border-radius:38px;padding:9px;background:#0b0b14;box-shadow:0 30px 60px rgba(0,0,0,.45),inset 0 0 0 1.5px rgba(255,255,255,.12)">
        <div style="position:relative;width:100%;height:100%;border-radius:30px;overflow:hidden;background:#151227;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;color:#fff">
          <div style="display:flex;justify-content:space-between;padding:12px 18px 0;font-size:11px;font-weight:600"><span>9:41</span><span>● ● ●</span></div>
          <div style="padding:10px 14px 0"><div style="font-size:21px;font-weight:750;letter-spacing:-.02em">Moments</div><div style="font-size:11px;color:rgba(255,255,255,.55);margin-top:2px">Today · 128 photos</div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 12px">
            ${TILES.map((t, i) => `<div style="height:${i % 3 === 0 ? 96 : 74}px;border-radius:12px;background:${t}"></div>`).join('')}
          </div>
          <div style="position:absolute;left:8px;right:8px;bottom:10px;display:flex;justify-content:center">
            <ane-glass-tabs class="app" style="width:100%;color:rgba(255,255,255,.72);--ane-glass-pad:4px">${APP_TAB_BUTTONS}</ane-glass-tabs>
          </div>
        </div>
      </div>

      <!-- Dashboard card -->
      <div style="position:absolute;left:330px;top:60px;width:420px;height:330px;border-radius:22px;padding:22px 24px;background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.05));-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16),0 30px 60px rgba(0,0,0,.35);font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;color:#fff">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div><div style="font-size:12px;color:rgba(255,255,255,.6);font-weight:600;letter-spacing:.04em">REVENUE</div>
          <div style="font-size:34px;font-weight:750;letter-spacing:-.03em;margin-top:4px">$48,290</div>
          <div style="font-size:12px;color:#7dffb7;margin-top:2px;font-weight:600">▲ 12.4% vs last period</div></div>
        </div>
        <div style="margin-top:16px"><ane-glass-tabs class="range" selected="1" style="color:rgba(255,255,255,.7)">${RANGE_BUTTONS}</ane-glass-tabs></div>
        <div style="position:absolute;left:24px;right:24px;bottom:22px;height:118px;display:flex;align-items:flex-end;gap:8px">
          ${BARS.map((h, i) => `<div style="flex:1;height:${h}%;border-radius:6px 6px 3px 3px;background:linear-gradient(180deg,${i === 11 ? '#ffffff' : 'rgba(255,255,255,.75)'},rgba(255,255,255,.18))"></div>`).join('')}
        </div>
      </div>`;

    const app = stage.querySelector<GlassTabsElement>('ane-glass-tabs.app')!;
    const range = stage.querySelector<GlassTabsElement>('ane-glass-tabs.range')!;
    // Drag-scrub across the app bar with synthetic pointer events.
    const drag = (from: number, to: number, start: number, dur: number): Array<[number, () => void]> => {
      const tabs = app.tabs;
      const steps: Array<[number, () => void]> = [];
      const at = (i: number): number => {
        const r = tabs[i]!.getBoundingClientRect();
        return r.left + r.width / 2;
      };
      const ev = (type: string, x: number) => () => {
        const r = tabs[0]!.getBoundingClientRect();
        tabs[from]!.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: r.top + r.height / 2, pointerId: 7, button: 0, bubbles: true, composed: true }));
      };
      steps.push([start, () => ev('pointerdown', at(from))()]);
      const n = 18;
      for (let k = 1; k <= n; k++) {
        const u = k / n;
        const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
        steps.push([start + (dur * k) / n, () => ev('pointermove', at(from) + (at(to) - at(from)) * e)()]);
      }
      steps.push([start + dur + 120, () => ev('pointerup', at(to))()]);
      return steps;
    };
    return timeline([
      [900, () => (app.selected = 2)],
      [1700, () => (range.selected = 3)],
      [2700, () => (app.selected = 3)],
      [3600, () => (range.selected = 0)],
      ...drag(3, 1, 4400, 1300),
      [6200, () => (range.selected = 2)],
      [7300, () => (app.selected = 0)],
      [8100, () => (range.selected = 1)],
    ]);
  },
};

export default scene;
