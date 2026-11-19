import '../../src/effects/magnet-dock';
import type { MagnetDockElement } from '../../src/effects/magnet-dock';
import { timeline, type Scene } from '../shared/scene';

/** Original app icons: a gradient tile plus a simple white glyph. */
const APPS: Array<{ name: string; from: string; to: string; glyph: string }> = [
  { name: 'Files', from: '#4fb3ff', to: '#2156f5', glyph: '<path d="M16 22a4 4 0 0 1 4-4h8l4 4h12a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4z" fill="#fff" opacity=".95"/><path d="M16 28h32" stroke="#2c6cf6" stroke-width="2" opacity=".35"/>' },
  { name: 'Messages', from: '#6ef3a5', to: '#14b866', glyph: '<path d="M32 17c-9.4 0-17 6.1-17 13.6 0 4.4 2.6 8.3 6.7 10.8-.3 2.4-1.6 4.6-3.3 6 3.6.2 7-1.2 9.3-3.4 1.4.3 2.8.4 4.3.4 9.4 0 17-6.1 17-13.7S41.4 17 32 17z" fill="#fff"/>' },
  { name: 'Mail', from: '#7ecbff', to: '#3a7bfd', glyph: '<rect x="15" y="20" width="34" height="24" rx="4" fill="#fff"/><path d="m16.5 22.5 15.5 12 15.5-12" fill="none" stroke="#3a7bfd" stroke-width="2.6" stroke-linejoin="round"/>' },
  { name: 'Music', from: '#ff7a9a', to: '#f0285a', glyph: '<path d="M27 42.5V22l16-3.5v20" fill="none" stroke="#fff" stroke-width="3.2" stroke-linejoin="round"/><circle cx="23.5" cy="42.5" r="4.5" fill="#fff"/><circle cx="39.5" cy="38.5" r="4.5" fill="#fff"/>' },
  { name: 'Photos', from: '#ffe7a8', to: '#fff7e6', glyph: '<g transform="translate(32 32)" opacity=".92"><ellipse rx="5.5" ry="10" cy="-8" fill="#ff8a3d"/><ellipse rx="5.5" ry="10" cy="-8" fill="#ffc531" transform="rotate(60)"/><ellipse rx="5.5" ry="10" cy="-8" fill="#4cd06a" transform="rotate(120)"/><ellipse rx="5.5" ry="10" cy="-8" fill="#36b3f5" transform="rotate(180)"/><ellipse rx="5.5" ry="10" cy="-8" fill="#8a6cff" transform="rotate(240)"/><ellipse rx="5.5" ry="10" cy="-8" fill="#f2508e" transform="rotate(300)"/></g>' },
  { name: 'Calendar', from: '#ffffff', to: '#eef0f6', glyph: '<rect x="0" y="0" width="64" height="20" fill="#ff4d5e"/><circle cx="22" cy="13" r="2.2" fill="#fff"/><circle cx="42" cy="13" r="2.2" fill="#fff"/><rect x="13" y="27" width="7" height="6.5" rx="1.8" fill="#c9cedd"/><rect x="23" y="27" width="7" height="6.5" rx="1.8" fill="#c9cedd"/><rect x="33" y="27" width="7" height="6.5" rx="1.8" fill="#c9cedd"/><rect x="43" y="27" width="7" height="6.5" rx="1.8" fill="#c9cedd"/><rect x="13" y="36.5" width="7" height="6.5" rx="1.8" fill="#c9cedd"/><rect x="23" y="36.5" width="7" height="6.5" rx="1.8" fill="#c9cedd"/><rect x="33" y="36.5" width="7" height="6.5" rx="1.8" fill="#ff4d5e"/><rect x="43" y="36.5" width="7" height="6.5" rx="1.8" fill="#c9cedd"/><rect x="13" y="46" width="7" height="6.5" rx="1.8" fill="#c9cedd"/><rect x="23" y="46" width="7" height="6.5" rx="1.8" fill="#c9cedd"/><rect x="33" y="46" width="7" height="6.5" rx="1.8" fill="#c9cedd"/><rect x="43" y="46" width="7" height="6.5" rx="1.8" fill="#c9cedd"/>' },
  { name: 'Terminal', from: '#3a3f55', to: '#14161f', glyph: '<path d="m19 24 8 7-8 7" fill="none" stroke="#7cf7b5" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 40h13" stroke="#e8ecff" stroke-width="3.2" stroke-linecap="round"/>' },
  { name: 'Settings', from: '#c3c9d8', to: '#7d8496', glyph: '<g transform="translate(32 32)" fill="none" stroke="#fff"><circle r="12" stroke-width="5" stroke-dasharray="4.2 2.08"/><circle r="9" stroke-width="2.6"/><circle r="3.6" stroke-width="2.6"/></g>' },
];

