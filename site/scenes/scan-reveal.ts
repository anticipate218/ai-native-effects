import '../../src/effects/scan-reveal';
import { timeline, type Scene } from '../shared/scene';

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 9800,
  poster: 5600,
  play(stage) {
    stage.innerHTML = `
      <ane-scan-reveal hud seed="11" duration="3600" style="position:absolute;inset:0;width:100%;height:100%;aspect-ratio:auto;border-radius:0"
        caption="Sentinel-2B · MSI L2A" detail="T31UFU · 10 m · 2026-06-14"
        alt="Procedural farmland scene with a river, a town and forest, overlaid with a land-cover mask"></ane-scan-reveal>`;
    return timeline([]);
  },
};

export default scene;
