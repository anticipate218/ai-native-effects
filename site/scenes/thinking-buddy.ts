import '../../src/effects/thinking-buddy';
import type { BuddyState } from '../../src/effects/thinking-buddy';
import { timeline, type Scene } from '../shared/scene';

const STEPS: Array<[number, BuddyState, string, string]> = [
  [0, 'idle', 'Ready', '#5ef2ff'],
  [700, 'thinking', 'Thinking…', '#5ef2ff'],
  [2700, 'waiting', 'Waiting for tool result…', '#ffb547'],
  [4000, 'thinking', 'Thinking…', '#5ef2ff'],
  [5100, 'success', 'Done: 3 files updated', '#3ddc97'],
  [6900, 'error', 'Tool call failed, retrying', '#ff5d6c'],
  [8600, 'idle', 'Ready', '#5ef2ff'],
];

const scene: Scene = {
  width: 640,
  height: 400,
  duration: 9400,
  poster: 5600,
  play(stage) {
    stage.innerHTML = `
      <div class="stage-tag">&lt;ane-thinking-buddy&gt;</div>
      <div style="position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:6px;padding-bottom:8px">
        <ane-thinking-buddy size="272px" seed="11"></ane-thinking-buddy>
        <div class="status-pill" role="status"><i></i><span>Ready</span></div>
      </div>
      <div class="stage-brand">AI Native Effects</div>`;
    const buddy = stage.querySelector('ane-thinking-buddy')!;
    const pill = stage.querySelector<HTMLElement>('.status-pill')!;
    const text = pill.querySelector('span')!;
    return timeline(
      STEPS.map(([at, state, label, color]) => [
        at,
        () => {
          buddy.state = state;
          text.textContent = label;
          pill.style.setProperty('--dot', color);
        },
      ]),
    );
  },
};

export default scene;
