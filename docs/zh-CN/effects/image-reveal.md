# 图像生成揭示 · `<ane-image-reveal>`

<img src="../../../site/public/media/image-reveal.gif" width="640" alt="图像生成揭示：噪声逐步变为农田航拍图，随后分隔线对比初始噪声与结果">

图像模型生成时，用户通常只能对着转圈等待。`<ane-image-reveal>` 按扩散采样器的真实工作方式展示生成过程：噪声逐步去除，画面从潜空间色块中由粗到细地浮现，步数计数与后端同步。完成后，可选的分隔线可以对比初始噪声与最终结果。

**[打开交互调参页 →](https://anticipate218.github.io/ai-native-effects/effects/image-reveal.html)** · [English](../../effects/image-reveal.md)（主文档）

## 安装与使用

```html
<script type="module" src="https://anticipate218.github.io/ai-native-effects/cdn/effects/image-reveal.js"></script>

<!-- 自动播放；不设置 src 时使用程序化生成的航拍场景 -->
<ane-image-reveal hud compare src="/generated/result.png"
  caption="雾中的灯塔，黄昏" alt="生成的图片：雾中的灯塔"></ane-image-reveal>
```

```ts
import 'ai-native-effects/image-reveal';

const reveal = document.querySelector('ane-image-reveal')!;
reveal.setAttribute('steps', String(job.steps));
job.on('step', (i) => (reveal.progress = i / job.steps)); // 由后端进度驱动
reveal.addEventListener('ane-reveal-complete', () => enableDownload());
```

图片需同源或带 CORS 头，否则 WebGL 无法读取，组件会退回为普通淡入。

## 主要参数

| 属性 | 默认值 | 说明 |
| --- | --- | --- |
| `src` / `alt` | 程序化场景 / `Generated image` | 生成中的图片 / 图片描述 |
| `progress` | 无 | 采样进度 `0`–`1`；不设置则自动播放 |
| `steps` | `30` | 采样步数，每步重新采样噪声 |
| `duration` / `loop` | `4200` / 关 | 自动播放时长 / 循环 |
| `compare` | 关 | 完成后显示对比分隔线（拖拽或方向键、Home、End） |
| `hud` / `caption` | 关 | 状态、种子与步数计数 / 提示词 |
| `seed` | `7` | 噪声种子 |
| `latent` | `8` | 潜空间色块大小（CSS 像素） |
| `noise` | `color` | 噪声风格：`color` / `mono` |
| `accent`、`ratio`、`size`、`speed`、`motion` | | 强调色、宽高比、宽度、速度、低动效 |

属性：`progress`、`step`、`steps`、`split`（对比分隔位置）；方法：`replay()`；事件：`ane-reveal-complete`。

## 原理、无障碍与性能

- 每帧按扩散前向公式 `x_t = √ᾱ · x̂₀ + √(1 − ᾱ) · ε` 混合：x̂₀ 早期取自模糊的 mip 层，经过对比度拉伸并去饱和，随步数变清晰、恢复色彩；ε 以亮度噪声为主，每个采样步重新采样，步间短暂交叉淡化；早期两者都按 8 像素色块量化，最后几步色块消失，像 VAE 解码完成。
- 画布为 `role="img"`；隐藏的进度条播报「Step 12 of 30」；对比分隔线是可聚焦的 `role="slider"`。低动效模式下没有逐步闪烁，自动播放直接显示结果。
- 去噪时每帧一次 WebGL 绘制，静止时不绘制；离屏时暂停，移除元素时释放 WebGL 上下文。
