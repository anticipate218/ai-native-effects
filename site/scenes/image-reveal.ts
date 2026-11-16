import '../../src/effects/image-reveal';
import { timeline, type Scene } from '../shared/scene';

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 8200,
  poster: 3200,
  play(stage) {
    stage.innerHTML = `
      <ane-image-reveal hud compare seed="11" steps="30" duration="4400" style="position:absolute;inset:0;width:100%;height:100%;aspect-ratio:auto;border-radius:0"
        caption="“Aerial photo of farmland along a river, small town, summer, high detail”"
        alt="Generated aerial photo of farmland along a river with a small town"></ane-image-reveal>`;
    return timeline([]);
  },
};

export default scene;
