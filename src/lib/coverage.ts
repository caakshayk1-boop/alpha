/** Data eligibility, kept apart from the research checks (C07, H08). The screen's "vet" gate says whether the data is complete
 *  and fresh enough to read a company at all; it says nothing about whether the company is good. "Held" alone told a reader
 *  neither which, so each failed gate is named in words, with its figure. Pure; tested. */
import type { Row } from './types';

const GATE: Record<string, string> = {
  stmts: 'Limited history', fresh: 'Statements out of date', mcap: 'Market cap not published', liq: 'Thinly traded',
  lev: 'High leverage', cover: 'Thin interest cover', cash: 'Profit not turning into cash', oneoff: 'One-off year in the figures',
};

export interface Eligibility { ok: boolean; label: string; detail: string; thin: boolean }
export function eligibility(r: Row): Eligibility | null {
  const v = r.vet;
  if (!v) return null;
  const f = Array.isArray(v.f) ? v.f : [];
  const years = typeof r.fy_count === 'number' ? r.fy_count : null;
  const thin = f.includes('stmts') || (years !== null && years < 4);
  if (v.s === 'cleared') return { ok: true, label: `Data checks ${v.p}/${v.n}`, detail: `The screen's ${v.n} data checks: ${v.p} pass.`, thin };
  const first = f[0];
  const label = first === 'stmts' && years !== null ? `Limited history: ${years} fiscal year${years === 1 ? '' : 's'} available` : `${GATE[first] ?? 'Data check held'}${v.w && first !== 'stmts' ? ` · ${v.w}` : ''}`;
  const more = f.slice(1).map((k) => GATE[k] ?? k).join(', ');
  return { ok: false, label, thin, detail: `A gate on the data, not a view on the company: ${v.p} of ${v.n} data checks pass.${more ? ` Also: ${more.toLowerCase()}.` : ''}` };
}
