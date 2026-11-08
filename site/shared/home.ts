import './debug';
import '../../src/index';
import type { BuddyState, ThinkingBuddyElement } from '../../src/effects/thinking-buddy';
import manifest from '../../effects.json';
import { initCopyButtons } from './copy';
import { REPO, type EffectMeta } from './meta';

const effects = (manifest.effects as EffectMeta[]).filter((effect) => effect.status === 'stable');

const grid = document.getElementById('effect-grid')!;
grid.innerHTML = effects
  .map(
    (effect) => `
    <article class="card">
      <div class="preview">${effect.preview ?? ''}</div>
      <div class="body">
        <div class="tags"><span class="tag series">${effect.series}</span>${effect.tech.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
        <h3><a href="./effects/${effect.id}.html">${effect.title}</a></h3>
        <p>${effect.summary}</p>
        <div class="links">
          <a href="./effects/${effect.id}.html">Playground</a>
          <a href="${REPO}/blob/main/docs/effects/${effect.id}.md">Docs</a>
          <a href="${REPO}/tree/main/src/effects/${effect.id}">Source</a>
        </div>
      </div>
    </article>`,
  )
  .join('');

// Card previews cycle through states so the grid shows the whole range.
const cardCycle: BuddyState[] = ['thinking', 'waiting', 'success', 'thinking', 'error', 'idle'];
let cardStep = 0;
let paused = false;
window.setInterval(() => {
  if (paused) return;
  cardStep = (cardStep + 1) % cardCycle.length;
  grid.querySelectorAll('ane-thinking-buddy').forEach((el) => (el.state = cardCycle[cardStep]!));
}, 2600);

// Hero: a scripted agent run. One control pauses every animation on the page (WCAG 2.2.2).
const buddy = document.getElementById('hero-buddy') as ThinkingBuddyElement;
const status = document.getElementById('hero-status')!;
const pill = status.parentElement!;
const toggle = document.getElementById('hero-toggle')!;
const script: Array<[BuddyState, string, string, number]> = [
  ['idle', 'Ready', '#5ef2ff', 1400],
  ['thinking', 'Planning the change…', '#5ef2ff', 2400],
  ['waiting', 'Waiting for tool result…', '#ffb547', 1600],
  ['thinking', 'Reading 4 files…', '#5ef2ff', 1600],
  ['success', 'Done: tests pass', '#3ddc97', 2600],
  ['thinking', 'Deploying…', '#5ef2ff', 1800],
  ['error', 'Deploy failed, retrying', '#ff5d6c', 2400],
];
let index = 0;
let timer = 0;

const step = (): void => {
  const [state, label, color, hold] = script[index]!;
  buddy.state = state;
  status.textContent = label;
  pill.style.setProperty('--dot', color);
  index = (index + 1) % script.length;
  timer = window.setTimeout(step, hold);
};
step();

toggle.addEventListener('click', () => {
  paused = !paused;
  toggle.setAttribute('aria-pressed', String(paused));
  toggle.textContent = paused ? 'Play animations' : 'Pause animations';
  document.querySelectorAll('ane-thinking-buddy').forEach((el) => el.setAttribute('speed', paused ? '0' : '1'));
  if (paused) window.clearTimeout(timer);
  else step();
});

initCopyButtons();
