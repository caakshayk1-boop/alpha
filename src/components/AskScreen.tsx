'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Chg } from '@/components/ui';
import { parse } from '@/lib/nl';
import type { Row } from '@/lib/types';
import { crore, dash, num } from '@/lib/format';

const EXAMPLES = ['large cap IT roce above 25 low debt', 'small cap uptrend quality growth', 'oversold pharma profitable', 'cheap banks roe above 14', 'near 52 week high momentum cash generative', 'magic formula debt below 0.5 pe under 20', 'dividend yield above 3 low risk'];

export default function AskScreen({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState('');
  const p = useMemo(() => parse(q), [q]);
  const hits = useMemo(() => {
    if (!p.filters.length) return [];
    return rows.filter((r) => p.filters.every((f) => f.test(r))).sort((a, b) => ((b.q ?? 0) + (b.tech ?? 0) + (b.g ?? 0)) - ((a.q ?? 0) + (a.tech ?? 0) + (a.g ?? 0)));
  }, [rows, p]);
  return (
    <div className="panel spot" style={{ marginBottom: 20 }}>
      <div className="eyebrow">AI desk · ask in plain English</div>
      <label className="sr" htmlFor="nlq">Describe the stocks you want</label>
      <input id="nlq" className="field" style={{ width: '100%', margin: '10px 0 8px', height: 48, fontSize: 16 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. small cap uptrend quality growth, debt below 0.5" spellCheck={false} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {EXAMPLES.map((x) => <button key={x} className="chip" onClick={() => setQ(x)}>{x}</button>)}
      </div>
      {q.trim() && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 4px' }}>
            {p.filters.map((f) => <span key={f.label} className="tag acc">{f.label}</span>)}
            {p.unknown.length > 0 && <span className="tag warn" title="These words were not turned into a filter">Not understood: {p.unknown.join(' ')}</span>}
          </div>
          {p.filters.length === 0 ? <p className="dim" style={{ margin: '8px 0 0' }}>No filter recognised yet. Try a sector, a size (large, mid, small cap), a ratio (ROCE above 20, P/E under 25) or a state (uptrend, oversold, cheap).</p> : (
            <>
              <p className="muted" style={{ margin: '8px 0 10px' }}><b className="num" style={{ color: 'var(--text)' }}>{num(hits.length)}</b> of {num(rows.length)} companies match every clause{hits.length > 25 ? ', best 25 shown (ranked by quality + trend + growth)' : ''}.</p>
              {hits.length > 0 && (
                <div className="tbl-wrap" style={{ maxHeight: 460 }}>
                  <table className="tbl" style={{ minWidth: 720 }}>
                    <thead><tr><th>Company</th><th>Sector</th><th>Mkt cap</th><th>Quality</th><th>Growth</th><th>P/E</th><th>ROCE</th><th>3M</th><th>1Y</th></tr></thead>
                    <tbody>{hits.slice(0, 25).map((r) => (
                      <tr key={r.sym}><td><Link href={`/company/?s=${encodeURIComponent(r.sym)}`}><b>{r.sym}</b> <span className="dim">{r.name}</span></Link></td><td className="dim">{r.ind || r.sector}</td><td className="num">{crore(r.mcap_cr)}</td><td className="num">{r.q != null ? Math.round(r.q) : dash}</td><td className="num">{r.g != null ? Math.round(r.g) : dash}</td><td className="num">{r.pe ? `${r.pe.toFixed(1)}×` : dash}</td><td className="num">{r.roce != null ? `${r.roce.toFixed(0)}%` : dash}</td><td><Chg v={r.r3m} dp={0} /></td><td><Chg v={r.r1y} dp={0} /></td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
      <p className="dim" style={{ fontSize: 12, margin: '10px 0 0' }}>Understood by fixed language rules, not a chatbot: it shows every clause it turned into a filter and every word it ignored, so you can see exactly what was asked. Results are screens, not recommendations.</p>
    </div>
  );
}
