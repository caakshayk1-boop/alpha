'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Prose from '@/components/Prose';
import { Async, PageHead, Rv } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { crore, dateLabel } from '@/lib/format';

export default function Reads() {
  const r = useFeed('weekly_reads');
  const [e, setE] = useState(0);
  const [open, setOpen] = useState(0);
  const [sector, setSector] = useState('');
  const ed = r.data?.editions[e];
  const studies = useMemo(() => (ed?.studies ?? []).map((x, i) => ({ x, i })).filter(({ x }) => !sector || x.sector === sector), [ed, sector]);
  const sectors = useMemo(() => Array.from(new Set((ed?.studies ?? []).map((x) => x.sector))).sort(), [ed]);
  const s = ed?.studies[open];
  const written = ed?.written_at ? new Date(ed.written_at) : null;
  return (
    <>
      <PageHead eyebrow="Weekly reads" title="Seven companies," em="read from the numbers." lede="One a sector, every Saturday: what they sell, how the money works, and what would break it. Figures come from the screen. The prose is written by a language model from those figures, then checked automatically for arithmetic and percentile wording; business descriptions are the model's general knowledge unless a source is cited on the study. It is not an analyst's research, and any correction is listed on the study itself." />
      <section className="wrap">
        <Async loading={r.loading} error={r.error}>
          <div className="filters" role="group" aria-label="Edition">
            {r.data?.editions.map((x, i) => <button key={x.week} className="chip" aria-pressed={e === i} onClick={() => { setE(i); setOpen(0); setSector(''); }}>Week of {dateLabel(x.week)}</button>)}
          </div>
          {ed && <p className="dim" style={{ fontSize: 12.5, margin: '0 0 12px' }}>Written {written && !Number.isNaN(written.getTime()) ? `${written.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}, ${written.toISOString().slice(11, 16)} UTC` : dateLabel(ed.week)}. Prices and ratios inside each study are as of that moment, not today.</p>}
          {sectors.length > 1 && <div className="filters" role="group" aria-label="Sector"><button className="chip" aria-pressed={sector === ''} onClick={() => setSector('')}>All sectors</button>{sectors.map((x) => <button key={x} className="chip" aria-pressed={sector === x} onClick={() => { setSector(x); const first = ed?.studies.findIndex((y) => y.sector === x); if (first !== undefined && first >= 0) setOpen(first); }}>{x}</button>)}</div>}
          <div className="grid" style={{ gridTemplateColumns: 'minmax(220px, 300px) 1fr', alignItems: 'start' }}>
            <div className="list panel tight" style={{ position: 'sticky', top: 80 }}>
              {studies.map(({ x, i }) => (
                <button key={x.sym} className="li" style={{ textAlign: 'left', color: open === i ? 'var(--text)' : 'var(--muted)' }} onClick={() => setOpen(i)} aria-pressed={open === i}>
                  <div style={{ minWidth: 0 }}><div className="t">{x.name}</div><div className="s">{x.sector} · {x.read_minutes} min{x.corrections?.length ? ' · corrected' : ''}</div></div>
                  <span aria-hidden>{open === i ? '●' : ''}</span>
                </button>
              ))}
              {studies.length === 0 && <p className="dim" style={{ padding: 12, margin: 0 }}>No study in this sector this week.</p>}
            </div>
            {s && (
              <Rv key={s.sym} className="panel">
                <div className="eyebrow">{s.industry && s.industry !== s.sector ? `${s.sector} · ${s.industry}` : s.sector}</div>
                <h2 className="disp" style={{ fontSize: 'clamp(34px, 4vw, 52px)', margin: '12px 0 8px' }}>{s.name}</h2>
                <div className="dim num" style={{ fontSize: 13, marginBottom: 12 }}>{crore(s.mcap_cr)} · ₹{s.price.toLocaleString('en-IN')} at writing · <Link href={`/company/?s=${s.sym}`} style={{ color: 'var(--accent-2)' }}>full company page →</Link></div>
                <p className="dim" style={{ fontSize: 12.5, margin: '0 0 18px' }}>Machine-written{s.model ? ` (${s.model})` : ''} from the figures listed at the end. Not investment advice.</p>
                {s.corrections && s.corrections.length > 0 && <div className="notice" style={{ margin: '0 0 20px' }}><b>Corrected after publication.</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{s.corrections.map((c) => <li key={c.what}>{dateLabel(c.date)}: {c.what}</li>)}</ul></div>}
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
