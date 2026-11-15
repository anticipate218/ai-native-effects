import '../../src/effects/glass-lens';
import { timeline, type Scene } from '../shared/scene';

/** Cinematic stage: dark field, warm and cool light blooms, fine grain (SVG noise, generated). */
export const STAGE_BG = `background:
  radial-gradient(60% 70% at 12% 18%, rgba(255,150,80,.30), transparent 60%),
  radial-gradient(55% 65% at 92% 88%, rgba(90,140,255,.32), transparent 62%),
  radial-gradient(40% 50% at 70% 10%, rgba(180,120,255,.18), transparent 60%),
  #07080d`;
const NOISE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .09 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`;
export const GRAIN = `url(data:image/svg+xml;base64,${btoa(NOISE_SVG)})`;

export const ARTICLE = `
  <p style="margin:0 0 6px;font:600 10.5px/1 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:#8a7f70">Source 2 of 3 · rijkswaterstaat.nl</p>
  <h3 style="margin:0 0 10px;font:600 23px/1.2 Georgia,'Times New Roman',serif;letter-spacing:-.01em;color:#1d1a16">High water on the Rhine, June 2026</h3>
  <p style="margin:0;font:16.5px/1.62 Georgia,'Times New Roman',serif;color:#2b2722">
    Discharge at Lobith rose steadily after heavy rain in the Swiss and German catchments.
    <mark>The river peaked on 11 June at 15.9 metres</mark>, the highest level since 1995, before
    falling back over the following week. Most flooding stayed within the floodplains, but
    <mark>several polders near Nijmegen were opened to relieve pressure</mark> on the dikes.
    Water boards expect the floodplain grasslands to dry out by early July.
  </p>`;

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 14500,
  poster: 5200,
  play(stage) {
    stage.innerHTML = `
      <div style="position:absolute;inset:0;${STAGE_BG}"></div>
      <div style="position:absolute;inset:0;background-image:${GRAIN};mix-blend-mode:overlay;opacity:.9"></div>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;gap:16px;padding:0 70px">
      <div style="display:flex;align-items:center;justify-content:space-between;font:600 12px/1 ui-sans-serif,system-ui,'Segoe UI',sans-serif;color:rgba(240,238,255,.86)">
        <span style="display:inline-flex;align-items:center;gap:9px"><i style="width:7px;height:7px;border-radius:50%;background:#b48cff;box-shadow:0 0 12px #b48cff"></i>Research assistant · reading sources</span>
        <span class="count" style="font-family:ui-monospace,Menlo,Consolas,monospace;color:rgba(240,238,255,.6)">2 citations found</span>
      </div>
      <div style="border-radius:18px;background:#f4efe6;box-shadow:0 40px 90px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.06);overflow:hidden">
        <ane-glass-lens mode="read" rate="380" accent="#7c5cff" style="padding:30px 34px 32px">
          <style>mark{background:none;color:inherit}</style>
          ${ARTICLE}
        </ane-glass-lens>
      </div>
      </div>`;
    const lens = stage.querySelector('ane-glass-lens')!;
    const counter = stage.querySelector<HTMLElement>('.count')!;
    let found = 0;
    counter.textContent = '0 citations found';
    lens.addEventListener('ane-lens-mark', () => {
      found += 1;
      counter.textContent = `${found} citation${found === 1 ? '' : 's'} found`;
    });
    return timeline([]);
  },
};

export default scene;
