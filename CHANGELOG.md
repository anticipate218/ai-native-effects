# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
