import '../../src/effects/orbit-loader';
import { timeline, type Scene } from '../shared/scene';

/** Irregular progress steps feel like a real download rather than a tween. */
const PROGRESS: Array<[number, number]> = [
  [1500, 0.06], [1900, 0.14], [2300, 0.19], [2800, 0.31], [3200, 0.38], [3500, 0.44],
  [4100, 0.52], [4500, 0.63], [5000, 0.71], [5400, 0.79], [5800, 0.86], [6300, 0.93], [6700, 1],
];
const TOTAL_TILES = 142;

const scene: Scene = {
  width: 640,
  height: 400,
  duration: 9800,
  poster: 4700,
  play(stage) {
    stage.innerHTML = `
      <div class="stage-tag">&lt;ane-orbit-loader&gt;</div>
      <div style="position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:10px;padding-bottom:6px">
        <ane-orbit-loader size="300px" seed="11" satellites="3"></ane-orbit-loader>
        <div class="status-pill" role="status"><i></i><span>Connecting to ground stations…</span></div>
      </div>
      <div class="stage-brand">AI Native Effects</div>`;
    const loader = stage.querySelector('ane-orbit-loader')!;
    const pill = stage.querySelector<HTMLElement>('.status-pill')!;
    const text = pill.querySelector('span')!;
    const say = (label: string, color = '#5ef2ff'): void => {
      text.textContent = label;
      pill.style.setProperty('--dot', color);
    };
    return timeline([
      ...PROGRESS.map(([at, value]): [number, () => void] => [
        at,
        () => {
          loader.progress = value;
          if (value < 1) say(`Downloading Sentinel-2 tiles · ${Math.round(value * TOTAL_TILES)}/${TOTAL_TILES}`);
          else say(`${TOTAL_TILES} tiles ready`, '#3ddc97');
        },
      ]),
      [9300, () => {
        loader.progress = null;
        say('Connecting to ground stations…');
      }],
    ]);
  },
};

export default scene;
