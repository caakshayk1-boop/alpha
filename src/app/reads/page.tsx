'use client';

import { useState } from 'react';
import Link from 'next/link';
import Prose from '@/components/Prose';
import { Async, PageHead, Rv } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { crore, dateLabel } from '@/lib/format';

export default function Reads() {
  const r = useFeed('weekly_reads');
  const [e, setE] = useState(0);
  const [open, setOpen] = useState(0);
  const ed = r.data?.editions[e];
  const s = ed?.studies[open];
  return (
    <>
      <PageHead eyebrow="Weekly reads" title="Seven companies," em="studied properly." lede="One a sector, written every Saturday: what they sell, how the money works, and what would break it. Figures come from the screen; the prose is a model’s reading of them, marked as such." />
      <section className="wrap">
        <Async loading={r.loading} error={r.error}>
          <div className="filters" role="group" aria-label="Edition">
            {r.data?.editions.map((x, i) => <button key={x.week} className="chip" aria-pressed={e === i} onClick={() => { setE(i); setOpen(0); }}>Week of {dateLabel(x.week)}</button>)}
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'minmax(220px, 300px) 1fr', alignItems: 'start' }}>
            <div className="list panel tight" style={{ position: 'sticky', top: 80 }}>
              {ed?.studies.map((x, i) => (
                <button key={x.sym} className="li" style={{ textAlign: 'left', color: open === i ? 'var(--text)' : 'var(--muted)' }} onClick={() => setOpen(i)} aria-pressed={open === i}>
                  <div><div className="t">{x.name}</div><div className="s">{x.sector} · {x.read_minutes} min</div></div>
                  <span aria-hidden>{open === i ? '●' : ''}</span>
                </button>
              ))}
            </div>
            {s && (
              <Rv key={s.sym} className="panel">
                <div className="eyebrow">{s.industry && s.industry !== s.sector ? `${s.sector} · ${s.industry}` : s.sector}</div>
                <h2 className="disp" style={{ fontSize: 'clamp(34px, 4vw, 52px)', margin: '12px 0 8px' }}>{s.name}</h2>
                <div className="dim num" style={{ fontSize: 13, marginBottom: 20 }}>{crore(s.mcap_cr)} · ₹{s.price.toLocaleString('en-IN')} · <Link href={`/company/?s=${s.sym}`} style={{ color: 'var(--accent-2)' }}>full company page →</Link></div>
                <Prose md={s.study} />
                <details style={{ marginTop: 28 }}><summary className="eyebrow" style={{ cursor: 'pointer' }}>The figures this was written from</summary>
                  <ul className="muted num" style={{ fontSize: 13, columns: 2, paddingLeft: 18 }}>{s.facts.map((f) => <li key={f}>{f}</li>)}</ul>
                </details>
              </Rv>
            )}
          </div>
        </Async>
      </section>
      <style>{`@media (max-width: 860px) { .wrap > .grid[style] { grid-template-columns: 1fr !important; } .wrap > .grid > .list { position: static !important; } }`}</style>
    </>
  );
}
