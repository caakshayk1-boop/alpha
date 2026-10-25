/** Geometry and lighting for the dotted-arc gauge. Pure, tested in tests/lib.test.ts.
 *  Dots sit on concentric semicircles; `t` runs 0 (left end) to 1 (right end) along each ring, so one fraction lights the same
 *  share of every ring. A gauge shows a measured value against a stated maximum; it never stands for a forecast or a grade. */

export interface GaugeDot { x: number; y: number; t: number; ring: number }

/** `rings` semicircles from radius `r0` outward by `gap`; each ring holds `base` dots scaled to its radius so the spacing stays even. */
export function gaugeDots(rings: number, base: number, r0: number, gap: number, dot: number): GaugeDot[] {
  const out: GaugeDot[] = [];
  const rMax = r0 + (rings - 1) * gap;
  for (let k = 0; k < rings; k++) {
    const r = r0 + k * gap;
    const n = Math.max(2, Math.round((base * r) / r0));
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), a = Math.PI * (1 - t);
      out.push({ x: Math.round((rMax + dot + r * Math.cos(a)) * 100) / 100, y: Math.round((rMax + dot - r * Math.sin(a)) * 100) / 100, t: Math.round(t * 1e6) / 1e6, ring: k });
    }
  }
  return out;
}

export const gaugeBox = (rings: number, r0: number, gap: number, dot: number) => { const rMax = r0 + (rings - 1) * gap; return { w: 2 * (rMax + dot), h: rMax + 2 * dot }; };

/** The share of the arc to light for `value` out of `max`; null when either is missing, never a guess. A value past the maximum lights the whole arc. */
export function fraction(value: number | null | undefined, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || !(max > 0)) return null;
  return Math.min(1, Math.max(0, value / max));
}

/** Is the dot at position `t` lit for this fraction? Nothing is lit at zero, and a measured non-zero value always lights at least the first dot of each ring. */
export const lit = (t: number, frac: number | null): boolean => frac !== null && frac > 0 && (t <= frac + 1e-9 || t === 0);
