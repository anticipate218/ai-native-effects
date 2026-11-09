import '../../src/effects/orbit-loading-screen';
import { timeline, type Scene } from '../shared/scene';

const TOTAL_GB = 1.94;
const TILES = 142;
/** Irregular chunks read like a real download rather than a tween. */
const PROGRESS = [0.05, 0.11, 0.16, 0.24, 0.29, 0.37, 0.45, 0.5, 0.58, 0.66, 0.71, 0.79, 0.86, 0.91, 0.96, 1];
const TILE_IDS = ['T31UFU', 'T31UGU', 'T32ULC', 'T31TFM', 'T32TLR', 'T31UFT', 'T32ULB', 'T31TGL'];

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 10400,
  poster: 5200,
  play(stage) {
    stage.innerHTML = `
      <ane-orbit-loading-screen style="position:absolute;inset:0;height:100%" seed="11" quality="high"
        eyebrow="Sentinel-2 · Level-2A" steps="Authenticate|Query catalog|Download tiles|Build mosaic"></ane-orbit-loading-screen>`;
    const screen = stage.querySelector('ane-orbit-loading-screen')!;
    const connect = (): void => {
      screen.progress = null;
      screen.step = 1;
      screen.setAttribute('heading', 'Searching the catalog');
      screen.setAttribute('detail', 'Western Europe · Jun 2026 · cloud < 10%');
      screen.setAttribute('status', 'GET /odata/v1/Products?$filter=… 200');
    };
    connect();
    const start = 1500;
    const step = 360;
    return timeline([
      [
        start,
        () => {
          screen.step = 2;
          screen.progress = 0;
          screen.setAttribute('heading', 'Downloading imagery');
        },
      ],
      ...PROGRESS.map((value, i): [number, () => void] => [
        start + 250 + i * step,
        () => {
          if (value >= 0.9) screen.step = 3;
          screen.progress = value;
          if (value < 1) {
            const gb = (value * TOTAL_GB).toFixed(2);
            const eta = Math.round((1 - value) * 26);
            screen.setAttribute('detail', `${gb} GB of ${TOTAL_GB} GB · ${38 + (i % 4) * 3} MB/s · 0:${String(eta).padStart(2, '0')} left`);
            screen.setAttribute('status', `tile ${TILE_IDS[i % TILE_IDS.length]} · cloud ${(i * 7) % 9}% · ${Math.round(value * TILES)}/${TILES}`);
          }
        },
      ]),
      [
        start + 250 + PROGRESS.length * step + 300,
        () => {
          screen.setAttribute('eyebrow', 'Ready');
          screen.setAttribute('heading', 'Mosaic ready to explore');
          screen.setAttribute('detail', `${TILES} tiles · ${TOTAL_GB} GB · 9.8 s`);
          screen.setAttribute('status', '');
        },
      ],
      [
        9900,
        () => {
          screen.setAttribute('eyebrow', 'Sentinel-2 · Level-2A');
          connect();
        },
      ],
    ]);
  },
};

export default scene;
