import '../../src/effects/dither-gradient';
import type { DitherGradientElement } from '../../src/effects/dither-gradient';
import { timeline, type Scene } from '../shared/scene';

/** A record-release hero for a fictional artist (original copy). Theme flips with the palette. */
export const RELEASE = `
  <style>
    .dg { position:absolute; inset:0; font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif; color:#fff7ec; }
    .dg.light { color:#2b2620; }
    .dg nav { position:absolute; left:34px; right:34px; top:22px; display:flex; justify-content:space-between; font:600 12px/1 ui-monospace,'Cascadia Mono',Consolas,monospace; letter-spacing:.14em; }
    .dg nav span:last-child { display:flex; gap:20px; opacity:.8; }
    .dg .copy { position:absolute; left:40px; bottom:40px; width:420px; }
    .dg.light .copy::before { content:''; position:absolute; inset:-36px -60px -30px -50px; z-index:-1; border-radius:50%;
      background: radial-gradient(closest-side, rgba(255,250,240,.92), rgba(255,250,240,.75) 55%, transparent); }
    .dg.light nav::before { content:''; position:absolute; inset:-14px -20px; z-index:-1; background: linear-gradient(rgba(255,250,240,.8), transparent); }
    .dg .kicker { font:600 11.5px/1 ui-monospace,'Cascadia Mono',Consolas,monospace; letter-spacing:.18em; opacity:.85; }
    .dg h1 { margin:12px 0 0; font: 400 58px/0.96 Georgia, 'Times New Roman', serif; letter-spacing:-.02em; text-shadow: 0 2px 18px rgba(0,0,0,.25); }
    .dg.light h1 { text-shadow: none; }
    .dg h1 i { font-style: italic; }
    .dg p { margin:14px 0 0; font-size:14px; line-height:1.5; opacity:.8; max-width:330px; }
    .dg .row { display:flex; gap:10px; margin-top:18px; font-size:13.5px; font-weight:620; }
    .dg .btn1 { padding:10px 16px; border-radius:999px; background:#fff7ec; color:#2b1a3d; }
    .dg.light .btn1 { background:#2b2620; color:#f3ecdc; }
    .dg .btn2 { padding:10px 15px; border-radius:999px; box-shadow: inset 0 0 0 1.5px currentColor; }
    .dg .album { position:absolute; right:46px; top:84px; width:250px; padding:12px; border-radius:6px; background:rgba(255,247,236,.12); box-shadow: 0 30px 60px rgba(10,4,24,.35), inset 0 0 0 1px rgba(255,247,236,.25); backdrop-filter: blur(6px); }
    .dg.light .album { background: rgba(43,38,32,.08); box-shadow: 0 30px 60px rgba(43,38,32,.18), inset 0 0 0 1px rgba(43,38,32,.18); }
    .dg .album ane-dither-gradient { min-height: 0; height: 226px; border-radius: 3px; }
    .dg .meta { display:flex; justify-content:space-between; margin-top:10px; font:600 11px/1.3 ui-monospace,'Cascadia Mono',Consolas,monospace; letter-spacing:.06em; }
    .dg .meta span:last-child { opacity:.7; }
  </style>
  <div class="dg">
    <nav><span>MARLOW SUN</span><span><span>MUSIC</span><span>TOUR</span><span>STORE</span></span></nav>
    <div class="album">
      <ane-dither-gradient class="art" palette="gameboy" pixel="4" dither="bayer4" scale="1.6" seed="21" lens="off"></ane-dither-gradient>
      <div class="meta"><span>STATIC BLOOM</span><span>LP · 2027</span></div>
    </div>
    <div class="copy">
      <div class="kicker">NEW ALBUM · OUT FRIDAY</div>
      <h1>Low fidelity,<br><i>high feelings.</i></h1>
      <p>Eleven songs recorded to tape in a room with one window. Pre-save it now.</p>
      <div class="row"><span class="btn1">Pre-save</span><span class="btn2">Watch the film</span></div>
    </div>
  </div>`;

const CURSOR = `<svg class="cursor" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="position:absolute;left:0;top:0;pointer-events:none;z-index:5;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));opacity:0"><path d="M5 2.5v17.2l4.3-4.1 2.8 6.4 2.9-1.3-2.8-6.3h6z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 10000,
  poster: 2600,
  capture: { gifFps: 15, gifColors: 64, gifDither: 'bayer:bayer_scale=5', crf: 22 },
  play(stage) {
    stage.innerHTML = `<ane-dither-gradient class="bg" palette="sunset" pixel="3" style="position:absolute;inset:0;min-height:0">${RELEASE}</ane-dither-gradient>${CURSOR}`;
    const bg = stage.querySelector<DitherGradientElement>('ane-dither-gradient.bg')!;
    const theme = stage.querySelector<HTMLElement>('.dg')!;
    const cursor = stage.querySelector<SVGElement>('.cursor')!;
    const s = stage.getBoundingClientRect();
    const way: Array<[number, number, number]> = [
      [900, 560, 470],
      [1700, 470, 250],
      [2600, 300, 170],
      [3500, 470, 120],
      [4300, 640, 330],
      [5200, 520, 470],
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
      const on = t > 900 && t < 5200 && y < 450;
      cursor.style.opacity = on ? '1' : '0';
      cursor.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (on) bg.dispatchEvent(new PointerEvent('pointermove', { clientX: s.left + x, clientY: s.top + y, pointerType: 'mouse' }));
      else if (bg.matches('[data-in]')) bg.dispatchEvent(new PointerEvent('pointerleave'));
      bg.toggleAttribute('data-in', on);
    };
    const steps: Array<[number, () => void]> = [];
    for (let t = 0; t <= 10000; t += 33) steps.push([t, step(t)]);
    return timeline([
      ...steps,
      // Flip to a light, printed look and back.
      [5600, () => { bg.setAttribute('palette', 'paper'); bg.setAttribute('colors', '#b9a68a,#ddd0b8,#f3ecdc,#fffaf0'); theme.classList.add('light'); }],
      [8600, () => { bg.setAttribute('palette', 'sunset'); bg.removeAttribute('colors'); theme.classList.remove('light'); }],
    ]);
  },
};

export default scene;
