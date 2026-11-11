# Credits and third-party notices

## Policy

- Every effect in this repository is an original implementation. We do not copy code,
  assets or designs from other repositories, commercial effect packs or paid templates.
- Looking at prior art for ideas is fine. When an effect is *inspired by* a specific public
  work (an article, a demo, an open-source component), credit it below with a link and its
  license, and describe what was borrowed (an idea, a technique) versus what is original.
- Code under a license that requires attribution may only be adapted when its license is
  compatible with MIT, and the notice must be kept here and in the affected source file.
- Fonts, images and data (e.g. map outlines) need a license that allows redistribution.

## Notices

| Effect | Inspiration / third-party material | License | Notes |
| --- | --- | --- | --- |
| AI Thinking Buddy | none (original character and animation) | n/a | Built from scratch for this project. |
| Orbit Loading Screen | Integer hash "lowbias32" by Chris Wellons (used for the procedural noise) | Public domain (Unlicense) | Algorithm reimplemented in GLSL in `planet-gl.ts`. Everything else is original: no map data or images. The planet is generated from a seed (domain-warped value-noise fBm on the sphere); the tile-acquisition reveal, swaths, lighting and layout were designed for this project. |
| Token Stream Text | The general "fade-in streaming text" pattern seen in many chat products | n/a | Idea only. The safe streaming tokenizer, adaptive pacing, ink animation, caret and glow are original. Uses the platform `Intl.Segmenter`. |
| Satellite Scan Reveal | How push-broom sensors (e.g. Sentinel-2 MSI, Landsat OLI) acquire images line by line; band misregistration and detector striping are real artefacts of such sensors | n/a | Concept only; no imagery or code reused. The procedural farmland scene, class mask, scan and inference shaders are original; the integer hash is "lowbias32" by Chris Wellons (public domain). Sensor names in the demo HUD are illustrative labels. |

## Tooling

Development tooling (not shipped in the library): TypeScript, Vite, Vitest, happy-dom,
Playwright, axe-core (MPL-2.0, test-only) and ffmpeg (used locally to encode previews).
