/** The table alternative of a chart. It is built from the SAME arrays the chart draws, so the two cannot disagree: the first and last rows are the first and last drawn points, and the
 *  highest and lowest drawn points are always among the rows, however many are skipped. Pure. */
import { dateLabel } from '../chart.ts';

export interface TableCol { key: string; label: string; unit?: string; digits?: number; /** values as drawn, one per time */ v: readonly (number | null)[] }
export interface ChartTableData { t: readonly number[]; cols: TableCol[]; /** column the extremes are taken from */ primary: number; shown: number[]; total: number; monthly: boolean }
/** Indices to list: the first, the last, the highest and lowest of the primary column, and the rest evenly spread up to `max` rows. Ascending, no duplicates. */
export function pickRows(primary: readonly (number | null)[], max = 24): number[] {
  const n = primary.length; if (!n) return [];
  const set = new Set<number>([0, n - 1]); let hi = -1, lo = -1;
  primary.forEach((v, i) => { if (v == null || !Number.isFinite(v)) return; if (hi < 0 || v > (primary[hi] as number)) hi = i; if (lo < 0 || v < (primary[lo] as number)) lo = i; });
  if (hi >= 0) set.add(hi); if (lo >= 0) set.add(lo);
  const room = Math.max(0, max - set.size); if (n > max && room > 0) for (let k = 1; k <= room; k++) set.add(Math.round((k * (n - 1)) / (room + 1)));
  else if (n <= max) for (let i = 0; i < n; i++) set.add(i);
  return [...set].sort((a, b) => a - b);
}
export function buildTable(t: readonly number[], cols: TableCol[], opts: { max?: number; primary?: number; monthly?: boolean } = {}): ChartTableData {
  const primary = opts.primary ?? 0; const shown = pickRows(cols[primary]?.v ?? [], opts.max ?? 24);
  return { t, cols, primary, shown, total: t.length, monthly: !!opts.monthly };
}
export const cellText = (c: TableCol, i: number): string => { const v = c.v[i]; return v == null || !Number.isFinite(v) ? '—' : v.toLocaleString('en-IN', { minimumFractionDigits: c.digits ?? 2, maximumFractionDigits: c.digits ?? 2 }); };
/** The summary line that sits under the table, saying how many rows are listed of how many drawn. */
export function tableNote(d: ChartTableData, unitWord: string): string {
  return d.shown.length >= d.total ? `All ${d.total.toLocaleString('en-IN')} ${unitWord} drawn on the chart.` : `${d.shown.length} of the ${d.total.toLocaleString('en-IN')} ${unitWord} drawn on the chart: the first, the last, the highest and the lowest, and evenly spaced ones between.`;
}
export const rowDate = (d: ChartTableData, i: number) => dateLabel(d.t[i], d.monthly);
