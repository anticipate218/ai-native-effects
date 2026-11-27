import '../../src/effects/orbit-gallery';
import type { OrbitGalleryElement } from '../../src/effects/orbit-gallery';
import { timeline, type Scene } from '../shared/scene';

/** Fictional albums with cover art drawn in CSS (no image assets). */
export const ALBUMS: Array<{ title: string; artist: string; year: number; ink: string; art: string }> = [
  { title: 'Night Swim', artist: 'Halcyon Days', year: 2027, ink: '#e8f3ff',
    art: 'repeating-radial-gradient(circle at 50% 120%, #0d2a4a 0 14px, #12406b 14px 28px), #0d2a4a' },
  { title: 'Static Bloom', artist: 'Marlow Sun', year: 2026, ink: '#2b1430',
    art: 'radial-gradient(circle at 50% 46%, #ffd58a 0 22%, transparent 22.5%), repeating-linear-gradient(0deg, #ff7a6b 0 9px, #ff9b73 9px 18px)' },
  { title: 'Paper Moons', artist: 'Odile', year: 2025, ink: '#3a2f25',
    art: 'radial-gradient(circle at 34% 40%, #3a2f25 0 15%, transparent 15.5%), radial-gradient(circle at 62% 56%, #c4553a 0 21%, transparent 21.5%), #efe4cf' },
  { title: 'Glasshouse', artist: 'The Verandas', year: 2027, ink: '#f4fff9',
    art: 'linear-gradient(135deg, rgba(255,255,255,.18) 0 50%, transparent 50%) 0 0 / 34px 34px, linear-gradient(160deg, #1f8a70, #0b3d4f)' },
  { title: 'Low Tide', artist: 'Sea Wall', year: 2024, ink: '#123',
    art: 'repeating-linear-gradient(170deg, #9fd8e6 0 6px, #e9f7f7 6px 16px)' },
  { title: 'Neon Orchard', artist: 'Kiwi Static', year: 2027, ink: '#fff',
    art: 'conic-gradient(from 210deg at 50% 60%, #ff3d81, #ffb347, #3dd6a3, #4b7bff, #ff3d81)' },
  { title: 'Field Notes', artist: 'Ridgeline', year: 2026, ink: '#3b3127',
    art: 'repeating-radial-gradient(ellipse at 30% 35%, transparent 0 9px, #8a6f55 9px 10.5px), #f0e8d8' },
  { title: 'Velvet Hour', artist: 'June Arcade', year: 2025, ink: '#fff2fb',
    art: 'radial-gradient(circle at 70% 25%, #ff9ad5, transparent 45%), radial-gradient(circle at 20% 80%, #6a3bff, transparent 55%), #2a0f3d' },
  { title: 'Signal / Noise', artist: 'Halftone', year: 2027, ink: '#111',
    art: 'radial-gradient(circle, #111 0 3.2px, transparent 3.6px) 0 0 / 11px 11px, linear-gradient(#ffe14d, #ff8a3d)' },
  { title: 'Kiln', artist: 'Terracotta', year: 2024, ink: '#fff4e6',
    art: 'radial-gradient(circle at 50% 100%, #ffcf91 0 26%, #e0703f 26.5% 46%, #b1452a 46.5% 66%, #6e2418 66.5%)' },
];

export const COVER_CSS = `
  .cover { display:block; border-radius:12px; overflow:hidden; background:#111; box-shadow: 0 18px 40px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.08); color:inherit; text-decoration:none; }
  .cover .art { aspect-ratio: 1; position:relative; }
  .cover .art b { position:absolute; left:12px; bottom:10px; right:12px; font: 700 15px/1.05 ui-sans-serif, system-ui, 'Segoe UI', sans-serif; letter-spacing:-.01em; }
  .cover .art small { position:absolute; left:12px; top:10px; font: 600 9px/1 ui-monospace, 'Cascadia Mono', Consolas, monospace; letter-spacing:.16em; opacity:.8; }
`;

export const covers = (): string =>
  ALBUMS.map(
    (a) =>
      `<a class="cover" href="#${encodeURIComponent(a.title)}" aria-label="${a.title} by ${a.artist}"><div class="art" style="background:${a.art};color:${a.ink}"><small>${a.artist.toUpperCase()}</small><b>${a.title}</b></div></a>`,
  ).join('');

