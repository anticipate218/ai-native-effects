import '../../src/effects/topography';
import type { TopographyElement } from '../../src/effects/topography';
import { timeline, type Scene } from '../shared/scene';

/** A landing-page hero for a fictional trail-mapping app (original copy). Flips paper → night. */
export const HERO = `
  <style>
    .tp { position:absolute; inset:0; font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif; color:#2a231c; transition:none; }
    .tp.dark { color:#e8f1f4; }
    .tp nav { position:absolute; left:36px; right:36px; top:24px; display:flex; align-items:center; justify-content:space-between; font-size:13px; font-weight:600; }
    .tp .brand { display:flex; align-items:center; gap:9px; font-size:15px; letter-spacing:-.01em; font-weight:700; }
    .tp .brand svg { width:22px; height:22px; }
    .tp .links { display:flex; align-items:center; gap:22px; }
    .tp .links span { opacity:.72; }
    .tp .toggle { display:inline-flex; align-items:center; gap:7px; padding:6px 11px 6px 7px; border-radius:999px; background:rgba(42,35,28,.07); box-shadow: inset 0 0 0 1px rgba(42,35,28,.16); opacity:1 !important; }
    .tp.dark .toggle { background:rgba(232,241,244,.08); box-shadow: inset 0 0 0 1px rgba(232,241,244,.2); }
    .tp .toggle i { width:16px; height:16px; border-radius:50%; background: radial-gradient(circle at 35% 35%, #ffd27a, #e3962f); }
    .tp.dark .toggle i { background: radial-gradient(circle at 70% 30%, transparent 5px, #cfd8ff 5.5px); }
    .tp .copy { position:absolute; left:40px; top:104px; width:470px; }
    .tp .copy::before { content:''; position:absolute; inset:-40px -70px -36px -60px; z-index:-1; border-radius:50%;
      background: radial-gradient(closest-side, rgba(242,236,224,.94), rgba(242,236,224,.8) 55%, transparent); }
    .tp.dark .copy::before { background: radial-gradient(closest-side, rgba(10,16,34,.9), rgba(10,16,34,.72) 55%, transparent); }
    .tp .kicker { font:600 11px/1 ui-monospace,'Cascadia Mono',Consolas,monospace; letter-spacing:.2em; color:#b4532f; }
    .tp.dark .kicker { color:#a78bfa; }
    .tp h1 { margin:14px 0 0; font: 400 52px/0.98 Georgia, 'Times New Roman', serif; letter-spacing:-.025em; }
    .tp h1 i { font-style: italic; }
    .tp p { margin:16px 0 0; font-size:14.5px; line-height:1.5; opacity:.78; max-width:340px; }
    .tp .row { display:flex; gap:10px; margin-top:20px; font-size:13.5px; font-weight:640; }
    .tp .b1 { padding:10px 17px; border-radius:999px; background:#2a231c; color:#f2ece0; }
    .tp.dark .b1 { background:#e8f1f4; color:#0a1022; }
    .tp .b2 { padding:10px 15px; border-radius:999px; box-shadow: inset 0 0 0 1.5px currentColor; }
    .tp .mono { font:600 10.5px/1.45 ui-monospace,'Cascadia Mono',Consolas,monospace; letter-spacing:.08em; }
    .tp .coords { position:absolute; right:36px; top:82px; text-align:right; opacity:.75; }
    .tp .scale { position:absolute; left:40px; bottom:28px; display:flex; align-items:flex-end; gap:10px; opacity:.8; }
    .tp .scale b { display:block; width:120px; height:6px; border:1.5px solid currentColor; border-top:none; background: linear-gradient(90deg, currentColor 0 25%, transparent 25% 50%, currentColor 50% 75%, transparent 75%); background-size:100% 3px; background-repeat:no-repeat; background-position: 0 100%; }
    .tp .north { position:absolute; right:40px; bottom:26px; display:flex; flex-direction:column; align-items:center; gap:3px; opacity:.8; }
    .tp .north svg { width:18px; height:26px; }
    .tp .pin { position:absolute; display:flex; align-items:center; gap:7px; }
    .tp .pin i { width:9px; height:9px; border-radius:50%; background:#b4532f; box-shadow:0 0 0 3px rgba(242,236,224,.9), 0 0 0 4.5px #b4532f; }
    .tp.dark .pin i { background:#a78bfa; box-shadow:0 0 0 3px rgba(10,16,34,.9), 0 0 0 4.5px #a78bfa; }
    .tp .pin span { padding:3px 7px; border-radius:4px; background:rgba(242,236,224,.88); }
    .tp.dark .pin span { background:rgba(10,16,34,.8); }
  </style>
  <div class="tp">
    <nav>
      <span class="brand"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 19 9 7l4 6 3-4 6 10z"/><path d="M6.5 15c2-1 3.5-.5 5 .5s3 1.5 5 0" opacity=".6"/></svg>Ridgeline</span>
      <span class="links"><span>Routes</span><span>Maps</span><span>Pricing</span><span class="toggle"><i></i><b class="tlabel">Day</b></span></span>
    </nav>
    <div class="copy">
      <div class="kicker">TRAIL MAPS · OFFLINE</div>
      <h1>Read the land<br><i>before you walk it.</i></h1>
      <p>Contour maps for every trail, drawn fresh from elevation data. Plan the climb, not just the distance.</p>
      <div class="row"><span class="b1">Plan a route</span><span class="b2">Explore maps</span></div>
    </div>
    <div class="coords mono">46.5583° N<br>8.0057° E<br>ELEV 2,970 M</div>
    <div class="pin mono" style="left:560px; top:300px"><i></i><span>SUMMIT CAMP · 2,412 M</span></div>
    <div class="scale mono"><span>0</span><b></b><span>2 KM</span></div>
    <div class="north mono"><svg viewBox="0 0 18 26"><path d="M9 1 15 20 9 16 3 20z" fill="currentColor"/></svg>N</div>
  </div>`;

