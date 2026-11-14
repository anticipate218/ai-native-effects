# Agent Flow Visualizer · `<ane-agent-flow>`

<img src="../../site/public/media/agent-flow.gif" width="640" alt="Agent Flow Visualizer: an agent run grows into a flow graph, from a plan through parallel tool calls and a join to the final answer">

Agent runs are usually shown as a scrolling log. `<ane-agent-flow>` turns the same events into a flow graph that grows as the agent works: the plan, parallel tool calls, joins and the final answer. Running steps glow and their incoming edges carry data, finished steps show how long they took, and any step expands to show its result. On narrow screens it becomes a single column with a quiet rail.

**[Open the playground →](https://anticipate218.github.io/ai-native-effects/effects/agent-flow.html)** · [中文文档](../zh-CN/effects/agent-flow.md)

## When to use it

- Agent and copilot UIs that call tools, search, retrieve or run code, and want users to see what is happening.
- Debug and observability panels for agent frameworks.
- Replays of past runs (assign the whole `steps` array).

## Install

```html
<!-- CDN, no build step -->
<script type="module" src="https://anticipate218.github.io/ai-native-effects/cdn/effects/agent-flow.js"></script>
```

```bash
npm install github:anticipate218/ai-native-effects
```

```ts
import 'ai-native-effects/agent-flow';
```

## Usage

```html
<ane-agent-flow label="Agent run"></ane-agent-flow>
```

Feed it your agent's events:

```ts
const flow = document.querySelector('ane-agent-flow')!;

agent.on('step:start', (e) =>
  flow.addStep({ id: e.id, parents: e.parentIds, kind: 'search', title: e.title, detail: e.input, status: 'running' }),
);
agent.on('step:end', (e) =>
  flow.updateStep(e.id, { status: e.error ? 'error' : 'done', output: e.result }),
);
flow.addEventListener('ane-step-change', (e) => console.log(e.detail)); // { id, status, previous }
```

Or bind state from React or Vue: assigning `steps` diffs the array, so existing cards stay and animate.

```tsx
useEffect(() => {
  if (ref.current) ref.current.steps = steps;
}, [steps]);
```

Durations are measured automatically between `running` and `done`; pass `duration` (ms) to show your own.

## API

### Step fields

| Field | Values | Description |
| --- | --- | --- |
| `id` | string | Unique id. |
| `parents` | id or array | Edges into this step; several parents make a join. |
| `kind` | `plan` `think` `search` `retrieve` `code` `tool` `answer` `step` | Icon and tint. |
| `title`, `detail` | string | Card text (detail is clamped to two lines until expanded). |
| `output` | string | Longer result, shown when the step is expanded. |
| `status` | `queued` `running` `done` `error` | Card and edge styling. |
| `duration` | ms | Shown when done; measured automatically if omitted. |

### Methods and properties

| Member | Description |
| --- | --- |
| `addStep(step)` | Adds a step; returns `false` for a duplicate id. |
| `updateStep(id, patch)` | Updates any field, including `parents` and `kind`. |
| `removeStep(id)`, `reset()` | Removes one step (and its edges), or everything. |
| `toggleStep(id, open?)` | Expands or collapses a step. |
| `steps` | Snapshot; assigning an array diffs it. |
| `stacked` | `true` while the single-column layout is used. |

### Attributes

| Attribute | Values | Default | Description |
| --- | --- | --- | --- |
| `layout` | `auto` `graph` `stack` | `auto` | `auto` switches to a single column below 560px. |
| `theme` | `dark` `light` | `dark` | Colour scheme. |
| `accent`, `accent-2` | any CSS color | `#7c5cff`, `#5ef2ff` | Running gradient. |
| `size` | CSS length | `460px` | Height; the width follows the container. |
| `speed` | `0`–`5` | `1` | Animation time scale. |
| `motion` | `auto` `reduce` `full` | `auto` | Reduced motion. |
| `announce` | boolean | off | Announces status changes in a polite live region. |
| `label` | string | `Agent run` | Accessible name of the step list. |

### Events and CSS

| Name | Description |
| --- | --- |
| `ane-step-change` | `{ id, status, previous }` when a step is added running or changes status. |
| `ane-step-toggle` | `{ id, expanded }` when a step is expanded or collapsed. |
| `--ane-flow-bg`, `--ane-flow-card`, `--ane-flow-text`, `--ane-flow-muted`, `--ane-flow-line`, `--ane-flow-dot`, `--ane-flow-border`, `--ane-flow-shadow` | Theme overrides (they win over `theme`). |
| `--ane-flow-node-width`, `--ane-flow-radius` | Card width and corner radius. |

## How it works

- **Layout.** A layered DAG: a step's rank is one below its deepest parent; ranks are ordered by parent barycentre to avoid crossings, and each step is pulled under its parents with overlaps resolved. In the stack layout, steps are listed in arrival order, indented by rank, and only the nearest parent gets a rail.
- **Motion.** New steps rise into their slot; existing ones glide when the layout changes. Edges draw in, running edges carry a dotted flow, and running cards have a rotating gradient outline. The camera follows running steps and zooms out to an overview when the run ends.

## Accessibility

- Steps are an ordered list; each card is a button with `aria-expanded` and hidden status text ("running", "done in 1.9 s", "failed").
- Optional `announce` reports status changes politely.
- Reduced motion places steps instantly, with no rotating outlines or flowing edges; status stays readable from icons and text.

## Performance

- DOM cards and one SVG layer. Layout runs only when steps change; each frame moves cards with transforms and updates edge paths.
- The loop pauses off-screen.
