import '../../src/effects/hold-button';
import type { HoldButtonElement } from '../../src/effects/hold-button';
import { timeline, type Scene } from '../shared/scene';

const TRASH = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>';
const ROCKET = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 15c-1.5 1-2 4-2 6 2 0 5-.5 6-2M9 15l-3-3c1-4 4-8 12-9-1 8-5 11-9 12z"/><circle cx="14.5" cy="9.5" r="1.6"/></svg>';

/** Settings page with a danger zone and a release panel (fictional product, original copy). */
export const SETTINGS = `
  <div style="position:absolute;inset:0;background:radial-gradient(70% 70% at 70% 0%,#1d2240,#0b0d17 70%);font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;color:#e9ecf6">
    <aside style="position:absolute;left:0;top:0;bottom:0;width:178px;padding:22px 16px;border-right:1px solid rgba(255,255,255,.06);background:rgba(8,10,20,.5)">
      <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px"><i style="width:18px;height:18px;border-radius:5px;background:linear-gradient(135deg,#7c8cff,#ff6b8b)"></i>Orbitly</div>
      <div style="margin-top:22px;display:grid;gap:4px;font-size:12.5px;color:rgba(233,236,246,.6)">
        <span style="padding:7px 10px">General</span><span style="padding:7px 10px">Members</span><span style="padding:7px 10px">Billing</span>
        <span style="padding:7px 10px">Integrations</span><span style="padding:7px 10px;border-radius:8px;background:rgba(255,255,255,.07);color:#fff">Advanced</span>
      </div>
    </aside>
    <main style="position:absolute;left:178px;right:0;top:0;bottom:0;padding:24px 30px">
      <div style="font-size:21px;font-weight:700;letter-spacing:-.02em">Advanced</div>
      <div style="font-size:12.5px;color:rgba(233,236,246,.55);margin-top:3px">Releases and irreversible actions for <b style="color:#fff;font-weight:600">acme-web</b></div>
      <section style="margin-top:18px;padding:16px 18px;border-radius:14px;background:rgba(255,255,255,.04);box-shadow:inset 0 0 0 1px rgba(255,255,255,.07)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
          <div><div style="font-weight:650;font-size:14px">Publish release v2.4.0</div>
          <div style="font-size:12px;color:rgba(233,236,246,.55);margin-top:4px">14 commits · checks passed · ships to 38,120 users</div></div>
          <ane-hold-button class="publish" color="#7c6cff" accent="#2fd39a" duration="1200" done-text="Published" reset-after="2300">${ROCKET}Hold to publish</ane-hold-button>
        </div>
      </section>
      <section style="margin-top:14px;padding:16px 18px;border-radius:14px;background:rgba(255,77,94,.05);box-shadow:inset 0 0 0 1px rgba(255,77,94,.28)">
        <div style="font-size:11px;font-weight:700;letter-spacing:.14em;color:#ff7a86">DANGER ZONE</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:10px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.06)">
          <div><div style="font-weight:650;font-size:14px">Transfer ownership</div><div style="font-size:12px;color:rgba(233,236,246,.55);margin-top:4px">Move this workspace to another team.</div></div>
          <span style="padding:10px 16px;border-radius:999px;font-size:13px;font-weight:600;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)">Transfer</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:12px">
          <div><div style="font-weight:650;font-size:14px">Delete workspace</div><div style="font-size:12px;color:rgba(233,236,246,.55);margin-top:4px">Removes all projects, data and members. This cannot be undone.</div></div>
          <ane-hold-button class="delete" duration="1500" done-text="Deleted" reset-after="3600">${TRASH}Hold to delete</ane-hold-button>
        </div>
      </section>
    </main>
  </div>`;

const CURSOR = `<svg class="cursor" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" style="position:absolute;left:0;top:0;pointer-events:none;z-index:9;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));opacity:0"><path d="M5 2.5v17.2l4.3-4.1 2.8 6.4 2.9-1.3-2.8-6.3h6z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 9200,
  poster: 3650,
  capture: { gifFps: 15, gifColors: 128, crf: 22 },
  play(stage) {
    stage.innerHTML = SETTINGS + CURSOR;
    const del = stage.querySelector<HoldButtonElement>('.delete')!;
    const pub = stage.querySelector<HoldButtonElement>('.publish')!;
    const cursor = stage.querySelector<SVGElement>('.cursor')!;
    const s = stage.getBoundingClientRect();
    const centre = (el: Element): [number, number] => {
      const r = el.getBoundingClientRect();
      return [r.left - s.left + r.width * 0.42, r.top - s.top + r.height * 0.55];
    };
    const D = centre(del);
    const P = centre(pub);
    const way: Array<[number, number, number]> = [
      [0, 820, 470], [500, 820, 470], [1250, D[0], D[1]], [4500, D[0], D[1]],
      [5100, P[0], P[1]], [6700, P[0], P[1]], [7500, 830, 120], [9200, 820, 470],
    ];
    const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const pos = (t: number): [number, number] => {
      for (let k = 1; k < way.length; k++) {
        const [t1, x1, y1] = way[k]!;
        const [t0, x0, y0] = way[k - 1]!;
        if (t <= t1) {
          const u = ease((t - t0) / Math.max(1, t1 - t0));
          return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
        }
      }
      return [way.at(-1)![1], way.at(-1)![2]];
    };
    const steps: Array<[number, () => void]> = [];
    for (let t = 0; t <= 9200; t += 33) {
      steps.push([t, () => {
        const [x, y] = pos(t);
        cursor.style.opacity = t > 400 && t < 7600 ? '1' : '0';
        cursor.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${pressed ? 0.88 : 1})`;
      }]);
    }
    let pressed = false;
    const ptr = (el: HoldButtonElement, type: string, id: number) => () => {
      pressed = type === 'pointerdown';
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent(type, { pointerId: id, button: 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true }));
    };
    return timeline([
      ...steps,
      [1400, ptr(del, 'pointerdown', 1)],   // a short press, released early: the fill drains back
      [2000, ptr(del, 'pointerup', 1)],
      [2650, ptr(del, 'pointerdown', 2)],   // held to the end
      [4350, ptr(del, 'pointerup', 2)],
      [5250, ptr(pub, 'pointerdown', 3)],
      [6650, ptr(pub, 'pointerup', 3)],
    ]);
  },
};

export default scene;
