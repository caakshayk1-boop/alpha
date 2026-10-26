/** What the history says about each engine and each indicator, read from the study results (apps/tripwire/research/results). Plain sentences,
 *  built only from those numbers. Nothing here is a claim the study did not make. */
export interface Period { trades?: number; mean_net?: number; hit_rate?: number; mean_R?: number | null; excess_vs_universe?: number | null; excess_t?: number | null; months?: number }
export interface Backtest { meta: { when: string; symbols: number; dates: [string, string] }; engines: Record<string, { horizon: number; picked: number; skipped: number; periods: { train: Period; validation: Period; holdout: Period }; label: string }> }
export interface StudyFeature { ic: number | null; t: number | null; months: number; top_quintile_excess_net: number | null }
export interface Study { meta: { when: string; symbols: number; dates: [string, string] }; features: Record<string, { train: StudyFeature; validation: StudyFeature; holdout: StudyFeature }>; verdict: Record<string, { kind: string; adopt: boolean; steps: Record<string, boolean> }> }

export type EvidenceLabel = 'no historical support' | 'not rejected' | 'cannot be back-tested' | 'not yet tested';
export interface EngineEvidence { label: EvidenceLabel; short: string; line: string; tone: 'bad' | 'ok' | 'unknown' }
const p1 = (v: number | null | undefined) => (v == null ? 'n/a' : `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`);
const t1 = (v: number | null | undefined) => (v == null ? 'n/a' : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`);

/** The engine's own verdict. A negative holdout with a negative t is "no historical support"; Quality needs point-in-time accounts the data does not have. */
export function engineEvidence(id: string, bt: Backtest | null | undefined): EngineEvidence {
  if (id === 'QLT') return { label: 'cannot be back-tested', short: 'Not back-testable', tone: 'unknown', line: 'It needs company accounts as they stood on each past date, which are not available. Only the forward record can judge it.' };
  const e = bt?.engines?.[id]; if (!e) return { label: 'not yet tested', short: 'Not yet tested', tone: 'unknown', line: 'The historical test has not been published yet.' };
  const ho = e.periods.holdout, tr = e.periods.train, va = e.periods.validation;
  const line = `Back-test ${bt!.meta.dates[0].slice(0, 4)} to ${bt!.meta.dates[1].slice(0, 4)}, ${bt!.meta.symbols} stocks: against the average of the whole universe it earned ${p1(tr.excess_vs_universe)} a trade in the early years (t ${t1(tr.excess_t)}), ${p1(va.excess_vs_universe)} in the middle, and ${p1(ho.excess_vs_universe)} in the latest (t ${t1(ho.excess_t)}), after costs. Survivorship bias flatters these figures.`;
  const bad = e.label === 'no historical support';
  return { label: bad ? 'no historical support' : 'not rejected', short: bad ? 'No back-test support' : 'Back-test: not rejected', tone: bad ? 'bad' : 'ok', line };
}
export interface StudySummary { tested: number; passed: number; candidates: number; best: { name: string; t: number | null; failed: string[] } | null }
export function studySummary(s: Study | null | undefined): StudySummary | null {
  if (!s) return null;
  const cand = Object.entries(s.verdict).filter(([, v]) => v.kind === 'candidate');
  const passed = cand.filter(([, v]) => v.adopt).length;
  const ranked = cand.map(([k, v]) => ({ k, v, t: s.features[k]?.train?.t ?? null })).sort((a, b) => (b.t ?? -9) - (a.t ?? -9))[0];
  return { tested: Object.keys(s.features).length, candidates: cand.length, passed, best: ranked ? { name: ranked.k, t: ranked.t, failed: Object.entries(ranked.v.steps).filter(([, ok]) => !ok).map(([k]) => k) } : null };
}