/** A music app's "new releases" hero (original copy). */
export const CRATE = `
  <style>
    .cr { position:absolute; inset:0; font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif; color:#f3f1ff;
      background: radial-gradient(120% 80% at 50% 0%, #2a2350 0%, #12101f 55%, #0a0912 100%); }
    .cr nav { position:absolute; left:32px; right:32px; top:22px; display:flex; align-items:center; justify-content:space-between; font-size:13px; font-weight:600; z-index:2; }
    .cr .brand { display:flex; align-items:center; gap:9px; font-size:15px; font-weight:750; letter-spacing:-.01em; }
    .cr .brand i { width:18px; height:18px; border-radius:50%; background: radial-gradient(circle, #12101f 0 22%, #8b7bff 23% 60%, #c9c1ff 61%); }
    .cr .links { display:flex; gap:22px; opacity:.7; }
    .cr .kicker { position:absolute; left:0; right:0; top:62px; text-align:center; font: 600 10.5px/1 ui-monospace,'Cascadia Mono',Consolas,monospace; letter-spacing:.24em; color:#a99cff; }
    .cr ane-orbit-gallery { position:absolute; left:0; right:0; top:58px; height:300px; }
    .cr .info { position:absolute; left:0; right:0; bottom:22px; display:flex; flex-direction:column; align-items:center; gap:4px; }
    .cr .info h2 { margin:0; font: 400 30px/1.05 Georgia, 'Times New Roman', serif; letter-spacing:-.02em; }
    .cr .info p { margin:0; font-size:13px; opacity:.65; }
    .cr .ctrl { display:flex; align-items:center; gap:12px; margin-top:10px; font-size:12.5px; font-weight:650; }
    .cr .play { display:inline-flex; align-items:center; gap:8px; padding:8px 15px 8px 12px; border-radius:999px; background:#f3f1ff; color:#16122b; }
    .cr .play::before { content:''; border-left:9px solid currentColor; border-top:6px solid transparent; border-bottom:6px solid transparent; }
    .cr .ghost { padding:8px 14px; border-radius:999px; box-shadow: inset 0 0 0 1.5px rgba(243,241,255,.35); }
    .cr .dots { display:flex; gap:5px; margin-left:6px; }
    .cr .dots span { width:5px; height:5px; border-radius:3px; background: rgba(243,241,255,.3); }
    .cr .dots span.on { width:16px; background:#a99cff; }
    ${COVER_CSS}
  </style>
  <div class="cr">
    <nav><span class="brand"><i></i>Crate</span><span class="links"><span>Home</span><span>Library</span><span>Radio</span></span></nav>
    <div class="kicker">NEW THIS WEEK</div>
    <ane-orbit-gallery card-width="150" tilt="10" reflect aria-label="New releases">${covers()}</ane-orbit-gallery>
    <div class="info">
      <h2 class="t">${ALBUMS[0]!.title}</h2>
      <p class="a">${ALBUMS[0]!.artist} · ${ALBUMS[0]!.year} · 11 songs</p>
      <div class="ctrl"><span class="play">Play</span><span class="ghost">Save</span><span class="dots">${ALBUMS.map((_, i) => `<span${i ? '' : ' class="on"'}></span>`).join('')}</span></div>
    </div>
  </div>`;

/** Keeps the info panel in sync with the front card. */
export function bindInfo(root: ParentNode): void {
  const g = root.querySelector<OrbitGalleryElement>('ane-orbit-gallery')!;
  const t = root.querySelector<HTMLElement>('.info .t')!;
  const a = root.querySelector<HTMLElement>('.info .a')!;
  const dots = [...root.querySelectorAll<HTMLElement>('.info .dots span')];
  g.addEventListener('ane-orbit-change', (e) => {
    const al = ALBUMS[e.detail.index]!;
    t.textContent = al.title;
    a.textContent = `${al.artist} · ${al.year} · ${9 + (e.detail.index % 4)} songs`;
    dots.forEach((d, i) => d.classList.toggle('on', i === e.detail.index));
  });
}

const CURSOR = `<svg class="cursor" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="position:absolute;left:0;top:0;pointer-events:none;z-index:5;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));opacity:0"><path d="M5 2.5v17.2l4.3-4.1 2.8 6.4 2.9-1.3-2.8-6.3h6z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 9600,
  poster: 8600,
  capture: { gifFps: 15, gifColors: 128, crf: 22 },
  play(stage) {
    stage.innerHTML = CRATE + CURSOR;
    bindInfo(stage);
    const g = stage.querySelector<OrbitGalleryElement>('ane-orbit-gallery')!;
    const cursor = stage.querySelector<SVGElement>('.cursor')!;
    const s = stage.getBoundingClientRect();
    let cx = 520;
    let cy = 470;
    const show = (x: number, y: number, on = true): void => {
      cx = x;
      cy = y;
      cursor.style.opacity = on ? '1' : '0';
      cursor.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    };
    const ev = (type: string, x: number, y: number): void => {
      const init = { clientX: s.left + x, clientY: s.top + y, pointerId: 7, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, composed: true };
      const target = type === 'pointerdown' ? (document.elementFromPoint(s.left + x, s.top + y) ?? g) : g;
      target.dispatchEvent(new PointerEvent(type, init));
    };
    const glide = (t0: number, t1: number, x1: number, y1: number, drag = false): Array<[number, () => void]> => {
      const out: Array<[number, () => void]> = [];
      let from: [number, number] | null = null;
      for (let t = t0; t <= t1; t += 33) {
        out.push([t, () => {
          from ??= [cx, cy];
          const u = (t - t0) / (t1 - t0);
          const e = drag ? u : u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
          const x = from[0] + (x1 - from[0]) * e;
          const y = from[1] + (y1 - from[1]) * e;
          show(x, y);
          if (drag) ev('pointermove', x, y);
        }]);
      }
      return out;
    };
    return timeline([
      ...glide(500, 1300, 470, 170),
      // Fling the ring to the left: it coasts, then springs onto a card.
      [1500, () => ev('pointerdown', cx, cy)],
      ...glide(1520, 1860, 210, 180, true),
      [1870, () => ev('pointerup', cx, cy)],
      ...glide(2300, 3300, 676, 176),
      // Click a side card: it comes round to the front.
      [3500, () => { ev('pointerdown', cx, cy); ev('pointerup', cx, cy); }],
      ...glide(3800, 4700, 560, 470),
      [4800, () => show(cx, cy, false)],
      // Keyboard: next, next.
      [6200, () => g.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))],
      [7300, () => g.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))],
    ]);
  },
};

export default scene;
