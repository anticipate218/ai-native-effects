import '../../src/effects/token-stream';
import { createRandom } from '../../src/core/math';
import { timeline, type Scene } from '../shared/scene';

export const SAMPLE_ANSWER =
  '**Flood extent grew by 38%** between the passes on 2 and 14 June.\n\n' +
  'Most new water sits along the lower Rhine, where backscatter dropped below `-18 dB`. ' +
  'Two clusters near Nijmegen and Arnhem account for 61% of the change, which points to river overflow rather than rainfall ponding.\n\n' +
  'Next, I can mask permanent water with the `JRC GSW` layer and export the change map as a GeoTIFF.';

/** Splits text into bursty network-like chunks (deterministic for a seed). */
export function burstyChunks(text: string, seed = 3): Array<{ at: number; text: string }> {
  const random = createRandom(seed);
  const chunks: Array<{ at: number; text: string }> = [];
  let i = 0;
  let at = 0;
  while (i < text.length) {
    const burst = random() < 0.18;
    const size = burst ? 40 + Math.floor(random() * 50) : 3 + Math.floor(random() * 14);
    chunks.push({ at, text: text.slice(i, i + size) });
    i += size;
    at += burst ? 520 + random() * 380 : 60 + random() * 170;
  }
  return chunks;
}

const AVATAR = `<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true"><defs><linearGradient id="av" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b6cff"/><stop offset="1" stop-color="#4fd8ff"/></linearGradient></defs><circle cx="14" cy="14" r="14" fill="url(#av)"/><path d="M14 7.5l1.6 4.2 4.4 1.6-4.4 1.6L14 19.1l-1.6-4.2-4.4-1.6 4.4-1.6z" fill="#fff"/></svg>`;

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 10400,
  poster: 6200,
  play(stage) {
    stage.innerHTML = `
      <div class="stage-tag">&lt;ane-token-stream&gt;</div>
      <div style="position:absolute;inset:0;display:grid;place-items:center">
        <div style="width:640px;height:360px;border-radius:18px;background:linear-gradient(180deg,#121633,#0c0f24);border:1px solid rgba(255,255,255,.09);box-shadow:0 30px 80px rgba(0,0,0,.45);display:flex;flex-direction:column;overflow:hidden;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif">
          <div style="display:flex;align-items:center;gap:10px;padding:13px 18px;border-bottom:1px solid rgba(255,255,255,.07);font-size:13px;font-weight:600;color:rgba(230,234,255,.82)">
            <i style="width:8px;height:8px;border-radius:50%;background:#3ddc97;box-shadow:0 0 10px #3ddc97"></i>Flood analysis · Copilot
          </div>
          <div style="flex:1;padding:16px 20px;display:flex;flex-direction:column;gap:14px">
            <div style="align-self:flex-end;max-width:72%;padding:9px 14px;border-radius:14px 14px 4px 14px;background:#2b2f5c;color:#eef0ff;font-size:14px;line-height:1.45">Compare the flood extent between the two Sentinel-1 passes.</div>
            <div style="display:flex;gap:12px;align-items:flex-start">
              ${AVATAR}
              <ane-token-stream rate="70" accent="#8b6cff" style="flex:1;font-size:14.5px;color:#e4e8f7;line-height:1.62;padding-top:3px"></ane-token-stream>
            </div>
          </div>
        </div>
      </div>
      <div class="stage-brand">AI Native Effects</div>`;
    const stream = stage.querySelector('ane-token-stream')!;
    return timeline([
      ...burstyChunks(SAMPLE_ANSWER).map(({ at, text }): [number, () => void] => [1100 + at, () => stream.write(text)]),
      [9000, () => stream.done()],
    ]);
  },
};

export default scene;
