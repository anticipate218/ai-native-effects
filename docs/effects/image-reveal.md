# Image Reveal FX · `<ane-image-reveal>`

<img src="../../site/public/media/image-reveal.gif" width="640" alt="Image Reveal FX: noise resolves step by step into an aerial farmland image, then a divider compares the starting noise with the result">

Image models make people wait behind a spinner. `<ane-image-reveal>` shows the generation the way a diffusion sampler actually works: noise is removed step by step, the picture emerges coarse to fine out of latent blocks, and a step counter keeps pace with your backend. When it is done, an optional divider compares the starting noise with the result.

**[Open the playground →](https://anticipate218.github.io/ai-native-effects/effects/image-reveal.html)** · [中文文档](../zh-CN/effects/image-reveal.md)

## When to use it

- Text-to-image, image-to-image, inpainting and upscaling UIs, while the job runs.
- Galleries and demos where the "making of" is part of the story.
- Anywhere a placeholder would otherwise sit still for several seconds.

## Install

```html
<!-- CDN, no build step -->
<script type="module" src="https://anticipate218.github.io/ai-native-effects/cdn/effects/image-reveal.js"></script>
```

```bash
npm install github:anticipate218/ai-native-effects
```

```ts
import 'ai-native-effects/image-reveal';
```

## Usage

Autoplay over an image you already have (or omit `src` for a procedural aerial scene):

```html
<ane-image-reveal hud compare src="/generated/result.png"
  caption="A lighthouse in fog, golden hour" alt="Generated image: a lighthouse in fog"></ane-image-reveal>
```

Drive it from real sampler progress:

```ts
const reveal = document.querySelector('ane-image-reveal')!;
reveal.setAttribute('steps', String(job.steps));
job.on('preview', (url) => reveal.setAttribute('src', url)); // latest preview or final image
job.on('step', (i) => (reveal.progress = i / job.steps));
reveal.addEventListener('ane-reveal-complete', () => enableDownload());
```

The image must be same-origin or served with CORS headers for WebGL; otherwise the component falls back to a plain fade.

## API

| Attribute | Values | Default | Description |
| --- | --- | --- | --- |
| `src` | image URL | procedural scene | The image being generated. |
| `alt` | string | `Generated image` | Description of the image. |
| `progress` | `0`–`1` | none | Sampler progress; when absent the reveal autoplays. |
| `steps` | integer | `30` | Steps in the counter; the noise is re-sampled once per step. |
| `duration`, `loop` | ms, boolean | `4200`, off | Autoplay length and repeat. |
| `compare` | boolean | off | When done, a divider (drag, or arrow keys / Home / End) compares the starting noise with the result. |
| `hud`, `caption` | boolean, string | off | Status, seed and step counter; the prompt. |
| `seed` | integer | `7` | Noise seed (and procedural scene). |
| `latent` | CSS px | `8` | Latent block size (an 8× VAE downsampling). |
| `noise` | `color` `mono` | `color` | Noise style. |
| `accent` | any CSS color | `#b48cff` | Status dot and progress bar. |
| `ratio`, `size` | e.g. `16/9`, CSS length | image ratio, `100%` | Aspect ratio and width. |
| `speed`, `motion` | | `1`, `auto` | Time scale and reduced motion. |

| Member | Description |
| --- | --- |
| `progress` | Reflects to the attribute; `null` returns to autoplay. |
| `step`, `steps` | Current step and step count. |
| `split` | Compare divider position, `0`–`1`. |
| `replay()` | Restarts the autoplay (and the divider sweep). |
| `webgl` | `false` when the 2D fallback is used. |
| `ane-reveal-complete` | Fired once when the last step is reached (`{ steps }`). |
| `::part(compare)`, `--ane-size`, `--ane-reveal-radius` | Styling hooks. |

## How it works

Each frame follows the forward diffusion formula `x_t = √ᾱ · x̂₀ + √(1 − ᾱ) · ε`:

- **x̂₀ (the model's guess)** is sampled from a blurrier mip level early on, contrast-stretched so bold colour regions read through the noise, and desaturated. It sharpens and regains colour as the steps advance.
- **ε (noise)** is mostly luminance with a little chroma, re-seeded on every sampler step (the characteristic flicker), with a short cross-fade between steps.
- **Latent blocks**: early on, both are quantised to 8 px cells; the blocks dissolve over the last steps like a VAE decode.
- When the counter reaches the last step, a brief flash marks completion and (with `compare`) the noise slides back in from the left to the middle, ready to drag.

## Accessibility

- The canvas is an image (`role="img"`) labelled by `alt`. A visually hidden progressbar reports "Step 12 of 30", then "Complete".
- The compare divider is a focusable `role="slider"` with arrow, Shift+arrow, Page Up/Down, Home and End support and a readable `aria-valuetext`.
- Reduced motion: no per-step flicker; autoplay shows the result at once.

## Performance

- One WebGL2 full-screen draw per frame while denoising, nothing while idle; the procedural scene is baked once per seed.
- The loop pauses off-screen and the WebGL context is released when the element is removed.