const icon = (app: (typeof APPS)[number], i: number): string => `
  <button type="button" aria-label="${app.name}"${i < 2 ? ' data-active' : ''}>
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" style="display:block;filter:drop-shadow(0 3px 6px rgba(0,0,0,.28))">
      <defs><clipPath id="mdc-${i}"><rect x="4" y="4" width="56" height="56" rx="13"/></clipPath><linearGradient id="mdg-${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${app.from}"/><stop offset="1" stop-color="${app.to}"/></linearGradient></defs>
      <rect x="4" y="4" width="56" height="56" rx="13" fill="url(#mdg-${i})"/>
      <rect x="4.5" y="4.5" width="55" height="55" rx="12.5" fill="none" stroke="#fff" stroke-opacity=".28"/>
      <g clip-path="url(#mdc-${i})">${app.glyph}</g>
    </svg>
  </button>`;

/** The dock's buttons (eight original app icons). */
export const DOCK_ICONS = APPS.map(icon).join('');

/** A code-generated wallpaper: blurred colour fields plus a soft grain-free vignette. */
export const WALLPAPER = `
  <div style="position:absolute;inset:0;overflow:hidden;background:#1b1238">
    <div style="position:absolute;width:70%;height:90%;left:-12%;top:-20%;border-radius:50%;background:#ff6a88;filter:blur(70px);opacity:.75"></div>
    <div style="position:absolute;width:65%;height:80%;right:-15%;top:-10%;border-radius:50%;background:#6a5cff;filter:blur(80px);opacity:.85"></div>
    <div style="position:absolute;width:60%;height:70%;left:20%;bottom:-35%;border-radius:50%;background:#ffb36b;filter:blur(80px);opacity:.7"></div>
    <div style="position:absolute;width:40%;height:50%;right:5%;bottom:-10%;border-radius:50%;background:#22d3c5;filter:blur(70px);opacity:.55"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(90% 80% at 50% 40%, transparent 50%, rgba(10,6,30,.45))"></div>
  </div>`;

const DESKTOP = `
  ${WALLPAPER}
  <div style="position:absolute;left:0;right:0;top:0;height:26px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;background:rgba(20,14,40,.28);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);color:#fff;font:500 12px/1 ui-sans-serif,system-ui,'Segoe UI',sans-serif">
    <span style="display:flex;gap:16px;align-items:center"><b style="display:inline-block;width:11px;height:11px;border-radius:3px;background:linear-gradient(135deg,#fff,#c9c2ff)"></b><b style="font-weight:650">Studio</b><span style="opacity:.85">File</span><span style="opacity:.85">Edit</span><span style="opacity:.85">View</span><span style="opacity:.85">Window</span></span>
    <span style="display:flex;gap:14px;opacity:.9"><span>●●●</span><span>Thu 19 Nov&nbsp;&nbsp;14:00</span></span>
  </div>
  <div style="position:absolute;left:50%;top:66px;width:400px;height:212px;margin-left:-200px;border-radius:14px;background:rgba(250,248,255,.9);box-shadow:0 30px 70px rgba(15,8,40,.45),0 0 0 1px rgba(255,255,255,.5);overflow:hidden;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;color:#1d1a2e">
    <div style="height:34px;display:flex;align-items:center;gap:7px;padding:0 13px;border-bottom:1px solid rgba(30,20,60,.08)">
      <i style="width:11px;height:11px;border-radius:50%;background:#ff5f57"></i><i style="width:11px;height:11px;border-radius:50%;background:#febc2e"></i><i style="width:11px;height:11px;border-radius:50%;background:#28c840"></i>
      <span style="margin-left:auto;margin-right:auto;font-size:12px;font-weight:600;opacity:.6">Launch notes</span>
    </div>
    <div style="padding:16px 22px;font-size:13px;line-height:1.6">
      <div style="font-size:17px;font-weight:700;letter-spacing:-.01em;margin-bottom:6px">Dock polish ✦</div>
      <div style="opacity:.75">• Icons swell under the cursor, neighbours follow</div>
      <div style="opacity:.75">• One label glides between apps</div>
      <div style="opacity:.75">• Launch bounce with a little squash</div>
      <div style="opacity:.75">• Arrow keys and touch scrubbing work too</div>
    </div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:center">
    <ane-magnet-dock size="46px">${DOCK_ICONS}</ane-magnet-dock>
  </div>`;

