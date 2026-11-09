# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
