import '../../src/effects/tilt-holo-card';
import type { TiltHoloCardElement } from '../../src/effects/tilt-holo-card';
import { timeline, type Scene } from '../shared/scene';

/** Hypotrochoid path: the security-print "guilloche" rosettes of banknotes and passes. */
function rosette(cx: number, cy: number, R: number, r: number, d: number, steps = 900): string {
  const k = (R - r) / r;
  // Enough turns to close the curve for these integer-ish ratios.
  const turns = Math.PI * 2 * r;
  let path = '';
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns;
    const x = cx + (R - r) * Math.cos(t) + d * Math.cos(k * t);
    const y = cy + (R - r) * Math.sin(t) - d * Math.sin(k * t);
    path += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return path;
}

const GUILLOCHE = [
  `<path d="${rosette(150, 190, 130, 7, 46)}" stroke="rgba(255,255,255,.16)" stroke-width=".6" fill="none"/>`,
  `<path d="${rosette(150, 190, 96, 6, 30)}" stroke="rgba(255,214,250,.22)" stroke-width=".6" fill="none"/>`,
  `<path d="${rosette(150, 190, 60, 5, 18)}" stroke="rgba(190,230,255,.28)" stroke-width=".6" fill="none"/>`,
].join('');

/** The card face: original artwork drawn in SVG and HTML. */
export const CARD_FACE = `
  <div style="position:relative;aspect-ratio:5/7;overflow:hidden;container-type:inline-size;color:#fff;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;background:
      radial-gradient(120% 80% at 80% 0%, #ff7ac6 0%, transparent 55%),
      radial-gradient(110% 80% at 0% 100%, #4f7bff 0%, transparent 60%),
      linear-gradient(160deg, #3b1d7a, #170b3b 70%)">
    <svg viewBox="0 0 300 420" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%" aria-hidden="true">${GUILLOCHE}
      <g transform="translate(150 190)">
        <circle r="44" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/>
        <path d="M0-34 9.5-9.5 34 0 9.5 9.5 0 34-9.5 9.5-34 0-9.5-9.5Z" fill="#fff" opacity=".92"/>
        <circle r="6" fill="#2a1460"/>
      </g>
    </svg>
    <div style="position:absolute;left:7%;right:7%;top:6%;display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:800;letter-spacing:.32em;font-size:clamp(10px,4.4cqw,15px)">LUMEN</span>
      <svg viewBox="0 0 34 26" style="width:13%" aria-hidden="true"><rect x=".5" y=".5" width="33" height="25" rx="5" fill="#f3d58a" stroke="#c99a3d"/><path d="M11 .5v25M23 .5v25M.5 9h10.5M23 9h10.5M.5 17h10.5M23 17h10.5" stroke="#c99a3d" stroke-width="1"/></svg>
    </div>
    <div style="position:absolute;left:7%;right:7%;bottom:6%;display:grid;gap:4px">
      <span style="font-size:clamp(8px,3.4cqw,11px);letter-spacing:.24em;opacity:.8;font-weight:600">FOUNDER PASS</span>
      <span style="font-size:clamp(16px,8.4cqw,27px);font-weight:700;letter-spacing:-.01em;line-height:1.1">Mira Sol</span>
      <span style="display:flex;justify-content:space-between;font:500 clamp(8px,3.4cqw,11px)/1.4 ui-monospace,'Cascadia Mono',Consolas,monospace;opacity:.85"><span>No. 0042</span><span>Since 2026</span></span>
    </div>
  </div>`;

