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
| Orbit Data Loader | The general "dotted globe" look common in network and data illustrations | n/a | Idea only; no code, images or map data reused. Continents are generated procedurally from a seed (spherical caps on a Fibonacci sphere); orbits, downlinks and the progress ring are original. |

## Tooling

Development tooling (not shipped in the library): TypeScript, Vite, Vitest, happy-dom,
Playwright, axe-core (MPL-2.0, test-only) and ffmpeg (used locally to encode previews).
