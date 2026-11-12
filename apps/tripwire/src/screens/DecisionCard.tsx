import { useMemo, useState } from 'react';
import { setState, useAppState, useSheets } from '../app.tsx';
import { useBacktest } from '../data.ts';
import { ACTIVE, evaluate, type Q } from '../quant.ts';
import { useEngines } from '../useEngines.ts';
import { curateCase, eligibilityOf } from '../eligibility.ts';
import { decisionOf } from '../decision.ts';
import { engineEvidence } from '../evidence.ts';
import { current, istDay, toggleFollow } from '../store.ts';
import { primaryAction } from '../overview.ts';
import { fmtIst } from '../stamp.ts';
import { plural } from '../fmt.ts';
import { companyRead } from '../research.ts';
import type { Company } from '../data.ts';
import type { LivePx } from '../quotes.ts';

/** The eligibility topics (eligibility.ts TOPICS) whose figure each line of the one-minute read (research.ts companyRead) already prints. */
const READ_TOPICS: Record<string, string[]> = { roce: ['roce_level', 'roce_trend'], rev_cagr: ['growth'] };

/** Six answers before acting, each from this page's own data. The detail (case, countercase, engine criteria, statements) stays below, unchanged. */
export function DecisionCard({ c, lp }: { c: Company; lp: LivePx }) {
  const [more, setMore] = useState(false); const s = useAppState(); const { open } = useSheets(); const bt = useBacktest(); const { out } = useEngines();
  const sym = c.sym; const row = c.row;
  const d = useMemo(() => {
    const elig = eligibilityOf(row, c.years); const cur = curateCase({ strengths: c.swot?.s ?? [], flags: c.risk?.flags ?? [], weaknesses: c.swot?.w ?? [] }, elig);
    const engines = out ? ACTIVE.map((e) => { const ev = evaluate(e.id, row as Q, out.ctx); return { id: e.id, name: e.name, pass: ev.pass, score: ev.score, eligible: ev.eligible }; }) : [];
    const evidence = Object.fromEntries(ACTIVE.map((e) => [e.id, engineEvidence(e.id, bt.data, bt.loading)]));
    const entry = s.entries.find((e) => e.sym === sym && !e.archived);
    // 12 Nov 2026: "each fact once". The one-minute read beside this card already prints the ROCE and the revenue-growth figures, so the strongest support is the first strength about
    // something ELSE; when every strength repeats the read, the line is dropped rather than say the same figure twice.
    const printed = new Set(companyRead(c).flatMap((x) => READ_TOPICS[x.id] ?? [])); const sup = cur.strengths.find((x) => !printed.has(x.topic)); const dec = decisionOf({ row, hasRisk: !!c.risk, elig, curated: cur, pick: out?.picks.find((p) => p.sym === sym) ?? null, engines, evidence, eligibleCount: out?.ctx.elig.length ?? null, thesis: entry ? current(entry) : null, today: istDay(), livePriceLabel: lp.fromQuote && lp.live ? `Live, ${fmtIst(lp.t!)}` : null });
    return { ...dec, support: sup ? { text: sup.t, detail: sup.k } : null };
  }, [c, row, out, bt.data, bt.loading, s.entries, lp.fromQuote, lp.live, lp.t, sym]);
  const loading = !out || bt.loading;
  if (loading) return <section className="card decision" aria-busy="true" aria-label="Decision summary, loading"><div className="k">Decision summary</div><div className="sk" style={{ height: 16, width: '85%', margin: '12px 0 8px' }} /><div className="sk" style={{ height: 16, width: '70%', marginBottom: 8 }} /><div className="sk" style={{ height: 16, width: '78%' }} /></section>;
  const row2 = (k: string, body: React.ReactNode, tone?: 'warn') => <div className="drow"><div className="dk">{k}</div><div className={`dv ${tone ?? ''}`}>{body}</div></div>;
  const act = primaryAction(s, sym, istDay()); const stale = d.quality.find((x) => x.k === 'Price')?.warn;
  const run = () => { if (act.id === 'follow') setState((x) => toggleFollow(x, sym)); else if (act.id === 'plan') open({ k: 'plan', sym }); else open({ k: 'thesis', sym, id: s.entries.find((e) => e.sym === sym && !e.archived)?.id }); };
  // 12 Nov 2026 (owner: one-pager): collapsed to two lines, the strongest counterargument and what would prove the idea wrong, beside the one next step. Everything else it said
  // (the strongest support, the evidence status, why it surfaced, next review, data quality) is one tap away under "Details", unchanged.
  return <section className="card decision ds-reveal" aria-label="Decision summary" data-decision-open={more || undefined}>
    <div className="row between"><span className="k">Read in 30 seconds</span><span className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{stale && <span className="tag peach" title="The price behind this page is more than a few sessions old">Old data</span>}{d.evidence.experimental && <span className="tag amber" title="No engine here has passed its tests. Treat a pick as an experiment.">Experimental</span>}</span></div>
    <p className="dec-line"><span className="dk">Against</span> <span className="dec-t">{d.counter.text}</span></p>
    <p className={`dec-line${d.invalidation.source === 'none' ? ' warn' : ''}`}><span className="dk">Wrong if</span> <span className="dec-t">{d.invalidation.text}</span></p>
    <div className="row between nextstep"><button className="btn sm pri" onClick={run}>{act.label}</button><button className="btn sm" aria-expanded={more} aria-controls="dec-more" data-dec-more onClick={() => setMore(!more)}>{more ? 'Fewer details' : 'Details'}<span className="chev" aria-hidden="true"> ▾</span></button></div>
    {more && <div id="dec-more" className="dec-more" role="region" aria-label="Decision details">
      <p className="small dim" style={{ margin: '8px 0 0' }}>{act.why}</p>
      {d.support && row2('Strongest support', <>{d.support.text}<span className="small dim" style={{ display: 'block', marginTop: 2 }}>{d.support.detail}</span></>)}
      {row2('Strongest counterargument', <>{d.counter.text}{d.counter.detail && <span className="small dim" style={{ display: 'block', marginTop: 2 }}>{d.counter.detail}</span>}</>)}
      {row2('Evidence status', <><span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{d.evidence.chips.map((x) => <span key={x.id} className={`tag ${x.state === 'unsupported' ? 'peach' : x.state === 'supported' ? 'lime' : ''}`}>{x.name}: {x.word.toLowerCase()}</span>)}</span>{d.evidence.experimental && <span className="small dim" style={{ display: 'block', marginTop: 4 }}>Judged on the forward record, which is still short. <a href="#/methodology" style={{ textDecoration: 'underline' }}>The evidence</a></span>}</>)}
      {row2('Invalidation', d.invalidation.text, d.invalidation.source === 'none' ? 'warn' : undefined)}
      <details className="more dqd"><summary>Why it surfaced, next review, data quality{d.quality.some((x) => x.warn) ? <span className="tag amber" style={{ marginLeft: 8 }}>{plural(d.quality.filter((x) => x.warn).length, 'note')}</span> : null}</summary>
        {row2('Why it surfaced', <>{d.why.short}{d.why.rank && <span className="small dim" style={{ display: 'block', marginTop: 2 }}>{d.why.rank}</span>}</>)}
        {row2('Next review', d.review.text, d.review.overdue ? 'warn' : undefined)}
        {row2('Data quality', <ul className="dq">{d.quality.map((x) => <li key={x.k} className={x.warn ? 'warn' : ''}><b>{x.k}</b> {x.v}</li>)}</ul>)}</details></div>}
  </section>;
}
