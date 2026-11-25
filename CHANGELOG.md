# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.18.0] - 2026-11-25

### Added

- `<ane-hold-button>` (Hold to Confirm, UI FX): press and hold to confirm irreversible actions. A liquid
  fill with a rippling front advances while held (squish, progress-tied glow, a shake that builds after
  60%), drains back on early release and completes with a drawn check mark, a particle burst, an
  optional haptic tap and an auto reset. Mouse, touch and keyboard (hold Space / Enter); events
  `ane-hold-start`, `ane-hold-cancel`, `ane-hold-complete`; `progress`, `confirmed`, `reset()`.
  `duration`, `color`, `accent`, `done-text`, `reset-after`, `haptics`, `disabled`. Reduced motion keeps
  the fill but drops the shake, pop and burst.

## [0.17.0] - 2026-11-24

### Added

- `<ane-glass-tabs>` (Glass Tabs, UI FX): a tab bar whose selected tab sits under a liquid-glass lens.
  The lens refracts and magnifies the tabs beneath it through an SVG displacement filter (the
  glass-lens optics, with chromatic dispersion), slides on a spring, stretches with its speed like a
  drop and can be dragged to scrub between tabs. ARIA tablist with roving tab index, arrow keys,
  Home/End and `ane-tab-change`. `selected`, `accent`, `tint`, `strength`, `curvature`,
  `dispersion`, `stretch`. Reduced motion jumps without sliding or stretching.

## [0.16.0] - 2026-11-23

### Added

- `<ane-dither-gradient>` (Dither Gradient, UI FX): a flowing multi-stop gradient, or any image (`src`),
  rendered by a WebGL2 shader through a limited palette with Bayer 8×8 / 4×4 or noise dithering.
  Palette presets `sunset`, `paper`, `gameboy`, `mono`, `cga`, `ocean` or any colour list (`auto` = the
  gradient stops); `pixel`, `dither`, `spread`, `scale`; a lens under the pointer shows the smooth,
  undithered colours (`lens`, `lens-size`). Slotted content layers on top; CSS gradient fallback without
  WebGL2; adaptive resolution. Reduced motion stops the flow. Its demo scene adds a light, printed theme.

## [0.15.0] - 2026-11-22

### Added

- `<ane-ascii-field>` (ASCII Field, UI FX): a flowing field of ASCII characters rendered by a WebGL2
  fragment shader. Brightness of a domain-warped noise field picks the glyph; a glyph atlas redrawn at
  exactly the cell size keeps characters crisp. The characters gather into a word (`text`, `reveal`,
  `text-y`, `morph()`, `dissolve()`) or an image (`src`), brighten under the pointer and ripple with
  click shock waves (`shockwave()`). Slotted content layers on top. `charset` presets, `cell`, `color`,
  `accent`, `contrast`, `scale`, `interactive`, `quality` (adaptive; software rasterisers start at
  half resolution). Reduced motion freezes the field.

## [0.14.0] - 2026-11-21

### Added

- `<ane-spotlight-grid>` (Spotlight Grid, UI FX): one shared light for a whole wall of cards. It
  follows the pointer on a spring, lights card borders by distance (neighbours too, across the gaps),
  reveals a dot grid behind the cards, adds a surface sheen and sends a light wave through the wall
  on click (`pulse()`). Idle drift, keyboard focus moves the light, touch drag. `color`, `accent`,
  `radius`, `intensity`, `border`, `sheen`, `dots`, `dot-gap`, `idle`. Reduced motion: no inertia,
  drift or waves.

### Changed

- `scripts/capture.mjs`: scenes can declare their own encoder settings (`capture: { gifFps, gifColors,
  gifDither, crf }`; command-line flags still win), so `npm run capture -- <id>` reproduces committed
  media. Running it without an id now prints usage instead of re-capturing every effect; use `--all`.

## [0.13.0] - 2026-11-20

### Added

- `<ane-tilt-holo-card>` (Holographic Tilt Card, UI FX): a card that tilts towards the pointer on
  springs with a procedural holographic foil (`sparkle`, `lines`, `scales` or `none`) that shows
  a rainbow only where the pattern and the pointer's light overlap, a broad iridescent sheen, a
  glare, a shimmering rim and a counter-moving shadow. Any HTML inside; idle sway; optional
  gyroscope (`gyro`); keyboard focus inside tilts it. `tilt`, `foil`, `foil-strength`, `sheen`,
  `glare`, `blend`, `hue`, `radius`, `ratio`, `perspective`, `idle`, `seed`; `tiltAngles`.
  Reduced motion keeps the card flat with a static sheen.

### Changed

- `springStep` moved to `core/math` and is shared by effects (still exported from `magnet-dock`).

## [0.12.0] - 2026-11-19

### Added

