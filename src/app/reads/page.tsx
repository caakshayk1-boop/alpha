'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Prose, { headingsOf, slug } from '@/components/Prose';
import { Async, PageHead, Rv } from '@/components/ui';
import { useFeed, useShard } from '@/lib/data';
import { crore, dateLabel, num, pct } from '@/lib/format';

/** The figures the study was written from, beside today's, so a reader never mistakes one for the other. */
function LatestFigures({ sym, price, mcap, writtenAt }: { sym: string; price: number; mcap: number; writtenAt: string | null }) {
  const sh = useShard(sym);
  const row = sh.data?.row;
  const now = typeof row?.price === 'number' ? row.price : null;
  const move = now !== null && price > 0 ? (now / price - 1) * 100 : null;
  return (
    <div className="grid g2" style={{ margin: '0 0 16px' }} role="group" aria-label="Figures at publication and latest figures">
      <div className="panel tight"><div className="eyebrow">At publication{writtenAt ? ` · ${dateLabel(writtenAt)}` : ''}</div><div className="num" style={{ marginTop: 6 }}>₹{num(price, 2)} · {crore(mcap)}</div><div className="dim" style={{ fontSize: 13.5 }}>What the study below was written from. It is not updated.</div></div>
      <div className="panel tight"><div className="eyebrow">Latest{row?.last_date ? ` · ${dateLabel(row.last_date)}` : ''}</div>
        {sh.loading ? <div className="dim" style={{ marginTop: 6 }}>Loading…</div> : now === null ? <div className="dim" style={{ marginTop: 6 }}>Latest figures are not available for this company.</div> : <div className="num" style={{ marginTop: 6 }}>₹{num(now, 2)}</div>}
        {move !== null && <div className="dim" style={{ fontSize: 13.5 }}>{pct(move, 1)} in price since publication. Market cap is not shown here: the screen&apos;s figure is not recalculated with the price. The study&apos;s text does not change.</div>}
      </div>
    </div>
  );
}

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
      <PageHead variant="editorial" eyebrow="Weekly reads" title="Seven companies," em="read from the numbers." lede="One sector a week, every Saturday: what they sell, how the money works, and what would break it. Figures come from the screen. The prose is written by a language model from those figures and checked automatically for arithmetic. Business descriptions are the model's general knowledge unless a source is cited. It is not analyst research, and corrections are listed on each study." />
      <section className="wrap">
        <Async loading={r.loading} error={r.error}>
          <div className="filters" role="group" aria-label="Edition">
            {r.data?.editions.map((x, i) => <button key={x.week} className="chip" aria-pressed={e === i} onClick={() => { setE(i); setOpen(0); setSector(''); }}>Week of {dateLabel(x.week)}</button>)}
          </div>
          {ed && <p className="dim" style={{ fontSize: 13.5, margin: '0 0 12px' }}>Written {written && !Number.isNaN(written.getTime()) ? `${written.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}, ${written.toISOString().slice(11, 16)} UTC` : dateLabel(ed.week)}. Prices and ratios inside each study are as of that moment, not today.</p>}
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
                <div className="dim num" style={{ fontSize: 14, marginBottom: 12 }}>{crore(s.mcap_cr)} · ₹{s.price.toLocaleString('en-IN')} at writing · <Link href={`/company/?s=${s.sym}`} style={{ color: 'var(--accent-2)' }}>full company page →</Link></div>
                <p className="dim" style={{ fontSize: 13.5, margin: '0 0 18px' }}>Machine-written{s.model ? ` (${s.model})` : ''} from the figures listed at the end. Not investment advice.</p>
                {s.corrections && s.corrections.some((c) => c.fix?.trim()) && <div className="notice" style={{ margin: '0 0 20px' }}><b>Corrected after publication.</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{s.corrections.filter((c) => c.fix?.trim()).map((c) => <li key={c.fix}>{dateLabel(c.date)}: {c.fix}</li>)}</ul></div>}
                <LatestFigures key={s.sym} sym={s.sym} price={s.price} mcap={s.mcap_cr} writtenAt={ed?.written_at ?? null} />
                <p className="dim" style={{ fontSize: 13.5, margin: '0 0 14px' }}>Review: automatic arithmetic and name checks only. Figures are as at publication; for today&apos;s figures open the company page.</p>
                {headingsOf(s.study).length > 1 && <nav aria-label="In this study" className="filters" style={{ margin: '0 0 18px' }}><span className="eyebrow">In this study</span>{headingsOf(s.study).map((h) => <a key={h} className="chip" href={`#${slug(h)}`}>{h}</a>)}</nav>}
                <Prose md={s.study} />
                <details style={{ marginTop: 28 }}><summary className="eyebrow" style={{ cursor: 'pointer' }}>The figures this was written from</summary>
                  <ul className="muted num" style={{ fontSize: 14, columns: 2, paddingLeft: 18 }}>{s.facts.map((f) => <li key={f}>{f}</li>)}</ul>
                </details>
              </Rv>
            )}
          </div>
        </Async>
      </section>
      {/* Raw text on purpose: React escapes `>` inside a <style> child on the server but not in the browser, which failed hydration. */}
      <style dangerouslySetInnerHTML={{ __html: '@media (max-width: 860px) { .wrap > .grid[style] { grid-template-columns: 1fr !important; } .wrap > .grid > .list { position: static !important; } }' }} />
    </>
  );
}
