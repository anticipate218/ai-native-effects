import '../../src/effects/ascii-field';
import type { AsciiFieldElement } from '../../src/effects/ascii-field';
import { timeline, type Scene } from '../shared/scene';

/** Hero copy for a fictional CLI product (original). */
export const HERO = `
  <div style="position:absolute;inset:0;pointer-events:none;background:
      linear-gradient(180deg, rgba(5,7,12,.55) 0%, transparent 18%, transparent 46%, rgba(5,7,12,.82) 78%, #05070c 100%)"></div>
  <nav style="position:absolute;left:34px;right:34px;top:20px;display:flex;justify-content:space-between;align-items:center;font:500 12.5px/1 ui-monospace,'Cascadia Mono',Consolas,monospace;color:rgba(220,240,236,.75)">
    <span style="color:#fff;font-weight:700;font-size:13.5px">▍nova<span style="color:#4de2c5">.sh</span></span>
    <span style="display:flex;gap:22px"><span>docs</span><span>changelog</span><span>pricing</span><span>github ↗</span></span>
  </nav>
  <div style="position:absolute;left:38px;right:38px;bottom:30px;display:flex;align-items:flex-end;justify-content:space-between;gap:24px;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;color:#eef8f6">
    <div>
      <div style="font:600 11.5px/1 ui-monospace,'Cascadia Mono',Consolas,monospace;letter-spacing:.14em;color:#4de2c5">v2.0 · NOW WITH PREVIEWS</div>
      <h1 style="margin:10px 0 0;font-size:40px;line-height:1.04;font-weight:720;letter-spacing:-.035em">Ship from the terminal.</h1>
      <p style="margin:10px 0 0;max-width:360px;font-size:14px;line-height:1.5;color:rgba(238,248,246,.66)">One command builds, previews and deploys. No dashboards, no YAML.</p>
      <div style="display:flex;gap:10px;margin-top:16px;font-size:13.5px;font-weight:620">
        <span style="padding:10px 16px;border-radius:9px;background:#4de2c5;color:#04130f">Get started</span>
        <span style="padding:10px 15px;border-radius:9px;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)">Read the docs</span>
      </div>
    </div>
    <div style="width:250px;border-radius:12px;background:rgba(8,12,18,.86);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 20px 50px rgba(0,0,0,.5);font:500 12px/1.7 ui-monospace,'Cascadia Mono',Consolas,monospace;color:rgba(220,240,236,.85);overflow:hidden">
      <div style="padding:7px 12px;border-bottom:1px solid rgba(255,255,255,.07);color:rgba(220,240,236,.45)">~/app</div>
      <div style="padding:9px 12px 11px"><span style="color:#4de2c5">$</span> npx nova deploy<br><span style="color:rgba(220,240,236,.5)">✓ built in 2.1s</span><br><span style="color:rgba(220,240,236,.5)">✓ preview</span> <span style="color:#8f7bff">nova.sh/p/7f3a</span></div>
    </div>
  </div>`;

const CURSOR = `<svg class="cursor" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="position:absolute;left:0;top:0;pointer-events:none;z-index:5;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));opacity:0"><path d="M5 2.5v17.2l4.3-4.1 2.8 6.4 2.9-1.3-2.8-6.3h6z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 10000,
  poster: 4200,
  // Dense glyphs are high-entropy: fewer GIF frames and colours keep the file small.
  capture: { gifFps: 15, gifColors: 64, gifDither: 'bayer:bayer_scale=5', crf: 23 },
  play(stage) {
    stage.innerHTML = `<ane-ascii-field cell="12" text-y="0.36" reveal="0" style="position:absolute;inset:0;min-height:0;background:#05070c">${HERO}</ane-ascii-field>${CURSOR}`;
    const field = stage.querySelector<AsciiFieldElement>('ane-ascii-field')!;
    const cursor = stage.querySelector<SVGElement>('.cursor')!;
    const s = stage.getBoundingClientRect();
    const way: Array<[number, number, number]> = [
      [2400, 880, 300],
      [3400, 560, 150],
      [4400, 330, 170],
      [5000, 400, 165],
      [6000, 600, 130],
      [7000, 900, 60],
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
      const on = t > 2400 && t < 7000 && x < 800;
      cursor.style.opacity = on ? '1' : '0';
      cursor.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (on) field.dispatchEvent(new PointerEvent('pointermove', { clientX: s.left + x, clientY: s.top + y, pointerType: 'mouse' }));
      else if (field.matches('[data-in]')) field.dispatchEvent(new PointerEvent('pointerleave'));
      field.toggleAttribute('data-in', on);
    };
    const steps: Array<[number, () => void]> = [];
    for (let t = 0; t <= 10000; t += 33) steps.push([t, step(t)]);
    return timeline([
      ...steps,
      [700, () => void field.morph('NOVA', 1900)],
      [5000, () => field.shockwave(400, 165)],
      [6200, () => void field.morph('SHIP', 1900)],
      [8700, () => void field.dissolve(1200)],
    ]);
  },
};

export default scene;