- `<ane-magnet-dock>` (Magnetic Dock, UI FX): a dock for any buttons or links. Icons swell under
  the pointer on springs with a slight overshoot (cosine-squared falloff), neighbours lean in, one
  shared label glides between items and resizes to the new text, and launches bounce with squash
  and stretch. A real toolbar: roving tab index, arrow keys / Home / End, focus magnifies like hover;
  touch scrubbing; activity dots from `data-active`; `fit="auto"` shrinks icons on narrow screens.
  `size`, `magnify`, `range`, `lean`, `gap`, `tint`, `accent`, `labels`, `fit`; `launch()`,
  `items`, `ane-dock-launch`. Reduced motion snaps to a fixed scale with no springs or bounce.

## [0.11.0] - 2026-11-18

### Added

- `<ane-decrypt-text>` (Decrypt Text, UI FX): text that decodes itself out of scrambled glyphs
  without layout jitter. Cells keep their final width and scramble only through glyphs of a
  similar width in the element's font; changing `text` morphs from the old string with cells
  opening and closing smoothly; CJK positions scramble through CJK glyphs. `trigger`
  (`view` / `hover` / `manual`), `order`, `charset`, `stagger`, `scramble`, `accent`, `glow`,
  `seed`; `decode()`, `ane-decrypt-done`. Screen readers get the final text; reduced motion fades.

## [0.10.1] - 2026-11-17

### Fixed

- `<ane-image-reveal>`: smoother on slow GPUs and software WebGL. The canvas uses at most 1.5 device
  pixels per CSS pixel and the render scale steps down (to 0.5) while denoising if frames run long
  (`renderScale`). Caught by the CI frame-budget check, which ran at 25–30 frames in 2 s.

## [0.10.0] - 2026-11-17

### Added

- `<ane-aurora>` (Aurora Curtain), the first effect of the new **UI FX** series: a WebGL2
  northern-lights hero background. Curtains with bright hems, rising rays and drifting folds that
  lean towards the pointer (`interactive`), twinkling stars, rim-lit mountain ridges and a
  film-grain overlay. Palettes `borealis`, `dusk`, `glacier`, `ember` or custom `color` /
  `accent`; `intensity`, `rays`, `stars`, `horizon`, `grain`, `quality`, `seed`. Slotted hero
  content stays plain HTML. The render scale adapts downwards on slow GPUs (`renderScale`). CSS
  fallback without WebGL2; reduced motion shows a still frame.

## [0.9.0] - 2026-11-16

### Added

- `<ane-image-reveal>` (Image Reveal FX): image generation shown like a real diffusion
  sampler. A WebGL2 shader mixes a coarse-to-fine prediction with per-step noise
  (x_t = √ᾱ·x̂₀ + √(1−ᾱ)·ε) on latent blocks that dissolve like a VAE decode. Autoplay or
  backend-driven `progress` with a step counter, prompt and seed HUD, `ane-reveal-complete`,
  and an optional `compare` divider (drag or keyboard, `role="slider"`) between the starting
  noise and the result. Works with your `src` or a procedural aerial scene; reduced motion.

### Changed

- `npm run capture` accepts `--gif-colors`, `--gif-dither` and `--crf` for high-entropy
  effects such as noise and grain.
- `scan-reveal`'s procedural scene shader is exported for reuse by other WebGL effects.

## [0.8.0] - 2026-11-15

### Added

- `<ane-glass-lens>` (Liquid Glass Lens): a liquid-glass lens that refracts the live DOM it
  wraps, via an SVG `filter: url()` chain (works in Chromium, Firefox and Safari): an SDF
  displacement map with a magnifying dome and an outward-bending rim, RGB dispersion, alpha
  restore, lens-shape masking and a specular rim. `mode="read"` shows an assistant reading a
  source line by line, dwelling on citations (`marks`) and highlighting them
  (`ane-lens-mark`, `ane-lens-done`, `found`); `follow` tracks the pointer (tap to place on
  touch screens); `static` with `focusOn()`. Reduced motion, polite announcements.

## [0.7.0] - 2026-11-14

### Added

- `<ane-agent-flow>` (Agent Flow Visualizer): a live flow graph of an agent run. Steps
  (`plan`, `think`, `search`, `retrieve`, `code`, `tool`, `answer`) arrive through
  `addStep` / `updateStep` or a diffed `steps` array and grow into a layered DAG with joins;
  running steps glow and their edges carry data, durations are measured automatically, and
  steps expand (native buttons) to show their `output`. A single-column stack layout with
  rails below 560px (`layout`), `theme="light"`, a camera that follows running work and
  zooms out at the end, `ane-step-change` / `ane-step-toggle`, polite announcements and a
  reduced-motion variant.

### Fixed