const PAGE = `
  <div style="position:absolute;inset:0;background:
      radial-gradient(50% 70% at 72% 50%, rgba(140,90,255,.28), transparent 70%),
      radial-gradient(40% 50% at 10% 0%, rgba(255,120,200,.12), transparent 70%),
      radial-gradient(rgba(255,255,255,.07) 1px, transparent 1.4px) 0 0 / 22px 22px,
      #0a0816"></div>
  <nav style="position:absolute;left:34px;right:34px;top:22px;display:flex;align-items:center;justify-content:space-between;font:500 13px/1 ui-sans-serif,system-ui,'Segoe UI',sans-serif;color:rgba(236,232,255,.72)">
    <span style="color:#fff;font-weight:800;letter-spacing:.28em;font-size:12px">LUMEN</span>
    <span style="display:flex;gap:24px"><span>Events</span><span>Members</span><span>Perks</span></span>
    <span style="padding:8px 14px;border-radius:999px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);color:#fff">Account</span>
  </nav>
  <div style="position:absolute;left:58px;top:0;bottom:0;width:360px;display:grid;align-content:center;gap:0;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;color:#fff">
    <span style="display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;letter-spacing:.14em;color:#d9c8ff;text-transform:uppercase"><i style="width:6px;height:6px;border-radius:50%;background:#ff8fd8;box-shadow:0 0 10px #ff8fd8"></i>Founders club</span>
    <h1 style="margin:14px 0 0;font-size:50px;line-height:1.02;font-weight:720;letter-spacing:-.035em">Your pass<br>is <span style="background:linear-gradient(90deg,#ff9bd9,#ffe39a,#8fffd0,#86c8ff);-webkit-background-clip:text;background-clip:text;color:transparent">ready.</span></h1>
    <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:rgba(236,232,255,.66);max-width:320px">Tilt it. The foil catches the light like the real thing, and it lives on your profile from day one.</p>
    <div style="display:flex;gap:10px;margin-top:24px;font-size:14px;font-weight:600">
      <span style="padding:11px 18px;border-radius:999px;background:#fff;color:#170b3b;box-shadow:0 10px 30px rgba(160,120,255,.35)">Add to wallet</span>
      <span style="padding:11px 16px;border-radius:999px;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)">Share pass</span>
    </div>
    <div style="display:flex;gap:22px;margin-top:28px;font-size:12px;color:rgba(236,232,255,.6)">
      <span>✦ Early access</span><span>✦ Guest invites</span><span>✦ Member lounge</span>
    </div>
  </div>
  <div style="position:absolute;right:92px;top:50%;transform:translateY(-50%)">
    <ane-tilt-holo-card size="236px" foil="sparkle" seed="7">${CARD_FACE}</ane-tilt-holo-card>
  </div>`;

const CURSOR = `<svg class="cursor" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="position:absolute;left:0;top:0;pointer-events:none;z-index:5;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));will-change:transform"><path d="M5 2.5v17.2l4.3-4.1 2.8 6.4 2.9-1.3-2.8-6.3h6z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 9000,
  poster: 2700,
  capture: { gifFps: 15, gifColors: 96, gifDither: 'bayer:bayer_scale=4', crf: 24 },
  play(stage) {
    stage.innerHTML = PAGE + CURSOR;
    const card = stage.querySelector<TiltHoloCardElement>('ane-tilt-holo-card')!;
    const cursor = stage.querySelector<SVGElement>('.cursor')!;
    const s = stage.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const cx = c.left - s.left + c.width / 2;
    const cy = c.top - s.top + c.height / 2;
    const off: [number, number] = [cx - 40, s.height + 30];

    // Cursor path: rise onto the card, sweep two loops over it, then drift away.
    const pos = (t: number): [number, number] => {
      if (t < 1000) return off;
      if (t < 1700) {
        const u = ease((t - 1000) / 700);
        return [off[0] + (cx - c.width * 0.3 - off[0]) * u, off[1] + (cy + c.height * 0.25 - off[1]) * u];
      }
      if (t < 5900) {
        const u = (t - 1700) / 4200;
        const a = Math.PI * 0.75 + u * Math.PI * 4;
        const rx = c.width * (0.3 + 0.12 * Math.sin(u * Math.PI));
        const ry = c.height * (0.34 - 0.08 * Math.sin(u * Math.PI));
        return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
      }
      if (t < 6900) {
        const a = Math.PI * 0.75 + Math.PI * 4;
        const from: [number, number] = [cx + Math.cos(a) * c.width * 0.3, cy + Math.sin(a) * c.height * 0.34];
        const u = ease((t - 5900) / 1000);
        return [from[0] + (cx + c.width * 0.9 - from[0]) * u, from[1] + (s.height + 30 - from[1]) * u];
      }
      return off;
    };
    const step = (t: number) => () => {
      const [x, y] = pos(t);
      cursor.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      cursor.style.opacity = t < 1000 || t > 6900 ? '0' : '1';
      const inside = x > c.left - s.left && x < c.right - s.left && y > c.top - s.top && y < c.bottom - s.top;
      if (inside) card.dispatchEvent(new PointerEvent('pointermove', { clientX: s.left + x, clientY: s.top + y, pointerType: 'mouse' }));
      else if (card.matches('[data-hover]')) card.dispatchEvent(new PointerEvent('pointerleave'));
      card.toggleAttribute('data-hover', inside);
    };
    const steps: Array<[number, () => void]> = [];
    for (let t = 0; t <= 9000; t += 33) steps.push([t, step(t)]);
    step(0)();
    return timeline(steps);
  },
};

export default scene;
