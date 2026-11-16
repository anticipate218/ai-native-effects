/**
 * Optics for `<ane-glass-lens>`: turns a rounded-rectangle lens into a displacement map that
 * an SVG `feDisplacementMap` uses to bend the content underneath.
 *
 * Encoding (8-bit RGBA, one texel per CSS px of the lens):
 *   R, G — x / y displacement, 128 = none. Values point to where each pixel *samples from*;
 *          sampling towards the centre magnifies, which is what a convex glass bead does.
 *   B    — specular rim intensity (0..255).
 *   A    — 255 inside the lens, 0 outside (outside falls back to a neutral flood).
 *
 * The profile has two parts: a gentle dome over the body (`curvature`) and a stronger
 * inward bend in a thin band hugging the rim (`bend`), which is what reads as glass
 * thickness. Original implementation of the SDF displacement-map idea described publicly
 * by Aave ("Building glass for the web"); see docs/CREDITS.md.
 */

export interface LensShape {
  width: number;
  height: number;
  radius: number;
}

export interface LensOptics {
  /** Body magnification, 0..1. */
  curvature: number;
  /** Rim refraction strength, 0..1. */
  bend: number;
  /** Rim band width as a fraction of min(width, height). */
  bendWidth: number;
  /** Light direction in degrees (0 = from the left, 90 = from the top). */
  lightAngle: number;
  /** Specular rim strength, 0..1. */
  specular: number;
}

export const DEFAULT_OPTICS: LensOptics = {
  curvature: 0.55,
  bend: 0.45,
  bendWidth: 0.3,
  lightAngle: 120,
  specular: 0.7,
};

/** Signed distance to a rounded rectangle centred on the origin (negative inside). */
export function roundedRectSdf(x: number, y: number, halfW: number, halfH: number, radius: number): number {
  const r = Math.min(radius, halfW, halfH);
  const qx = Math.abs(x) - (halfW - r);
  const qy = Math.abs(y) - (halfH - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Fills `out` (width × height × 4, RGBA) with the displacement map for the lens. */
export function buildDisplacementMap(shape: LensShape, optics: LensOptics, out: Uint8ClampedArray): void {
  const w = Math.max(1, Math.round(shape.width));
  const h = Math.max(1, Math.round(shape.height));
  const halfW = w / 2;
  const halfH = h / 2;
  const minSide = Math.min(w, h);
  const band = Math.max(1, optics.bendWidth * minSide);
  const la = (optics.lightAngle * Math.PI) / 180;
  const lx = -Math.cos(la);
  const ly = -Math.sin(la);
  const eps = 0.75;

  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = i + 0.5 - halfW;
      const y = j + 0.5 - halfH;
      const d = roundedRectSdf(x, y, halfW, halfH, shape.radius);
      const o = (j * w + i) * 4;
      if (d > 0) {
        out[o] = 128;
        out[o + 1] = 128;
        out[o + 2] = 0;
        out[o + 3] = 0;
        continue;
      }
      // Outward normal from the SDF gradient.
      let nx = roundedRectSdf(x + eps, y, halfW, halfH, shape.radius) - roundedRectSdf(x - eps, y, halfW, halfH, shape.radius);
      let ny = roundedRectSdf(x, y + eps, halfW, halfH, shape.radius) - roundedRectSdf(x, y - eps, halfW, halfH, shape.radius);
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;

      const inward = -d; // 0 at the rim
      const u = Math.min(1, inward / band); // 0 rim … 1 inner edge of the band
      // Rim: steep near the edge, gone at the band's inner edge (a liquid meniscus).
      const rim = optics.bend * Math.pow(1 - u, 2.5);
      // Dome: sample towards the centre, proportionally to the distance from it.
      // Normalised by the smaller half-size so a pill magnifies evenly on both axes.
      const halfMin = Math.min(halfW, halfH);
      const domeX = clamp1(-(x / halfMin) * optics.curvature * 0.5);
      const domeY = clamp1(-(y / halfMin) * optics.curvature * 0.5);
      // Displacement in units of half the encodable range (−1..1).
      // The rim samples just *outside* the lens (content bends into the edge, like a liquid
      // lip); the dome samples towards the centre (magnification).
      const dx = clamp1(nx * rim + domeX);
      const dy = clamp1(ny * rim + domeY);

      // Specular: a bright arc where the rim faces the light, a faint one opposite.
      const facing = nx * lx + ny * ly;
      const edge = Math.pow(1 - Math.min(1, inward / Math.max(1.5, band * 0.35)), 2.2);
      const spec = optics.specular * edge * (facing > 0 ? 0.35 + 0.65 * facing : 0.25 * -facing);

      out[o] = 128 + dx * 127;
      out[o + 1] = 128 + dy * 127;
      out[o + 2] = Math.min(255, spec * 255);
      // Anti-aliased edge: fade the last pixel so the lens outline is smooth.
      out[o + 3] = Math.min(255, Math.max(0, -d + 0.5) * 255);
    }
  }
}

const clamp1 = (v: number): number => (v < -1 ? -1 : v > 1 ? 1 : v);
