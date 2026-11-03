/** Versioned entry-only confirmation layer. Existing factor scoring, stored picks and all exits stay separate. */
import { agree, modelOutputs, agreementSettings, type Agreement, type AgreementSettings, type SignalEngine } from './agreement.ts';
import { buildCtx, evaluate, eligible, engineDef, pctMap, type Q, type Pick, type Run } from './quant.ts';
import { rulesFor } from './rules.ts';

export interface Candidate { sym: string; name: string; status: 'passed' | 'failed' | 'watch'; reason: string; agreement: Agreement; filters: string[]; score: number | null; pick?: Pick }
export interface SignalRun extends Run { candidates: Candidate[]; minimum: number }
export function runSignalEngines(rows: readonly Q[], asOf: string, expectedDay: string, settings?: AgreementSettings, held: ReadonlySet<string> = new Set()) {
  const config = agreementSettings(settings); const ctx = buildCtx(rows, rulesFor(asOf)); const ranks = pctMap(ctx.elig, (r) => r.r1w);
  const selected = new Set<string>(); // Existing engines keep priority; one new entry per symbol across the batch.
  const runs: SignalRun[] = (['MOM', 'QLT', 'ST'] as SignalEngine[]).map((id) => {
    const def = engineDef(id); let wide = 0;
    const candidates: Candidate[] = rows.map((r) => {
      const a = agree(modelOutputs(id, r, asOf, expectedDay), config[id], expectedDay);
      const base = id === 'ST' ? null : evaluate(id, r, ctx);
      const score = base ? base.score : ranks.get(r.sym) ?? null;
      const stopPct = def.atrMult * (r.atr_pct ?? NaN);
      const filters = base ? base.criteria.filter((c) => c.pass !== true).map((c) => `${c.label}: ${c.value}`) : eligible(r, ctx.rules) ? [] : ['Liquidity, size, price or ATR requirement failed'];
      if (!(stopPct > 0) || stopPct > def.maxStopPct) { if (!filters.length && a.pass) wide++; filters.push(`Stop must be within ${def.maxStopPct}% (measured ${Number.isFinite(stopPct) ? stopPct.toFixed(1) : 'unavailable'}%)`); }
      if (score == null) filters.push('Ranking inputs are missing');
      const status: Candidate['status'] = filters.length ? 'failed' : held.has(r.sym) || !a.pass ? 'watch' : 'passed';
      const reason = filters.length ? filters.join('; ') : held.has(r.sym) ? 'Already open or awaiting entry. No duplicate entry signal.' : a.reason;
      const pick: Pick | undefined = status === 'passed' ? { engine: id, sym: r.sym, name: r.name, sector: r.sector, asOf, ref: r.price!, stop: Math.round(r.price! * (1 - stopPct / 100) * 100) / 100, stopPct, horizon: def.horizon, score: Math.round(score!), rank: 0, agreement: a, why: [...new Set([...(base ? base.criteria.filter((c) => c.pass === true && c.label !== 'Liquid, priced, not a micro cap').map((c) => `${c.label}: ${c.value}`) : []), ...a.models.filter((m) => m.vote).map((m) => `${m.name}: ${m.rationale}`)])] } : undefined;
      return { sym: r.sym, name: r.name, status, reason, agreement: a, filters, score, pick };
    });
    const picks: Pick[] = []; const sectors = new Map<string, number>();
    for (const c of candidates.filter((c) => c.pick).sort((a, b) => b.score! - a.score! || a.sym.localeCompare(b.sym))) {
      const p = c.pick!, sector = p.sector ?? 'unknown';
      if (selected.has(p.sym)) { c.status = 'watch'; c.reason = 'Selected by another engine in this batch. One entry per company.'; delete c.pick; continue; }
      if (picks.length >= def.top || (sectors.get(sector) ?? 0) >= def.perSector) { c.status = 'watch'; c.reason = 'Models and filters pass; outside the ranked shortlist or sector limit.'; continue; }
      sectors.set(sector, (sectors.get(sector) ?? 0) + 1); selected.add(p.sym); p.rank = picks.length + 1; picks.push(p);
    }
    return { id, rules: ctx.rules, minimum: config[id], candidates, picks, funnel: { universe: rows.length, eligible: ctx.elig.length, passed: candidates.filter((c) => !c.filters.length && c.agreement.pass).length, skippedWideStop: wide, picked: picks.length } };
  });
  return { runs, ctx, picks: runs.flatMap((r) => r.picks) };
}
