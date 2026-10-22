'use client';
/** The company workspace's heavier parts: the research summary, six measures, earnings-quality checks and the notes column.
 *  Kept apart from Parts.tsx (drawer and overflow menu), which many pages import, so those pages do not load these. */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useDatasetStatus } from '@/components/DataStamp';
import { buildCard, type ResearchCard } from '@/lib/card';
import { decide } from '@/lib/decision';
import { eligibility } from '@/lib/coverage';
import { crore, dash, dateLabel, num, pct, ratio } from '@/lib/format';
import { GLOSSARY } from '@/lib/glossary';
import { parseJournal, type JournalEntry } from '@/lib/journal';
import { useCards } from '@/lib/library';
import { isLender } from '@/lib/sector';
import { earningsQuality } from '@/lib/forensic';
import { ordinal } from '@/lib/status';
import type { Row, Sig } from '@/lib/types';


const has = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

/** One sentence: the check count with its coverage, the strong and weak sides, and the data limitation when there is one. */
export function ResearchSummary({ r, sigs }: { r: Row; sigs: Sig[] }) {
  const d = useMemo(() => decide(r, sigs), [r, sigs]);
  const e = eligibility(r);
  return (
    <p className="co-summary">
      {d.headline}
      {e && !e.ok && <> <span className="co-qual">{e.label}.</span></>}
      <span className="dim co-asof"> Screen close {r.last_date ? dateLabel(r.last_date) : 'date unknown'}{r.fy ? `, statements to ${r.fy}` : ''} · rule set {d.version}.</span>
    </p>
  );
}

/** Six measures that matter for this kind of business (a lender is read on its own terms, as the screen's lender rule says). */
export function SixMetrics({ r, onExplain }: { r: Row; onExplain: (k: string, v: string) => void }) {
  const lender = isLender(r);
  const items: [string, string, string][] = lender
    ? [
      ['Market cap', has(r.mcap_cr) && r.mcap_cr > 0 ? crore(r.mcap_cr) : 'not published', 'screen close'],
      ['P/B', has(r.pb) ? ratio(r.pb, 2) : dash, 'price / book value'],
      ['ROE', has(r.roe) ? pct(r.roe, 1, false) : dash, 'latest fiscal year'],
      ['P/E', has(r.pe) ? ratio(r.pe, 1) : dash, 'trailing twelve months'],
      ['Revenue CAGR', has(r.rev_cagr) ? pct(r.rev_cagr, 1, false) : dash, '3-year compound'],
      ['P/E vs own history', has(r.pe_pctile) ? `${ordinal(r.pe_pctile)} pct` : dash, 'rank in its own history'],
    ]
    : [
      ['Market cap', has(r.mcap_cr) && r.mcap_cr > 0 ? crore(r.mcap_cr) : 'not published', 'screen close'],
      ['P/E', has(r.pe) ? ratio(r.pe, 1) : dash, has(r.pe_pctile) ? `${ordinal(r.pe_pctile)} percentile of its history` : 'trailing twelve months'],
      ['ROCE', has(r.roce) ? pct(r.roce, 1, false) : dash, 'EBIT / capital employed, latest year'],
      ['Debt / equity', has(r.de) ? num(r.de, 2) : dash, has(r.de) && r.de < 0 ? 'negative equity' : 'latest balance sheet'],
      ['Revenue CAGR', has(r.rev_cagr) ? pct(r.rev_cagr, 1, false) : dash, '3-year compound'],
      ['Cash / profit', has(r.cfo_pat) ? ratio(r.cfo_pat, 2) : dash, 'operating cash flow / net profit'],
    ];
  return (
    <div className="metrics" role="list" aria-label="Six measures for this business">
      {items.map(([k, v, n]) => (
        <div key={k} role="listitem">
          <div className="m-l">{k}{k in GLOSSARY && <button type="button" className="m-x" onClick={() => onExplain(k, v)} aria-label={`Explain ${k}`}>Explain</button>}</div>
          <div className="m-v">{v}</div>
          <div className="m-n">{n}</div>
        </div>
      ))}
    </div>
  );
}

/** Notes: the reader's own question, what would change their mind, and when to look again, saved as a research card. Plus
 *  everything already saved about this company (cards and journal entries), so nothing is duplicated or lost. */
