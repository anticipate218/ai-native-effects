<div align="center">

<a href="https://anticipate218.github.io/ai-native-effects/"><img src="site/public/media/thinking-buddy.gif" width="480" alt="AI 思考小伙伴：在思考、等待、成功和失败状态之间切换的小机器人"></a>

# AI Native Effects

**让 AI 看不见的工作被看见。**

一组带动画、可访问的 Web Components，把 AI 系统的执行状态（思考、规划、工具调用、加载、失败）变成清晰又生动的界面。

[**在线演示**](https://anticipate218.github.io/ai-native-effects/) · [交互调参](https://anticipate218.github.io/ai-native-effects/effects/thinking-buddy.html) · [组件文档](docs/zh-CN/effects/thinking-buddy.md) · [English](README.md)

</div>

> 英文文档是主入口，中文文档是补充。API 细节以 [README.md](README.md) 与 [docs/effects](docs/effects) 为准。

## 为什么要做「AI 原生动效」？

转圈的加载图标只能表达「有事在发生」。AI 产品需要表达的是**发生了什么**：模型在思考？在等工具返回？在等用户确认？已经完成，还是卡住了？这些状态是每个聊天助手和智能体的「心跳」，但大多数界面仍然只用同一个灰色 loader。

AI Native Effects 专门为这些时刻提供小而可用于生产的组件。每个组件都是标准的 Custom Element，可以直接用于 React、Vue、Svelte、Angular 或纯 HTML，并且都满足同一套无障碍、性能和移动端标准。

## 组件

<!-- effects:start -->
<table>
  <tr>
    <td width="50%" valign="top">
      <a href="https://anticipate218.github.io/ai-native-effects/effects/thinking-buddy.html"><img src="site/public/media/thinking-buddy.gif" alt="AI 思考小伙伴" width="100%"></a>
      <br><b><a href="https://anticipate218.github.io/ai-native-effects/effects/thinking-buddy.html">AI 思考小伙伴</a></b> · <code>&lt;ane-thinking-buddy&gt;</code> · <sub>AI Native</sub>
      <br><sub>一个会思考、等待、成功和失败的小机器人，用肢体语言把智能体的执行状态变得一眼可读。</sub>
      <br><sub><a href="https://anticipate218.github.io/ai-native-effects/effects/thinking-buddy.html">在线演示</a> · <a href="docs/zh-CN/effects/thinking-buddy.md">文档</a> · <a href="src/effects/thinking-buddy">源码</a></sub>
    </td>
    <td width="50%" valign="top">
      <a href="https://anticipate218.github.io/ai-native-effects/effects/orbit-loading-screen.html"><img src="site/public/media/orbit-loading-screen.gif" alt="轨道加载界面" width="100%"></a>
      <br><b><a href="https://anticipate218.github.io/ai-native-effects/effects/orbit-loading-screen.html">轨道加载界面</a></b> · <code>&lt;ane-orbit-loading-screen&gt;</code> · <sub>AI Native</sub>
      <br><sub>面向数据密集型 AI 与遥感应用的完整加载界面：WebGL 星球随数据到达逐块变清晰，旁边的排版面板展示进度、步骤与实时信息。</sub>
      <br><sub><a href="https://anticipate218.github.io/ai-native-effects/effects/orbit-loading-screen.html">在线演示</a> · <a href="docs/zh-CN/effects/orbit-loading-screen.md">文档</a> · <a href="src/effects/orbit-loading-screen">源码</a></sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="https://anticipate218.github.io/ai-native-effects/effects/token-stream.html"><img src="site/public/media/token-stream.gif" alt="流式文本" width="100%"></a>
      <br><b><a href="https://anticipate218.github.io/ai-native-effects/effects/token-stream.html">流式文本</a></b> · <code>&lt;ane-token-stream&gt;</code> · <sub>AI Native</sub>
      <br><sub>让流式 LLM 回答平滑地「落墨」：突发的分块被自适应节奏释放，每个词从模糊中浮起、由强调色褪为正文色，前方有发光的光标。</sub>
      <br><sub><a href="https://anticipate218.github.io/ai-native-effects/effects/token-stream.html">在线演示</a> · <a href="docs/zh-CN/effects/token-stream.md">文档</a> · <a href="src/effects/token-stream">源码</a></sub>
    </td>
    <td width="50%" valign="top">
      <a href="https://anticipate218.github.io/ai-native-effects/effects/scan-reveal.html"><img src="site/public/media/scan-reveal.gif" alt="卫星扫描揭示" width="100%"></a>
      <br><b><a href="https://anticipate218.github.io/ai-native-effects/effects/scan-reveal.html">卫星扫描揭示</a></b> · <code>&lt;ane-scan-reveal&gt;</code> · <sub>Remote sensing × AI</sub>
      <br><sub>推扫式卫星扫描线揭示影像，随后虚线推理扫描把地物分类掩膜叠加上去；可使用自己的影像与掩膜，也可使用程序化生成的场景。</sub>
      <br><sub><a href="https://anticipate218.github.io/ai-native-effects/effects/scan-reveal.html">在线演示</a> · <a href="docs/zh-CN/effects/scan-reveal.md">文档</a> · <a href="src/effects/scan-reveal">源码</a></sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="https://anticipate218.github.io/ai-native-effects/effects/agent-flow.html"><img src="site/public/media/agent-flow.gif" alt="智能体流程可视化" width="100%"></a>
      <br><b><a href="https://anticipate218.github.io/ai-native-effects/effects/agent-flow.html">智能体流程可视化</a></b> · <code>&lt;ane-agent-flow&gt;</code> · <sub>AI Native</sub>
      <br><sub>把智能体的执行过程实时画成一张会生长的流程图：规划、并行工具调用、汇合与回答随事件出现，运行中的连线流动，完成后显示耗时，步骤可展开查看结果。</sub>
      <br><sub><a href="https://anticipate218.github.io/ai-native-effects/effects/agent-flow.html">在线演示</a> · <a href="docs/zh-CN/effects/agent-flow.md">文档</a> · <a href="src/effects/agent-flow">源码</a></sub>
    </td>
    <td width="50%" valign="top">
      <a href="https://anticipate218.github.io/ai-native-effects/effects/glass-lens.html"><img src="site/public/media/glass-lens.gif" alt="液态玻璃透镜" width="100%"></a>
      <br><b><a href="https://anticipate218.github.io/ai-native-effects/effects/glass-lens.html">液态玻璃透镜</a></b> · <code>&lt;ane-glass-lens&gt;</code> · <sub>AI Native</sub>
      <br><sub>折射所包裹的实时内容的液态玻璃透镜；阅读模式下展示 AI 读文档：沿文字逐行滑过，在引用段落处停留并留下高亮。</sub>
      <br><sub><a href="https://anticipate218.github.io/ai-native-effects/effects/glass-lens.html">在线演示</a> · <a href="docs/zh-CN/effects/glass-lens.md">文档</a> · <a href="src/effects/glass-lens">源码</a></sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="https://anticipate218.github.io/ai-native-effects/effects/image-reveal.html"><img src="site/public/media/image-reveal.gif" alt="图像生成揭示" width="100%"></a>
      <br><b><a href="https://anticipate218.github.io/ai-native-effects/effects/image-reveal.html">图像生成揭示</a></b> · <code>&lt;ane-image-reveal&gt;</code> · <sub>AI Native</sub>
      <br><sub>像真实扩散采样器一样展示图像生成：噪声逐步去除、由粗到细、从潜空间色块中浮现，带步数计数与生成前后对比滑块。</sub>
      <br><sub><a href="https://anticipate218.github.io/ai-native-effects/effects/image-reveal.html">在线演示</a> · <a href="docs/zh-CN/effects/image-reveal.md">文档</a> · <a href="src/effects/image-reveal">源码</a></sub>
    </td>
    <td width="50%" valign="top">
      <a href="https://anticipate218.github.io/ai-native-effects/effects/aurora.html"><img src="site/public/media/aurora.gif" alt="极光帷幕" width="100%"></a>
      <br><b><a href="https://anticipate218.github.io/ai-native-effects/effects/aurora.html">极光帷幕</a></b> · <code>&lt;ane-aurora&gt;</code> · <sub>UI FX</sub>
      <br><sub>写实的北极光首屏背景：带上升光柱的极光帷幕、随风折叠并向指针弯曲、星空闪烁、山脊地平线；首屏内容保持普通 HTML。</sub>
      <br><sub><a href="https://anticipate218.github.io/ai-native-effects/effects/aurora.html">在线演示</a> · <a href="docs/zh-CN/effects/aurora.md">文档</a> · <a href="src/effects/aurora">源码</a></sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="https://anticipate218.github.io/ai-native-effects/effects/decrypt-text.html"><img src="site/public/media/decrypt-text.gif" alt="解码文字" width="100%"></a>
      <br><b><a href="https://anticipate218.github.io/ai-native-effects/effects/decrypt-text.html">解码文字</a></b> · <code>&lt;ane-decrypt-text&gt;</code> · <sub>UI FX</sub>
      <br><sub>从宽度匹配的乱码中自我解码的标题：整行零抖动，字符串之间平滑变形，锁定时闪光，中日韩字符自动用对应字形乱码。</sub>
      <br><sub><a href="https://anticipate218.github.io/ai-native-effects/effects/decrypt-text.html">在线演示</a> · <a href="docs/zh-CN/effects/decrypt-text.md">文档</a> · <a href="src/effects/decrypt-text">源码</a></sub>
    </td>
    <td width="50%" valign="top">
      <a href="https://anticipate218.github.io/ai-native-effects/effects/magnet-dock.html"><img src="site/public/media/magnet-dock.gif" alt="磁吸 Dock 栏" width="100%"></a>
      <br><b><a href="https://anticipate218.github.io/ai-native-effects/effects/magnet-dock.html">磁吸 Dock 栏</a></b> · <code>&lt;ane-magnet-dock&gt;</code> · <sub>UI FX</sub>
      <br><sub>适用于任意按钮或链接的弹簧物理 Dock 栏：图标在指针下放大并向指针倾靠，一个共享标签在图标间滑动，启动时带挤压拉伸的弹跳，键盘焦点和触摸滑动同样会放大。</sub>
      <br><sub><a href="https://anticipate218.github.io/ai-native-effects/effects/magnet-dock.html">在线演示</a> · <a href="docs/zh-CN/effects/magnet-dock.md">文档</a> · <a href="src/effects/magnet-dock">源码</a></sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="https://anticipate218.github.io/ai-native-effects/effects/tilt-holo-card.html"><img src="site/public/media/tilt-holo-card.gif" alt="全息倾斜卡片" width="100%"></a>
      <br><b><a href="https://anticipate218.github.io/ai-native-effects/effects/tilt-holo-card.html">全息倾斜卡片</a></b> · <code>&lt;ane-tilt-holo-card&gt;</code> · <sub>UI FX</sub>
      <br><sub>随指针弹簧倾斜的卡片：程序化全息箔纹只在光照处显出彩虹，叠加虹彩光带、跟随的高光和流光描边。卡片内容可放任意 HTML；空闲时轻微摆动，手机上可选陀螺仪。</sub>
      <br><sub><a href="https://anticipate218.github.io/ai-native-effects/effects/tilt-holo-card.html">在线演示</a> · <a href="docs/zh-CN/effects/tilt-holo-card.md">文档</a> · <a href="src/effects/tilt-holo-card">源码</a></sub>
    </td>
    <td width="50%" valign="top">
      <a href="https://anticipate218.github.io/ai-native-effects/effects/spotlight-grid.html"><img src="site/public/media/spotlight-grid.gif" alt="聚光卡片墙" width="100%"></a>
      <br><b><a href="https://anticipate218.github.io/ai-native-effects/effects/spotlight-grid.html">聚光卡片墙</a></b> · <code>&lt;ane-spotlight-grid&gt;</code> · <sub>UI FX</sub>
      <br><sub>整面卡片墙共享一束光：带惯性跟随指针，越过间隙照亮相邻卡片的边框，点亮背景点阵，点击时发出一圈光波扫过整面墙。支持空闲游走、键盘聚焦和触屏。</sub>
      <br><sub><a href="https://anticipate218.github.io/ai-native-effects/effects/spotlight-grid.html">在线演示</a> · <a href="docs/zh-CN/effects/spotlight-grid.md">文档</a> · <a href="src/effects/spotlight-grid">源码</a></sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="https://anticipate218.github.io/ai-native-effects/effects/ascii-field.html"><img src="site/public/media/ascii-field.gif" alt="ASCII 字符场" width="100%"></a>
      <br><b><a href="https://anticipate218.github.io/ai-native-effects/effects/ascii-field.html">ASCII 字符场</a></b> · <code>&lt;ane-ascii-field&gt;</code> · <sub>UI FX</sub>
      <br><sub>由片元着色器渲染的流动 ASCII 字符场：亮度决定字形，字符可以汇聚成文字或图片，指针下变亮，点击发出冲击波。</sub>
      <br><sub><a href="https://anticipate218.github.io/ai-native-effects/effects/ascii-field.html">在线演示</a> · <a href="docs/zh-CN/effects/ascii-field.md">文档</a> · <a href="src/effects/ascii-field">源码</a></sub>
    </td>
    <td width="50%"></td>
  </tr>
</table>
<!-- effects:end -->

## 快速开始

### 通过 CDN（无需构建）

```html
<script type="module" src="https://anticipate218.github.io/ai-native-effects/cdn/effects/thinking-buddy.js"></script>

<ane-thinking-buddy state="thinking"></ane-thinking-buddy>
```

### 通过 npm

直接从 GitHub 安装（安装时会自动构建）：

```bash
npm install github:anticipate218/ai-native-effects
```

```ts
import 'ai-native-effects/thinking-buddy'; // 注册 <ane-thinking-buddy>

const buddy = document.querySelector('ane-thinking-buddy')!;
buddy.labels = { thinking: '正在思考', success: '已完成' }; // 中文无障碍标签
buddy.state = 'thinking';
const result = await runAgent();
buddy.state = result.ok ? 'success' : 'error';
```

React、Vue 等框架的用法见 [英文 README](README.md#in-your-framework) 与 [组件文档](docs/zh-CN/effects/thinking-buddy.md)。

## 设计原则

- **框架无关**：标准 Custom Elements，支持属性、JS 属性与 DOM 事件；SSR 环境下导入也安全。
- **无障碍**：有意义的 `role` / `aria-label`，可选的状态播报（live region），遵循 `prefers-reduced-motion` 的低动效版本。
- **轻量高效**：零运行时依赖；所有组件共享一个 `requestAnimationFrame` 循环，离开视口自动暂停。
- **可调节**：颜色、尺寸、速度均可通过属性或 CSS 变量（`--ane-*`）配置。
- **可复现**：随机数可设种子，预览录制使用虚拟时钟，逐帧可复现。

每个组件发布前都要通过同一套质量门禁：单元测试、axe-core WCAG 2.2 AA 检查、每帧 JS 耗时预算、320px 移动端布局、低动效模式与离屏暂停。

## 开发

```bash
npm install
npm run dev        # 启动展示站点
npm run check      # 类型检查 + 单元测试 + 构建 + 端到端质量门禁
npm run capture -- <id>   # 重新录制 GIF / MP4 / 封面（需要 ffmpeg；--all 重录全部）
npm run new -- my-effect --title "My Effect"   # 生成新组件脚手架
npm run sync       # 根据 effects.json 更新 README 组件表格
```

## 路线图

- [x] **AI 思考小伙伴**：空闲 / 思考 / 等待 / 成功 / 失败
- [x] **智能体流程可视化**：实时呈现规划、工具调用与结果，步骤可展开
- [x] **液态玻璃透镜**：对实时文字的真实玻璃折射，展示 AI 阅读与引用
- [x] **极光帷幕**（UI FX）：写实的北极光首屏背景
- [x] **解码文字**（UI FX）：零抖动的乱码解码文字，字符串之间平滑变形
- [x] **轨道加载界面**：完整的 WebGL 加载界面，星球随下载逐块变清晰
- [x] **图像生成揭示**：扩散式逐步去噪，并带生成前后对比滑块
- [x] **流式文本**：自适应节奏的流式文字，模糊到清晰的落墨效果与发光光标
- [x] **卫星扫描揭示**：推扫式获取扫描 + 叠加地物分类掩膜的推理扫描

欢迎在 [Issues](https://github.com/anticipate218/ai-native-effects/issues) 提出想法或投票。

## 贡献与许可

贡献前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。只接受原创实现；参考了第三方作品时须在 [docs/CREDITS.md](docs/CREDITS.md) 中注明出处与许可证。

[MIT](LICENSE) © 2026 anticipate218
