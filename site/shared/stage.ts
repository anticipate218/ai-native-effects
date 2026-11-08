import type { Scene } from './scene';

declare global {
  interface Window {
    __scene?: Pick<Scene, 'width' | 'height' | 'duration' | 'poster'>;
    __stageReady?: boolean;
    __startScene?: () => void;
  }
}

const scenes = import.meta.glob<{ default: Scene }>('../scenes/*.ts');
const params = new URLSearchParams(location.search);
const id = params.get('effect') ?? 'thinking-buddy';
const capture = params.has('capture');
const stage = document.getElementById('stage') as HTMLElement;

async function main(): Promise<void> {
  const load = scenes[`../scenes/${id}.ts`];
  if (!load) {
    stage.textContent = `Unknown scene: ${id}`;
    return;
  }
  const scene = (await load()).default;
  stage.style.width = `${scene.width}px`;
  stage.style.height = `${scene.height}px`;
  window.__scene = { width: scene.width, height: scene.height, duration: scene.duration, poster: scene.poster };

  let dispose = (): void => {};
  const start = (): void => {
    dispose();
    stage.replaceChildren();
    dispose = scene.play(stage);
  };
  if (capture) {
    // scripts/capture.mjs freezes the clock first, then starts the scene.
    window.__startScene = start;
  } else {
    start();
    window.setInterval(start, scene.duration);
  }
  window.__stageReady = true;
}

void main();
