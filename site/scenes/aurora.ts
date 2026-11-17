import '../../src/effects/aurora';
import { timeline, type Scene } from '../shared/scene';

/** A complete landing-page hero over the aurora (fictional product, original copy). */
export const HERO = `
  <nav style="display:flex;align-items:center;justify-content:space-between;padding:22px 34px;font:500 13px/1 ui-sans-serif,system-ui,'Segoe UI',sans-serif;color:rgba(242,244,255,.82)">
    <span style="display:inline-flex;align-items:center;gap:9px;font-weight:650;color:#fff;letter-spacing:-.01em;font-size:14px">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 15c3-7 6-10 8-10s5 3 8 10" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="5" r="1.6" fill="#fff"/></svg>
      Northlight
    </span>
    <span style="display:flex;gap:26px"><span>Product</span><span>Journal</span><span>Pricing</span></span>
    <span style="padding:9px 15px;border-radius:999px;background:rgba(255,255,255,.09);box-shadow:inset 0 0 0 1px rgba(255,255,255,.16);color:#fff">Sign in</span>
  </nav>
  <div class="hero-copy" style="display:grid;justify-items:center;text-align:center;padding:34px 24px 0;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif">
    <span style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 8px;border-radius:999px;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);font-size:12px;color:rgba(242,244,255,.85)">
      <span style="padding:2px 7px;border-radius:999px;background:#3dffa8;color:#062016;font-weight:700;font-size:10.5px">NEW</span> Night mode for deep work
    </span>
    <h1 style="margin:18px 0 0;font-size:58px;line-height:1.02;font-weight:650;letter-spacing:-.035em;color:#fff;max-width:640px">Light up the<br>quiet hours.</h1>
    <p style="margin:16px 0 0;max-width:430px;font-size:15.5px;line-height:1.55;color:rgba(242,244,255,.72)">A calm workspace for night owls, writers and builders. Everything you need, nothing that glows too bright.</p>
    <div style="display:flex;gap:12px;margin-top:24px;font-size:14px;font-weight:600">
      <span style="padding:12px 20px;border-radius:999px;background:#fff;color:#0a0d1a;box-shadow:0 10px 30px rgba(61,255,168,.25)">Start for free</span>
      <span style="padding:12px 18px;border-radius:999px;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)">See how it works →</span>
    </div>
  </div>`;

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 9000,
  poster: 4200,
  play(stage) {
    stage.innerHTML = `<ane-aurora interactive seed="7" style="position:absolute;inset:0;min-height:0">${HERO}</ane-aurora>`;
    const aurora = stage.querySelector('ane-aurora')!;
    // A slow, scripted pointer drift across the sky (shows the curtains leaning in).
    const move = (fx: number, fy: number) => () => {
      const box = aurora.getBoundingClientRect();
      aurora.dispatchEvent(new PointerEvent('pointermove', { clientX: box.left + box.width * fx, clientY: box.top + box.height * fy, bubbles: true }));
    };
    const path: Array<[number, number, number]> = [];
    for (let i = 0; i <= 40; i++) path.push([1500 + i * 100, 0.2 + 0.6 * (i / 40), 0.3 + 0.06 * Math.sin(i / 6)]);
    return timeline([
      ...path.map(([at, x, y]): [number, () => void] => [at, move(x, y)]),
      [6200, () => aurora.dispatchEvent(new PointerEvent('pointerleave'))],
    ]);
  },
};

export default scene;
