/** What the history says about each engine and each indicator, read from the study results (apps/tripwire/research/results). Plain sentences,
 *  built only from those numbers. Nothing here is a claim the study did not make. */
export interface Period { trades?: number; mean_net?: number; hit_rate?: number; mean_R?: number | null; excess_vs_universe?: number | null; excess_t?: number | null; months?: number }
export interface WalkForward { test_years: number[]; procedure: { mean_excess: number | null; t: number | null; supported: boolean }; as_built: { mean_excess: number | null; t: number | null }; variants: Record<string, { supported: boolean }> }
export interface Backtest { walk_forward?: WalkForward | null; meta: { when: string; symbols: number; dates: [string, string] }; engines: Record<string, { horizon: number; picked: number; skipped: number; periods: { train: Period; validation: Period; holdout: Period }; label: string }> }
export interface StudyFeature { ic: number | null; t: number | null; months: number; top_quintile_excess_net: number | null }
export interface Study { meta: { when: string; symbols: number; dates: [string, string] }; features: Record<string, { train: StudyFeature; validation: StudyFeature; holdout: StudyFeature }>; verdict: Record<string, { kind: string; adopt: boolean; steps: Record<string, boolean> }> }

/** Five honest states and no others. "Forward test" is an engine that cannot be tested on the past (its inputs, company accounts, are not available as they stood on each past date), so it is being tested on the only record that can judge it: its own picks from now on. "Untested" means no test exists: it says nothing about whether the engine works. "Not supported" means a test ran and
 *  the latest period came out below the benchmark with a negative t. "Supported" needs all three periods above the benchmark and a latest-period t of 2 or more.
 *  Anything tested that is neither is "mixed". While the study is still loading the state is "loading", which the page draws as a skeleton, not a claim. */
export type EvidenceState = 'loading' | 'untested' | 'forward' | 'unsupported' | 'mixed' | 'supported';
export interface EngineEvidence { state: EvidenceState; word: string; short: string; line: string; tone: 'bad' | 'ok' | 'unknown' | 'wait'; benchmark: string | null }
const p1 = (v: number | null | undefined) => (v == null ? 'n/a' : `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`);
const t1 = (v: number | null | undefined) => (v == null ? 'n/a' : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`);
/** The benchmark has one name everywhere: the back-test compares each trade with the average of the stocks it was drawn from, not with an index. */
export const benchmarkName = (bt: Backtest | null | undefined) => (bt ? `the equal-weighted average of the ${bt.meta.symbols} stocks in the test, over the same sessions (not the Nifty 50)` : 'the equal-weighted average of the stocks in the test (not the Nifty 50)');

/** The walk-forward sentence: every year from the first test year is out of sample for the rule that traded it, so a rule cannot be rescued by fitting it to a period already read. */
function walkForwardLine(w: WalkForward | null | undefined): string {
  if (!w) return '';
  const n = Object.keys(w.variants).length; const y = `${w.test_years[0]} to ${w.test_years[w.test_years.length - 1]}`;
  return ` Walk-forward ${y}, each year out of sample for the rule that traded it: the rule as built earned ${p1(w.as_built.mean_excess)} a rebalance over that benchmark (t ${t1(w.as_built.t)}); choosing the best of ${n} pre-declared rules each year from what had already happened earned ${p1(w.procedure.mean_excess)} (t ${t1(w.procedure.t)}). The bar, set before the run, was t 2.0 for the procedure. ${w.procedure.supported ? 'It was cleared.' : 'It was not cleared, so no alternative rule is adopted: changing the rule to fit a result already seen would only fit the past.'}`;
}
export function engineEvidence(id: string, bt: Backtest | null | undefined, loading = false): EngineEvidence {
  if (loading && !bt) return { state: 'loading', word: '', short: '', line: '', tone: 'wait', benchmark: null };
  if (id === 'QLT') return { state: 'forward', word: 'Forward test', short: 'In forward test', tone: 'unknown', benchmark: null, line: 'It cannot be back-tested: that needs company accounts as they stood on each past date, which no free source holds, and today\'s accounts would leak the future into the past. So it is being tested on the only record that can judge it: its own picks from now on, kept in the nightly ledger. Thirty closed trades are needed before any verdict, and until then this is neither a pass nor a fail.' };
  const e = bt?.engines?.[id]; if (!e) return { state: 'untested', word: 'Untested', short: 'Untested', tone: 'unknown', benchmark: null, line: 'No back-test has been published for this engine. That says nothing about whether it works.' };
  const ho = e.periods.holdout, tr = e.periods.train, va = e.periods.validation; const bm = benchmarkName(bt);
  const line = `Back-test ${bt!.meta.dates[0].slice(0, 4)} to ${bt!.meta.dates[1].slice(0, 4)}, ${bt!.meta.symbols} stocks. Compared with ${bm}, a trade earned ${p1(tr.excess_vs_universe)} in the early years (t ${t1(tr.excess_t)}), ${p1(va.excess_vs_universe)} in the middle, and ${p1(ho.excess_vs_universe)} in the latest (t ${t1(ho.excess_t)}), after costs. Survivorship bias flatters these figures.`;
  const wfl = id === 'MOM' ? walkForwardLine(bt!.walk_forward) : '';
  const above = [tr, va, ho].every((x) => (x.excess_vs_universe ?? -1) > 0);
  if (above && (ho.excess_t ?? 0) >= 2) return { state: 'supported', word: 'Supported', short: 'Back-test supports it', tone: 'ok', line: line + wfl, benchmark: bm };
  if ((ho.excess_vs_universe ?? 0) < 0 && (ho.excess_t ?? 0) < 0) return { state: 'unsupported', word: 'Not supported', short: 'Not supported by the back-test', tone: 'bad', line: line + wfl, benchmark: bm };
  return { state: 'mixed', word: 'Mixed', short: 'Back-test: mixed', tone: 'unknown', line: line + wfl, benchmark: bm };
}
/** One sentence over the engines still making picks, from the states above. Never says "none beat" about an engine that was never tested. */
export function evidenceHeadline(ids: string[], bt: Backtest | null | undefined, loading = false): string | null {
  const st = ids.map((i) => engineEvidence(i, bt, loading).state); if (st.includes('loading')) return null;
  const c = (k: EvidenceState) => st.filter((x) => x === k).length; const parts: string[] = [];
  if (c('supported')) parts.push(`${c('supported')} supported`); if (c('mixed')) parts.push(`${c('mixed')} mixed`); if (c('unsupported')) parts.push(`${c('unsupported')} not supported by the back-test`); if (c('forward')) parts.push(`${c('forward')} in forward test`); if (c('untested')) parts.push(`${c('untested')} untested`);
  return `Of the ${ids.length} engine${ids.length === 1 ? '' : 's'} now making picks: ${parts.join(', ')}.`;
}
export interface StudySummary { tested: number; passed: number; candidates: number; best: { name: string; t: number | null; failed: string[] } | null }
export function studySummary(s: Study | null | undefined): StudySummary | null {
  if (!s) return null;
  const cand = Object.entries(s.verdict).filter(([, v]) => v.kind === 'candidate');
  const passed = cand.filter(([, v]) => v.adopt).length;
  const ranked = cand.map(([k, v]) => ({ k, v, t: s.features[k]?.train?.t ?? null })).sort((a, b) => (b.t ?? -9) - (a.t ?? -9))[0];
  return { tested: Object.keys(s.features).length, candidates: cand.length, passed, best: ranked ? { name: ranked.k, t: ranked.t, failed: Object.entries(ranked.v.steps).filter(([, ok]) => !ok).map(([k]) => k) } : null };
}