export function NotesColumn({ r, sigs }: { r: Row; sigs: Sig[] }) {
  const { cards, add, ok } = useCards();
  const { items } = useDatasetStatus();
  const [q, setQ] = useState('');
  const [against, setAgainst] = useState('');
  const [when, setWhen] = useState<'' | 'results' | 'date'>('');
  const [on, setOn] = useState('');
  const [msg, setMsg] = useState('');
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  useEffect(() => { try { setJournal(parseJournal(localStorage.getItem('alpha-journal')).filter((e) => e.sym === r.sym)); } catch { /* storage blocked */ } }, [r.sym]);
  const mine = cards.filter((c) => c.companies.some((x) => x.sym === r.sym));
  const save = () => {
    const d = decide(r, sigs);
    const card: ResearchCard = buildCard({
      question: q.trim() || `Why ${r.sym}?`,
      companies: [{ sym: r.sym, name: r.name, price: has(r.price) ? r.price : null, priceAsOf: r.last_date ?? null }],
      evidence: d.evidence,
      nextResults: { [r.sym]: r.next_earnings ?? null },
      dataStatus: items.map((i) => ({ id: i.id, asOf: i.asOf, refreshedAt: i.refreshedAt, state: i.state })),
      decision: { thesis: null, against: against.trim() || null, unknowns: null, reviewOn: when === 'date' && on ? on : null, reviewWhen: when === 'results' ? 'results' : null },
    });
    if (add(card)) { setMsg('Saved in this browser. It is on My Desk with the evidence and data dates.'); setQ(''); setAgainst(''); setWhen(''); setOn(''); } else setMsg('Could not save: browser storage is blocked or full.');
  };
  return (
    <div className="notes-col">
      <section className="card tight" aria-labelledby="note-h">
        <div className="card-h"><h3 id="note-h">Your research question</h3></div>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="note-form">
          <label><span>Question</span><input className="field" value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} placeholder={`e.g. Can ${r.sym} keep its margins if input costs rise?`} /></label>
          <label><span>What would change my mind</span><textarea className="field" rows={2} value={against} onChange={(e) => setAgainst(e.target.value)} maxLength={400} placeholder="In your own words" /></label>
          <fieldset><legend>Look again</legend>
            <label className="radio"><input type="radio" name="when" checked={when === ''} onChange={() => setWhen('')} /> No reminder</label>
            <label className="radio"><input type="radio" name="when" checked={when === 'results'} onChange={() => setWhen('results')} /> After the next results{r.next_earnings ? ` (on file: ${dateLabel(r.next_earnings)})` : ''}</label>
            <label className="radio"><input type="radio" name="when" checked={when === 'date'} onChange={() => setWhen('date')} /> On a date</label>
            {when === 'date' && <input className="field" type="date" value={on} onChange={(e) => setOn(e.target.value)} aria-label="Review date" />}
          </fieldset>
          <button type="submit" className="act primary" disabled={!ok}>Save to My Desk</button>
          <p className="dim" role="status" style={{ fontSize: 13, margin: 0 }}>{msg || 'Saved with the case, the countercase and every data date, in this browser only. A reminder shows on My Desk when you open it; nothing is sent.'}</p>
        </form>
      </section>
      <section className="card tight" aria-labelledby="saved-h">
        <div className="card-h"><h3 id="saved-h">Saved about {r.sym}</h3><Link className="more" href="/desk/">My Desk →</Link></div>
        {mine.length + journal.length === 0 ? <p className="dim" style={{ margin: 0, fontSize: 14 }}>Nothing yet. A question saved above, or a decision in the <Link className="link" href="/desk/#journal">journal</Link>, appears here.</p> : (
          <ul className="rows">
            {mine.slice(0, 4).map((c) => <li key={c.id}><Link className="row" href="/desk/#cards"><span style={{ minWidth: 0 }}><span className="row-t">{c.question ?? 'Untitled question'}</span><div className="row-s">Research card · saved {dateLabel(c.createdAt.slice(0, 10))}{c.decision?.reviewOn ? ` · review ${dateLabel(c.decision.reviewOn)}` : c.decision?.reviewWhen === 'results' ? ' · review after results' : ''}</div></span></Link></li>)}
            {journal.slice(0, 3).map((e) => <li key={e.id}><Link className="row" href="/desk/#journal"><span style={{ minWidth: 0 }}><span className="row-t">{e.action === 'took' ? 'Took it' : e.action === 'skipped' ? 'Skipped' : 'Watching'} · {dateLabel(e.date)}</span><div className="row-s">{e.why}</div></span></Link></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Earnings-quality checks (Blueprint §2.1): the pillars Alpha can measure, with their rule and figure, and the ones it
 *  cannot, said plainly. No composite score: three of eight pillars are not a score. */
export function EarningsQuality({ years, lender }: { years: import('@/lib/types').Year[] | null | undefined; lender: boolean }) {
  const q = useMemo(() => earningsQuality(years ?? [], lender), [years, lender]);
  const tone = (l: string | null) => (l === 'GREEN' ? 'ok' : l === 'AMBER' ? 'warn' : l === 'RED' ? 'bad' : '');
  const word = (l: string | null) => (l === 'GREEN' ? 'Pass' : l === 'AMBER' ? 'Watch' : l === 'RED' ? 'Flag' : 'Not measured');
  if (!q.applies) return <div className="state"><b>Not applied to lenders and insurers.</b><p>Cash conversion and capital-employed measures do not describe a bank&apos;s or insurer&apos;s business, so these checks are left out rather than scored.</p></div>;
  return (
    <section className="card" aria-labelledby="eq-h">
      <div className="card-h"><h3 id="eq-h">Earnings-quality checks</h3><span className="pill nodot">{q.measured} of 8 measured · {q.weightMeasured}% of the weight</span></div>
      <p className="dim" style={{ fontSize: 13.5, margin: '0 0 12px' }}>From the filed statements on file (fiscal years, newest first). No overall score is given: the pillars Alpha cannot measure are not filled in, and a partial score would read as a full one. A flag is a reason to read the filings, not a verdict.</p>
      <ul className="rows eq-rows">
        {q.pillars.map((p) => (
          <li key={p.id} className="row eq-row">
            <span style={{ minWidth: 0 }}>
              <span className="row-t">{p.id} · {p.name} <span className="dim" style={{ fontWeight: 500 }}>· weight {p.weight}%</span></span>
              <div className="row-s" style={{ whiteSpace: 'normal' }}>{p.light ? p.rule : `Not measured: ${p.missing}.`} {p.light ? p.why : ''}</div>
            </span>
            <span className="row-r">{p.value && <b className="num">{p.value}</b>}<small><span className={`pill ${tone(p.light)}${p.light ? '' : ' nodot'}`}>{word(p.light)}</span></small></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
