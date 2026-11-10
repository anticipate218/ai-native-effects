# Contributing

Thanks for helping make AI interfaces more legible and more fun. This guide covers how to
add an effect, the quality bar every effect must meet, and the licensing rules.

## Setup

```bash
npm install
npm run dev      # http://localhost:5173 (gallery + playgrounds with hot reload)
```

Recording previews needs [ffmpeg](https://ffmpeg.org/) on `PATH` (or `FFMPEG_PATH`).
On Windows the scripts use the installed Microsoft Edge; elsewhere run
`npx playwright install chromium` once.

## Adding an effect

```bash
npm run new -- scan-reveal --title "Satellite Scan Reveal"
```

This scaffolds the component, tests, playground page, capture scene, docs (EN + 中文)
and a `draft` entry in `effects.json`. Then:

1. **Build the minimal version** in `src/effects/<id>/<id>.ts`. Extend `EffectElement`:
   render once in `build()`, animate in `tick(deltaMs)`, keep the node count fixed and only
   touch transforms, opacity or canvas pixels per frame. Use the seeded `createRandom()`.
2. **Parameterise it**: colors, speed and size at minimum, as attributes *and* CSS custom
   properties. Add the controls to the playground schema.
3. **Make it mobile- and motion-safe**: it must fit a 320 px screen, work with touch, and
   provide a calm variant when `this.reducedMotion` is `true`.
4. **Write tests**: unit tests next to the component; the shared e2e suite picks the effect
   up automatically from `effects.json` once its status is `stable`.
5. **Record previews**: write the scene in `site/scenes/<id>.ts`, then `npm run capture -- <id>`.
6. **Document it**: `docs/effects/<id>.md` (English, primary) and
   `docs/zh-CN/effects/<id>.md` (Chinese supplement).
7. **Ship it**: set `"status": "stable"` in `effects.json`, run `npm run sync` and
   `npm run check`, update `CHANGELOG.md`.

### Definition of done

- [ ] A runnable TypeScript component with no runtime dependencies
- [ ] A GIF and MP4 preview recorded with `npm run capture`
- [ ] A live playground page
- [ ] Adjustable color, speed and size (plus effect-specific parameters)
- [ ] Install and usage examples in the docs
- [ ] Responsive, performance and accessibility checks passing (`npm run check`)

## Quality gate

`npm run check` runs the type checker, unit tests, the production build and the
Playwright suite (desktop + mobile): no console errors, no horizontal overflow,
axe-core WCAG 2.2 AA, mean frame work under 2 ms, reduced-motion support,
a 320 px layout check and off-screen pausing. CI runs the same gate on every push and
deploys the showcase only when it passes.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(scan-reveal): …`,
`fix(thinking-buddy): …`, `perf: …`, `docs: …`, `test: …`, `refactor: …`, `chore: …`.
Small, focused commits are preferred; tests, refactors, performance work and docs are all
valuable contributions on their own.

## Licensing

All contributions are licensed under MIT. Only submit original work. Do not copy code,
assets or designs from other repositories or paid effect packs. If an effect is inspired by
someone else's work, credit it in [docs/CREDITS.md](docs/CREDITS.md) with a link and license.