const CURSOR = `<svg class="cursor" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="position:absolute;left:0;top:0;pointer-events:none;z-index:5;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));will-change:transform"><path d="M5 2.5v17.2l4.3-4.1 2.8 6.4 2.9-1.3-2.8-6.3h6z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 9000,
  poster: 2500,
  play(stage) {
    stage.innerHTML = DESKTOP + CURSOR;
    const dock = stage.querySelector<MagnetDockElement>('ane-magnet-dock')!;
    const cursor = stage.querySelector<SVGElement>('.cursor')!;
    const buttons = [...dock.querySelectorAll('button')];

    // Waypoints in stage coordinates, measured from the resting dock.
    const s = stage.getBoundingClientRect();
    const rest = buttons.map((b) => {
      const r = b.getBoundingClientRect();
      return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
    });
    const at = (i: number, dy = 0): [number, number] => [rest[i]!.x, rest[i]!.y + dy];
    const start: [number, number] = [rest[7]!.x + 150, rest[7]!.y - 150];
    const way: Array<[number, [number, number]]> = [
      [0, start],
      [700, start],
      [1500, at(7, 4)],
      [3300, at(0, 4)],
      [4100, at(3, 2)],
      [4700, at(3, 2)],
      [5600, at(6, 2)],
      [6300, at(6, 2)],
      [6800, at(5, 2)],
      [7600, [rest[5]!.x + 90, rest[5]!.y - 160]],
      [9000, start],
    ];
    const pos = (t: number): [number, number] => {
      for (let k = 1; k < way.length; k++) {
        const [t1, p1] = way[k]!;
        const [t0, p0] = way[k - 1]!;
        if (t <= t1) {
          const u = ease(t1 === t0 ? 1 : (t - t0) / (t1 - t0));
          return [p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u];
        }
      }
      return start;
    };
    const step = (t: number) => () => {
      const [x, y] = pos(t);
      cursor.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      const inside = t >= 1400 && t <= 7000;
      if (!inside) return;
      // Pointer events reach the dock through whichever icon is under the cursor.
      const target = buttons[0]!;
      target.dispatchEvent(new PointerEvent('pointermove', { clientX: s.left + x, clientY: s.top + y, pointerType: 'mouse', bubbles: true, composed: true }));
    };
    const steps: Array<[number, () => void]> = [];
    for (let t = 0; t <= 9000; t += 33) steps.push([t, step(t)]);
    step(0)();
    return timeline([
      ...steps,
      [4300, () => buttons[3]!.click()],
      [4800, () => buttons[3]!.setAttribute('data-active', '')],
      [5900, () => buttons[6]!.click()],
      [6400, () => buttons[6]!.setAttribute('data-active', '')],
      [7040, () => buttons[0]!.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true, composed: true }))],
      [8400, () => [3, 6].forEach((i) => buttons[i]!.removeAttribute('data-active'))],
    ]);
  },
};

export default scene;