const CURSOR = `<svg class="cursor" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="position:absolute;left:0;top:0;pointer-events:none;z-index:5;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));opacity:0"><path d="M5 2.5v17.2l4.3-4.1 2.8 6.4 2.9-1.3-2.8-6.3h6z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 10000,
  poster: 3100,
  capture: { gifFps: 10, gifColors: 48, gifDither: 'bayer:bayer_scale=5', crf: 26 },
  play(stage) {
    stage.innerHTML = `<ane-topography class="bg" theme="paper" grain="0" speed="0" style="position:absolute;inset:0;min-height:0">${HERO}</ane-topography>${CURSOR}`;
    const bg = stage.querySelector<TopographyElement>('ane-topography.bg')!;
    const ui = stage.querySelector<HTMLElement>('.tp')!;
    const label = stage.querySelector<HTMLElement>('.tlabel')!;
    const cursor = stage.querySelector<SVGElement>('.cursor')!;
    const s = stage.getBoundingClientRect();
    // [time, x, y]: wander over the map, click near the summit, go to the theme toggle, come back.
    const way: Array<[number, number, number]> = [
      [600, 700, 470],
      [1700, 600, 330],
      [2700, 560, 250],
      [3900, 640, 210],
      [4900, 716, 36],
      [5700, 716, 36],
      [6900, 520, 330],
      [8200, 640, 250],
      [9400, 700, 470],
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
    const at = (x: number, y: number, type: string): void => {
      bg.dispatchEvent(new PointerEvent(type, { clientX: s.left + x, clientY: s.top + y, pointerType: 'mouse', buttons: type === 'pointerdown' ? 1 : 0, bubbles: true }));
    };
    const step = (t: number) => () => {
      const [x, y] = pos(t);
      const on = t > 600 && t < 9400 && y < 450;
      cursor.style.opacity = on ? '1' : '0';
      cursor.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      // Over the nav the pointer is on the toggle, not the map: let the hill sink.
      if (on && y > 70) at(x, y, 'pointermove');
      else if (bg.matches('[data-in]')) bg.dispatchEvent(new PointerEvent('pointerleave'));
      bg.toggleAttribute('data-in', on && y > 70);
    };
    const steps: Array<[number, () => void]> = [];
    for (let t = 0; t <= 10000; t += 33) steps.push([t, step(t)]);
    return timeline([
      ...steps,
      [2750, () => at(560, 250, 'pointerdown')],
      [5200, () => { bg.setAttribute('theme', 'night'); ui.classList.add('dark'); label.textContent = 'Night'; }],
      [8250, () => at(640, 250, 'pointerdown')],
    ]);
  },
};

export default scene;
