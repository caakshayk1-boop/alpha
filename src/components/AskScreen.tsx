'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildCard } from '@/lib/card';
import { useCards } from '@/lib/library';
import { parse } from '@/lib/nl';
import type { Row } from '@/lib/types';
import { num } from '@/lib/format';
import { plural } from '@/lib/status';

const EXAMPLES = ['large cap IT roce above 25 low debt', 'small cap uptrend quality growth', 'oversold pharma profitable', 'cheap banks roe above 14', 'near 52 week high momentum cash generative', 'magic formula debt below 0.5 pe under 20', 'dividend yield above 3 low risk'];

export interface NlState { text: string; off: string[] }   // `off`: clauses the person has switched off; nothing is ever switched off for them

/** The plain-English box. Its state lives in the Screen page (so a saved screen can restore it); `tableRows` is the one table the person is looking at. */
export default function AskScreen({ rows, tableRows, value, onValue, onTests }: { rows: Row[]; tableRows: Row[]; value: NlState; onValue: (v: NlState) => void; onTests?: (tests: ((r: Row) => boolean)[]) => void }) {
  const q = value.text, off = value.off;
  const setQ = (text: string) => onValue({ text, off: [] });
  const setOff = (f: (o: string[]) => string[]) => onValue({ text: q, off: f(off) });
  const { add, ok } = useCards();
  const [saved, setSaved] = useState(false);
  const p = useMemo(() => parse(q), [q]);
  const active = useMemo(() => p.filters.filter((f) => !off.includes(f.label)), [p, off]);
  const hits = useMemo(() => {
    if (!active.length) return [];
    return rows.filter((r) => active.every((f) => f.test(r))).sort((a, b) => ((b.q ?? 0) + (b.tech ?? 0) + (b.g ?? 0)) - ((a.q ?? 0) + (a.tech ?? 0) + (a.g ?? 0)));
  }, [rows, active]);
  useEffect(() => { onTests?.(active.map((f) => f.test)); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onTests?.([]), []); // eslint-disable-line react-hooks/exhaustive-deps
  // for a search with no matches: what each single clause costs, so the person can decide which one to give up
  const costs = useMemo(() => (hits.length === 0 && active.length > 1 ? active.map((f) => ({ f, n: rows.filter((r) => active.every((g) => g === f || g.test(r))).length })).sort((a, b) => b.n - a.n) : []), [hits.length, active, rows]);
  const missing = useMemo(() => {
    // how many companies a measure could not be read for, per measure named in an active clause: they cannot match it and are not counted as failures of it
    const out: string[] = [];
    for (const f of active) {
      const m = /^(ROCE|ROE|Debt\/equity|P\/E|P\/B|Revenue CAGR|EPS CAGR|Dividend yield|Piotroski|Net margin|EBIT margin|Interest cover|Promoter holding|Market cap|Daily turnover|RSI|Quality score|Value score)\b/.exec(f.label);
      if (!m) continue;
      const key = ({ ROCE: 'roce', ROE: 'roe', 'Debt/equity': 'de', 'P/E': 'pe', 'P/B': 'pb', 'Revenue CAGR': 'rev_cagr', 'EPS CAGR': 'eps_cagr', 'Dividend yield': 'div_yield', Piotroski: 'piotroski', 'Net margin': 'net_margin', 'EBIT margin': 'ebit_margin', 'Interest cover': 'icover', 'Promoter holding': 'insiders', 'Market cap': 'mcap_cr', 'Daily turnover': 'turnover_cr', RSI: 'rsi', 'Quality score': 'q', 'Value score': 'v' } as Record<string, keyof Row>)[m[1]];
      const n = rows.filter((r) => typeof r[key] !== 'number').length;
      if (n) out.push(`${m[1]}: ${plural(n, 'company', 'companies')} with no value are excluded from this clause`);
    }
    return out;
  }, [active, rows]);
  const setText = (v: string) => { setQ(v); setSaved(false); };
  return (
    <div className="panel spot" style={{ marginBottom: 20 }}>
      <div className="eyebrow">Ask in plain English</div>
      <label className="sr" htmlFor="nlq">Describe the stocks you want</label>
      <input id="nlq" className="field" style={{ width: '100%', margin: '10px 0 8px', height: 48, fontSize: 16 }} value={q} onChange={(e) => setText(e.target.value)} placeholder="e.g. small cap uptrend quality growth, debt below 0.5" spellCheck={false} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {EXAMPLES.map((x) => <button key={x} className="chip chip-wrap" onClick={() => setText(x)}>{x}</button>)}
      </div>
      {q.trim() && (
        <>
          <div role="status" aria-live="polite">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 4px', alignItems: 'center' }}>
              <span className="eyebrow">Understood</span>
              {p.filters.length === 0 && <span className="dim">nothing yet</span>}
              {p.filters.map((f) => {
                const isOff = off.includes(f.label);
                return (
                  <button key={f.label} className={`tag ${isOff ? '' : 'acc'}`} style={{ cursor: 'pointer', textDecoration: isOff ? 'line-through' : 'none', opacity: isOff ? 0.6 : 1 }} aria-pressed={!isOff} title={isOff ? 'Switched off by you: click to apply it again' : 'Click to switch this clause off'} onClick={() => setOff((o) => (isOff ? o.filter((x) => x !== f.label) : [...o, f.label]))}>{f.label} {isOff ? '↺' : '✕'}</button>
                );
              })}
            </div>
            {p.unknown.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0', alignItems: 'center' }}><span className="eyebrow" style={{ color: 'var(--warn)' }}>Ignored</span>{p.unknown.map((w) => <span key={w} className="tag warn">{w}</span>)}<span className="dim" style={{ fontSize: 13.5 }}>These words were not turned into a filter, so they did not change the results.</span></div>}
            {active.length === 0 && p.filters.length === 0 && <p className="dim" style={{ margin: '8px 0 0' }}>No filter recognised. This understands a fixed set of phrases: a sector (IT, pharma, banks), a size (large, mid, small cap), a ratio with a number (ROCE above 20, P/E under 25, debt below 0.5) or a state (uptrend, oversold, cheap, near 52 week high). Pick an example above, or use the lenses and filters below.</p>}
            {active.length === 0 && p.filters.length > 0 && <p className="dim" style={{ margin: '8px 0 0' }}>Every clause is switched off, so nothing is being filtered.</p>}
            {active.length > 0 && <p className="muted" style={{ margin: '8px 0 10px' }}><b className="num" style={{ color: 'var(--text)' }}>{num(hits.length)}</b> of {num(rows.length)} companies match {active.length === 1 ? 'the clause' : `all ${active.length} clauses`} on their own. The table below also applies the sector, size and manual filters and shows <b className="num" style={{ color: 'var(--text)' }}>{num(tableRows.length)}</b>.</p>}
          </div>
          {missing.length > 0 && <ul className="dim" style={{ fontSize: 13.5, margin: '0 0 8px', paddingLeft: 18 }}>{missing.map((m) => <li key={m}>{m}</li>)}</ul>}
          {active.length > 0 && hits.length === 0 && (
            <div className="panel tight" style={{ background: 'var(--panel-2)', marginBottom: 8 }}>
              <div className="eyebrow">No company matches. Nothing has been loosened for you.</div>
              {costs.length > 0 ? (
                <>
                  <p className="muted" style={{ margin: '8px 0', fontSize: 14.5 }}>Switch off one clause and see what is left:</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{costs.map(({ f, n }) => <button key={f.label} className="chip" onClick={() => setOff((o) => [...o, f.label])}>Drop &ldquo;{f.label}&rdquo; → {plural(n, 'match', 'matches')}</button>)}</div>
                </>
              ) : <p className="muted" style={{ margin: '8px 0 0', fontSize: 14.5 }}>The single clause matches no company. Check the number, or pick one of the examples above.</p>}
            </div>
          )}
          {tableRows.length > 0 && active.length > 0 && <div style={{ margin: '0 0 10px' }}><button className="chip" disabled={!ok} onClick={() => setSaved(add(buildCard({ question: q.trim(), query: { text: q.trim(), applied: active.map((f) => f.label), ignored: [...p.unknown, ...off.map((o) => `switched off: ${o}`)], matches: tableRows.length }, companies: tableRows.slice(0, 25).map((r) => ({ sym: r.sym, name: r.name, price: typeof r.price === 'number' ? r.price : null, priceAsOf: r.last_date ?? null })) })))} title="Saved in this browser only">{saved ? 'Saved locally ✓' : 'Save as research card'}</button></div>}
          {onTests && active.length > 0 && hits.length > 0 && <p className="dim" style={{ fontSize: 13.5, margin: '0 0 6px' }}>These clauses filter the table below together with the sector, size and manual filters. One table, one count.</p>}
        </>
      )}
      <p className="dim" style={{ fontSize: 13, margin: '10px 0 0' }}>Understood by fixed language rules, not a chatbot: every clause it turned into a filter is a chip you can switch off, every word it ignored is listed, and nothing is ever loosened or dropped for you. A company with no value for a measure cannot match a clause on it. Results are screens, not recommendations.</p>
    </div>
  );
}
