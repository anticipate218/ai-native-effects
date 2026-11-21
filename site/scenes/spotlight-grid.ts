import '../../src/effects/spotlight-grid';
import type { SpotlightGridElement } from '../../src/effects/spotlight-grid';
import { timeline, type Scene } from '../shared/scene';

const ICON = (d: string, c = '#9cc2ff'): string =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

// A sparkline drawn from a fixed series (original data, no assets).
const SERIES = [12, 18, 15, 22, 20, 28, 26, 34, 31, 40, 38, 47, 45, 55, 58, 66];
const spark = (): string => {
  const w = 300;
  const h = 40;
  const max = Math.max(...SERIES);
  const pts = SERIES.map((v, i) => `${((i / (SERIES.length - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 6)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px;display:block" aria-hidden="true">
    <defs><linearGradient id="sg-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7aa7ff" stop-opacity=".35"/><stop offset="1" stop-color="#7aa7ff" stop-opacity="0"/></linearGradient></defs>
    <polygon points="0,${h} ${pts} ${w},${h}" fill="url(#sg-area)"/>
    <polyline points="${pts}" fill="none" stroke="#9cc2ff" stroke-width="2" vector-effect="non-scaling-stroke"/>
  </svg>`;
};

const card = (span: number, icon: string, title: string, body: string, extra = ''): string => `
  <article tabindex="0" style="grid-column:span ${span};position:relative;padding:16px 18px;border-radius:16px;background:linear-gradient(180deg,#121630,#0b0e1f);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);color:#e9ecf8;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;overflow:hidden;outline-offset:3px">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:rgba(140,170,255,.1);box-shadow:inset 0 0 0 1px rgba(140,170,255,.18)">${icon}</span>
      <b style="font-size:14.5px;font-weight:620;letter-spacing:-.01em">${title}</b>
    </div>
    <p style="margin:9px 0 0;font-size:12.5px;line-height:1.5;color:rgba(233,236,248,.6)">${body}</p>${extra}
  </article>`;

/** Six feature cards for a bento wall (original copy and icons). */
export const FEATURES = [
  card(2, ICON('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>'), 'Analytics that explain themselves', 'Every chart ships with the why behind it.',
    `<div style="margin-top:10px">${spark()}</div>`),
  card(1, ICON('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.3 3 14.7 0 18M12 3c-3 3.3-3 14.7 0 18"/>'), 'Edge in 48 regions', 'Requests land within 30 ms of almost everyone.'),
  card(1, ICON('<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>', '#c9a4ff'), 'Realtime sync', 'Presence, cursors and edits, conflict-free.'),
  card(1, ICON('<path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6z"/><path d="m9 12 2 2 4-4"/>', '#8fe3c0'), 'Secure by default', 'SSO, audit logs and per-row policies.'),
  card(1, ICON('<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M17.5 14v7M14 17.5h7"/>', '#ffc98a'), 'Integrations', '120+ connectors, or bring your own.'),
].join('');

export const GRID_STYLE = 'display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:minmax(126px,auto);gap:12px;padding:14px;border-radius:24px';

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 10000,
  poster: 4600,
  capture: { gifFps: 15, gifColors: 64, gifDither: 'bayer:bayer_scale=5', crf: 22 },
  play(stage) {
    stage.innerHTML = `
      <div style="position:absolute;inset:0;background:radial-gradient(70% 60% at 50% 0%,#141a3a,#070912 70%)"></div>
      <div style="position:absolute;left:44px;right:44px;top:26px;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;color:#eef1ff">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:rgba(238,241,255,.66)">
          <span style="display:flex;align-items:center;gap:8px;color:#fff;font-weight:650;font-size:13.5px"><i style="width:14px;height:14px;border-radius:4px;background:conic-gradient(from 200deg,#8ab4ff,#c58bff,#8ab4ff)"></i>Kestrel</span>
          <span style="display:flex;gap:22px"><span>Product</span><span>Customers</span><span>Pricing</span><span>Docs</span></span>
        </div>
        <div style="margin-top:22px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px">
          <h2 style="margin:0;font-size:31px;line-height:1.08;font-weight:690;letter-spacing:-.03em">Everything you need<br><span style="color:rgba(238,241,255,.5)">to ship, in one place.</span></h2>
          <span style="padding:9px 15px;border-radius:999px;background:#eef1ff;color:#0b0e1f;font-size:13px;font-weight:620">Start free</span>
        </div>
      </div>
      <ane-spotlight-grid style="position:absolute;left:30px;right:30px;top:134px;${GRID_STYLE}">${FEATURES}</ane-spotlight-grid>
      <svg class="cursor" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="position:absolute;left:0;top:0;pointer-events:none;z-index:5;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));opacity:0"><path d="M5 2.5v17.2l4.3-4.1 2.8 6.4 2.9-1.3-2.8-6.3h6z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
    const grid = stage.querySelector<SpotlightGridElement>('ane-spotlight-grid')!;
    const cursor = stage.querySelector<SVGElement>('.cursor')!;
    const s = stage.getBoundingClientRect();
    const g = grid.getBoundingClientRect();
    const gx = g.left - s.left;
    const gy = g.top - s.top;
    // Cursor path in grid coordinates.
    const way: Array<[number, number, number]> = [
      [1200, g.width + 60, g.height + 40],
      [2000, g.width * 0.84, g.height * 0.7],
      [3200, g.width * 0.52, g.height * 0.78],
      [4200, g.width * 0.3, g.height * 0.32],
      [4700, g.width * 0.3, g.height * 0.32],
      [5800, g.width * 0.78, g.height * 0.28],
      [6800, g.width * 0.86, g.height * 0.72],
      [7600, g.width + 80, g.height + 60],
    ];
    const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const pos = (t: number): [number, number] => {
      if (t <= way[0]![0]) return [way[0]![1], way[0]![2]];
      for (let k = 1; k < way.length; k++) {
        const [t1, x1, y1] = way[k]!;
        const [t0, x0, y0] = way[k - 1]!;
        if (t <= t1) {
          const u = ease((t - t0) / (t1 - t0));
          return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
        }
      }
      return [way.at(-1)![1], way.at(-1)![2]];
    };
    const step = (t: number) => () => {
      const [x, y] = pos(t);
      const inside = t > 1200 && t < 7600 && x >= 0 && y >= 0 && x <= g.width && y <= g.height;
      cursor.style.opacity = t > 1200 && t < 7600 ? '1' : '0';
      cursor.style.transform = `translate(${(gx + x).toFixed(1)}px, ${(gy + y).toFixed(1)}px)`;
      if (inside) grid.dispatchEvent(new PointerEvent('pointermove', { clientX: g.left + x, clientY: g.top + y, pointerType: 'mouse' }));
      else if (grid.matches('[data-in]')) grid.dispatchEvent(new PointerEvent('pointerleave'));
      grid.toggleAttribute('data-in', inside);
    };
    const steps: Array<[number, () => void]> = [];
    for (let t = 0; t <= 10000; t += 33) steps.push([t, step(t)]);
    step(0)();
    return timeline([
      ...steps,
      [4450, () => grid.pulse(g.width * 0.3, g.height * 0.32)],
    ]);
  },
};

export default scene;
