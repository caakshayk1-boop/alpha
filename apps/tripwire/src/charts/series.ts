/** Series identity, once. The company is always the first slot and the benchmark is always the grey dashed line, on every chart, so a reader learns two keys and keeps them.
 *  Identity never rests on colour alone: each slot has its own marker shape and the benchmark has a dash. Lime (--accent) is not a series colour: it marks selection and emphasis. */
export type Marker = 'circle' | 'square' | 'triangle' | 'diamond';
export interface SeriesStyle { slot: number; color: string; dash: string; marker: Marker; width: number; label: string }
export const COMPANY_SLOTS: readonly Omit<SeriesStyle, 'label'>[] = [
  { slot: 0, color: 'var(--series-1)', dash: '', marker: 'circle', width: 2.25 },
  { slot: 1, color: 'var(--series-2)', dash: '', marker: 'square', width: 2.25 },
  { slot: 2, color: 'var(--series-3)', dash: '', marker: 'triangle', width: 2.25 },
];
export const BENCHMARK: Omit<SeriesStyle, 'label'> = { slot: -1, color: 'var(--ink-3)', dash: '6 4', marker: 'diamond', width: 1.75 };
export const styleOf = (slot: number, label: string): SeriesStyle => (slot < 0 ? { ...BENCHMARK, label } : { ...COMPANY_SLOTS[Math.min(slot, COMPANY_SLOTS.length - 1)], label });
/** An SVG path for a marker of radius `r` centred on (x, y). */
export function markerPath(m: Marker, x: number, y: number, r = 4): string {
  const f = (v: number) => Math.round(v * 10) / 10;
  switch (m) {
    case 'square': return `M${f(x - r)} ${f(y - r)}h${f(2 * r)}v${f(2 * r)}h${f(-2 * r)}Z`;
    case 'triangle': return `M${f(x)} ${f(y - r * 1.15)}L${f(x + r * 1.1)} ${f(y + r * 0.85)}L${f(x - r * 1.1)} ${f(y + r * 0.85)}Z`;
    case 'diamond': return `M${f(x)} ${f(y - r * 1.2)}L${f(x + r * 1.2)} ${f(y)}L${f(x)} ${f(y + r * 1.2)}L${f(x - r * 1.2)} ${f(y)}Z`;
    default: return `M${f(x - r)} ${f(y)}a${r} ${r} 0 1 0 ${f(2 * r)} 0a${r} ${r} 0 1 0 ${f(-2 * r)} 0Z`;
  }
}
/** Nudge end-of-line labels apart: given each label's wanted position (0..1 of the height), return positions at least `gap` apart, in the same order, kept inside [lo, hi]. */
export function spreadLabels(want: readonly number[], gap = 0.09, lo = 0.04, hi = 0.96): number[] {
  const idx = want.map((_, i) => i).sort((a, b) => want[a] - want[b]); const out = [...want];
  let prev = -Infinity; for (const i of idx) { out[i] = Math.max(want[i], prev + gap, lo); prev = out[i]; }
  let next = Infinity; for (const i of [...idx].reverse()) { out[i] = Math.min(out[i], next - gap, hi); next = out[i]; }
  return out;
}
