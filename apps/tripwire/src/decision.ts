/** The compact decision summary: six answers a person needs before acting, each from data on this page and each saying where it came from.
 *  It summarises; it never replaces the detail (the case and countercase, the engine criteria, the statements stay as they were).
 *  Nothing here predicts. A rank is a percentile inside the eligible set and is labelled as a rank, never as a chance of winning. */
import type { Row } from './screen.ts';
import type { Eligibility, Curated } from './eligibility.ts';
import type { Pick, EngineId } from './quant.ts';
import type { EngineEvidence } from './evidence.ts';
import type { Version } from './store.ts';
import { dayWord } from './fmt.ts';

export const RANK_NOTE = 'A rank among the eligible names, not a chance of winning.';
export interface EngineView { id: EngineId; name: string; pass: boolean; score: number | null; eligible: boolean }
export interface DecisionInput {
  row: Row; elig: Eligibility; curated: Curated; pick: Pick | null; engines: EngineView[]; evidence: Record<string, EngineEvidence>; eligibleCount: number | null;
  thesis: Version | null; today: string; livePriceLabel: string | null;
}
export interface QualityItem { k: string; v: string; warn: boolean }
export interface Decision {
  why: { text: string; rank: string | null };
  counter: { text: string; detail: string | null; found: boolean };
  evidence: { chips: { id: string; name: string; word: string; state: string }[]; text: string; experimental: boolean };
  quality: QualityItem[];
  invalidation: { text: string; source: 'pick' | 'thesis' | 'none' };
  review: { text: string; date: string | null; source: 'thesis' | 'pick' | 'results' | 'none'; overdue: boolean };
}
const days = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

export function decisionOf(i: DecisionInput): Decision {
  const { row, elig, curated: cur, pick, engines } = i;
  const passing = engines.filter((e) => e.pass);
  // 1. why it surfaced
  const why = pick
    ? { text: `${engines.find((e) => e.id === pick.engine)?.name ?? pick.engine} picked it on the close of ${dayWord(pick.asOf)}: ${pick.why.slice(0, 3).join('; ') || 'it passed every rule'}.`, rank: `Rank ${pick.score} of 100${i.eligibleCount ? ` among ${i.eligibleCount} eligible names` : ''}. ${RANK_NOTE}` }
    : passing.length ? { text: `It passes the ${passing.map((e) => e.name).join(' and ')} rules but did not make tonight's top five or was held back by the per-sector limit.`, rank: passing[0].score != null ? `Rank ${Math.round(passing[0].score)} of 100. ${RANK_NOTE}` : null }
    : { text: engines.length ? 'No engine surfaced it tonight: it fails at least one rule of each. You are looking at it by choice, which is fine; the engines are not the only reason to study a company.' : 'Engine results load with the screen.', rank: null };
  // 2. the strongest counterargument
  const c0 = cur.counters[0];
  const counter = c0 ? { text: c0.t, detail: c0.k, found: true } : { text: 'The screen raised no flag.', detail: 'It only sees prices and annual ratios. Read the filings, the results call and the auditor\'s notes anyway.', found: false };
  // 3. evidence status
  const ids = pick ? [pick.engine] : passing.length ? passing.map((e) => e.id) : engines.map((e) => e.id);
  const chips = ids.map((id) => ({ id, name: engines.find((e) => e.id === id)?.name ?? id, word: i.evidence[id]?.word ?? '', state: i.evidence[id]?.state ?? 'untested' }));
  const experimental = chips.some((c) => c.state !== 'supported');
  const evidence = { chips, experimental, text: chips.length ? `${chips.map((c) => `${c.name}: ${(c.word || 'loading').toLowerCase()}`).join('. ')}. ${experimental ? 'Treat every engine pick as an experiment. The forward record, not the back-test, is the judge.' : ''}`.trim() : '' };
  // 4. data quality
  const q: QualityItem[] = [];
  q.push({ k: 'Price', v: i.livePriceLabel ?? `Close of ${dayWord(row.last_date)}`, warn: !i.livePriceLabel && !!row.last_date && i.today > (row.last_date ?? '') && days(row.last_date ?? i.today, i.today) > 4 });
  q.push({ k: 'Statements', v: row.has_stmts ? `${row.fy ?? 'year unknown'}${cur.hidden.length ? `, ${cur.hidden.length} judgement line${cur.hidden.length === 1 ? '' : 's'} withheld` : ''}` : 'none held', warn: !row.has_stmts || cur.hidden.length > 0 });
  if (elig.notes.length) q.push({ k: 'Not judged', v: elig.financial ? 'financial sector: capital ratios, margins, debt and cash conversion' : 'a figure failed a plausibility check', warn: true });
  q.push({ k: 'Size class', v: elig.size.known ? elig.size.label : 'not published', warn: !elig.size.known });
  q.push({ k: 'Liquidity', v: row.liquid ? (typeof row.turnover_cr === 'number' ? `flagged liquid, ₹${Math.round(row.turnover_cr)} cr a day` : 'flagged liquid') : 'not flagged liquid', warn: !row.liquid });
  // 5. invalidation
  const th = i.thesis; const inv = th?.invalidation?.trim();
  const invalidation = pick ? { source: 'pick' as const, text: `A close below ₹${pick.stop.toLocaleString('en-IN')} (${pick.stopPct}% under the signal close) ends the engine's setup. A gap through it exits at the open, below the stop.` }
    : inv ? { source: 'thesis' as const, text: inv } : { source: 'none' as const, text: 'Not written yet. Without it you cannot tell a bad day from being wrong.' };
  // 6. next review
  const rv = th?.reviewOn ?? null;
  const review = rv ? { source: 'thesis' as const, date: rv, overdue: rv < i.today, text: rv < i.today ? `Your review date, ${dayWord(rv)}, has passed.` : rv === i.today ? 'Your review is today.' : `Your review: ${dayWord(rv)}, in ${days(i.today, rv)} day${days(i.today, rv) === 1 ? '' : 's'}.` }
    : pick ? { source: 'pick' as const, date: null, overdue: false, text: `The paper trade exits by the close of session ${pick.horizon} if the stop is not hit first.` }
    : row.next_earnings && row.next_earnings >= i.today ? { source: 'results' as const, date: row.next_earnings, overdue: false, text: `Next results about ${dayWord(row.next_earnings)} (an estimate). A natural date to review.` }
    : { source: 'none' as const, date: null, overdue: false, text: 'No review date is set. Pick one when you write a thesis.' };
  return { why, counter, evidence, quality: q, invalidation, review };
}
