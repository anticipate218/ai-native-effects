# 智能体流程可视化 · `<ane-agent-flow>`

<img src="../../../site/public/media/agent-flow.gif" width="640" alt="智能体流程可视化：一次智能体运行从规划、并行工具调用、汇合到最终回答，逐步生长成流程图">

智能体的执行过程通常以滚动日志呈现。`<ane-agent-flow>` 把同样的事件变成一张随运行生长的流程图：规划、并行工具调用、汇合、最终回答。运行中的步骤发光，流入它的连线上有数据流动；完成的步骤显示耗时；任何步骤都可以展开查看结果。窄屏下自动变为单列，连线走左侧的轨道。

**[打开交互调参页 →](https://anticipate218.github.io/ai-native-effects/effects/agent-flow.html)** · [English](../../effects/agent-flow.md)（主文档）

## 安装与使用

```html
<script type="module" src="https://anticipate218.github.io/ai-native-effects/cdn/effects/agent-flow.js"></script>

<ane-agent-flow label="智能体运行"></ane-agent-flow>
```

```bash
npm install github:anticipate218/ai-native-effects
```

```ts
import 'ai-native-effects/agent-flow';

const flow = document.querySelector('ane-agent-flow')!;
agent.on('step:start', (e) =>
  flow.addStep({ id: e.id, parents: e.parentIds, kind: 'search', title: e.title, detail: e.input, status: 'running' }),
);
agent.on('step:end', (e) => flow.updateStep(e.id, { status: e.error ? 'error' : 'done', output: e.result }));

// React / Vue：整体赋值 steps 数组会做差异更新，已有卡片保留并动画过渡
flow.steps = steps;
```

## 步骤字段

| 字段 | 取值 | 说明 |
| --- | --- | --- |
| `id` | 字符串 | 唯一标识 |
| `parents` | id 或 id 数组 | 指向本步骤的连线；多个父节点即汇合 |
| `kind` | `plan` `think` `search` `retrieve` `code` `tool` `answer` `step` | 图标与色调 |
| `title` / `detail` | 字符串 | 卡片文字（未展开时详情最多两行） |
| `output` | 字符串 | 展开后显示的结果 |
| `status` | `queued` `running` `done` `error` | 状态 |
| `duration` | 毫秒 | 完成后显示；不传则自动计时 |

方法：`addStep`、`updateStep`、`removeStep`、`reset`、`toggleStep(id, open?)`；属性：`steps`（可整体赋值）、`stacked`。

## 主要属性

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `layout` | `auto` | `auto` 在 560px 以下切换为单列；也可指定 `graph` / `stack` |
| `theme` | `dark` | 配色：`dark` / `light` |
| `accent` / `accent-2` | `#7c5cff` / `#5ef2ff` | 运行中的渐变色 |
| `size` | `460px` | 高度，宽度随容器 |
| `speed` / `motion` | `1` / `auto` | 速度倍率 / 低动效 |
| `announce` / `label` | 关 / `Agent run` | 状态播报 / 步骤列表的无障碍名称 |

事件：`ane-step-change`（`{ id, status, previous }`）、`ane-step-toggle`（`{ id, expanded }`）。CSS 变量 `--ane-flow-bg`、`--ane-flow-card`、`--ane-flow-text`、`--ane-flow-muted`、`--ane-flow-line` 等可覆盖主题。

## 无障碍与性能

- 步骤是有序列表，每张卡片是带 `aria-expanded` 的按钮，并附有隐藏的状态文字（如「done in 1.9 s」）；可选 `announce` 播报状态变化。
- 低动效：步骤直接就位，没有旋转描边和流动连线，状态仍可从图标和文字辨认。
- DOM 卡片 + 一层 SVG；只在步骤变化时重新布局，离屏时暂停。
