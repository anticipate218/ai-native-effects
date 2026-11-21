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
| Agent Flow Visualizer | The layered graph drawing approach of Sugiyama et al. (1981), as a general technique | n/a | Idea only. The simplified layout (ranks, barycentre ordering, parent-centred placement), stack layout, step icons, animations and API are original. |
| Liquid Glass Lens | The SDF displacement-map glass technique popularised by Apple's "Liquid Glass" and documented by Aave in [Building glass for the web](https://aave.com/design/building-glass-for-the-web); studied in [@samasante/liquid-glass](https://github.com/samasante/liquid-glass) (MIT) for the cross-browser `filter: url()` approach | n/a | Technique only; no code copied. The optics (SDF map with dome + outward rim, RGB split, alpha restore, lens-shape masking), the reading mode with citation highlights and the Web Component are original. Visual direction informed by public galleries (scrolltide.co, supahero.io, cta.gallery, navbar.gallery, footer.design); nothing taken from them. |
| Image Reveal FX | The forward diffusion process from DDPM (Ho et al., 2020), the cosine-style noise schedules of later work and latent diffusion's 8× VAE downsampling (Rombach et al., 2022), as general concepts | n/a | Concepts only; no code or imagery reused. The shader (coarse-to-fine prediction, per-step luminance noise, latent-block quantisation), the compare slider and the component are original; the default image is the project's own procedural scene. |
| Aurora Curtain | The structure of real auroras (curtains, rays, green-to-violet altitude colours) and the general idea of an animated aurora hero background seen across UI galleries such as React Bits (its own Aurora is a soft gradient; MIT + Commons Clause), aura.build and motionsites.ai | n/a | Idea and visual direction only; no code copied. The curtain, ray and fold shader, the horizon, the grain overlay and the component are original. |
| Decrypt Text | The common "decrypted / scrambled text" effect seen across UI galleries, including React Bits' DecryptedText and ScrambledText (MIT + Commons Clause) | n/a | Idea only; no code looked at or copied. Width-matched glyph pools, jitter-free cells, string morphing with opening/closing cells, CJK-aware pools and the lock flash are original. |
| Magnetic Dock | The magnifying application dock of desktop operating systems, and the "Dock" component in UI galleries such as React Bits (MIT + Commons Clause) | n/a | Idea only; no code looked at or copied. The spring model, cosine-squared falloff, lean, shared gliding label, squash-and-stretch launch, roving-focus toolbar, touch scrubbing, auto-fit and all icons and the desktop scene are original. |
| Holographic Tilt Card | Holographic trading-card and membership-card effects common in UI galleries and CSS demos, including React Bits' ProfileCard (MIT + Commons Clause) | n/a | Idea only; no code looked at or copied. The procedural canvas foil tiles (glitter, grooves, scales), the pattern-and-spotlight mask intersection, the sheen layer, the spring model, idle sway, focus tilt and the pass artwork (guilloche rosettes, emblem) are original. |
| Spotlight Grid | Spotlight / glow-border card grids seen on product sites (e.g. Linear, Vercel) and in UI galleries, including React Bits' SpotlightCard and MagicBento (MIT + Commons Clause) | n/a | Idea only; no code looked at or copied. The single shared light across all cards, per-card masked border rings driven by three host variables, light-revealed dot grid, distance-based light wave, spring inertia, idle drift and focus following are original. |

## Tooling

Development tooling (not shipped in the library): TypeScript, Vite, Vitest, happy-dom,
Playwright, axe-core (MPL-2.0, test-only) and ffmpeg (used locally to encode previews).