- Showcase: the Satellite Scan Reveal "Replay autoplay" button now scrolls the preview into view.
  The scan pauses while off-screen, so on phones a replay used to start unseen (and the e2e
  test that covered it was flaky).

## [0.6.0] - 2026-11-11

### Added

- `<ane-scan-reveal>` (Satellite Scan Reveal): a WebGL2 push-broom scan that reveals imagery
  (band-misregistration fringes and detector striping calibrate away behind the sensor line),
  then a dashed inference sweep that overlays a land-cover mask with crisp outlines. Works with
  your `src`/`mask` images (2D fallback for non-CORS images) or a seeded procedural farmland
  scene and mask. Autoplay (`duration`, `loop`, `replay()`) or app-driven `progress` /
  `analysis`, a HUD (`caption`, `detail`, live status, `classes` legend), `phase`,
  `ane-scan-complete`, progressbar semantics, redraw-only-on-change and reduced motion.

### Changed

- Showcase: the "On the workbench" list moves on to the next effects.

## [0.5.0] - 2026-11-10

### Removed

- `<ane-orbit-loader>` (Orbit Data Loader) and its `ai-native-effects/orbit-loader` entry point,
  CDN module, playground, docs and previews. It is superseded by
  `<ane-orbit-loading-screen>`, which covers the same use case with a far richer presentation.
  The old playground URL now redirects to the loading screen. Projects pinned to
  `#v0.2.0`–`#v0.4.0` keep working.

### Changed

- `<ane-orbit-loading-screen>` now declares the typed `ane-complete` event itself.
- Showcase: the "On the workbench" list shows what is actually coming next.

## [0.4.0] - 2026-11-10

### Added

- `<ane-token-stream>` (Token Stream Text): streamed LLM text that writes itself smoothly.
  A safe incremental tokenizer (holds back half-words, unclosed code and ambiguous markers),
  `Intl.Segmenter` word or grapheme reveal (CJK included), adaptive pacing that drains
  bursts with a ~0.8 s time constant, blur-to-sharp "ink" with an accent-to-text color dry,
  a breathing caret with a trailing glow, line breaks, paragraphs, inline code and bold.
  API: `write()`, `done()`, `stream()` (async iterables and `ReadableStream`s of text or
  bytes), `skip()`, `reset()`, `finished`, and the `ane-stream-end` event. `aria-busy`
  while streaming, optional completion announcement and a reduced-motion variant.

## [0.3.0] - 2026-11-09

### Added

- `<ane-orbit-loading-screen>` (Orbit Loading Screen): a full loading screen. A WebGL2 planet
  (baked procedural terrain, clouds, night lights and atmosphere) is revealed tile by tile as
  progress grows: blurred preview → full detail, with satellite swaths, an indeterminate scan,
  a completion flash and a failed state. A DOM panel shows the eyebrow, heading, percentage,
  steps (`steps` / `step`), detail and status lines, plus an `actions` slot. Supports
  `fullscreen`, adaptive `quality`, container-driven layout, a 2D fallback without WebGL,
  progressbar semantics and a reduced-motion variant.
- Showcase: full-bleed playground viewport and a full-screen preview.

## [0.2.0] - 2026-11-09

### Added

- `<ane-orbit-loader>` (Orbit Data Loader): a Canvas 2D progress loader with a procedural
  dotted planet, 1–6 satellites downlinking data packets and a progress ring. Determinate
  (`progress`, fractions or percentages) and indeterminate modes with a cross-fade, a
  completion pulse with the `ane-complete` event, an `error` state, an optional percentage,
  `role="progressbar"` semantics and a reduced-motion variant.
- Playground API: `unset(attr)` removes an attribute and keeps the code snippet in sync.

### Fixed

- Showcase: the preview background buttons were unreadable on the light background and
  did not show which background was selected.

## [0.1.0] - 2026-11-08

### Added

- `<ane-thinking-buddy>` (AI Thinking Buddy): an SVG robot with `idle`, `thinking`,
  `waiting`, `success` and `error` states, state badges, confetti, pointer tracking,
  localisable ARIA labels, optional live announcements and a reduced-motion variant.
- Core runtime: shared `requestAnimationFrame` ticker with per-frame budget stats,
  `EffectElement` base class (off-screen pausing, `speed`, `motion`, `size`), SSR-safe imports.
- Showcase site with gallery and interactive playground (live code snippets for HTML,
  React, Vue and the JS API), deployed to GitHub Pages together with CDN-ready ES modules.
- Deterministic capture pipeline (`npm run capture`): virtual-time recording to GIF, MP4,
  poster and thumbnail.
- Quality gate: unit tests (Vitest) and Playwright e2e checks for runtime errors,
  responsive layout, axe-core WCAG 2.2 AA, frame budget, reduced motion and off-screen pausing.
