'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Prose, { headingsOf, slug } from '@/components/Prose';
import { Async, PageHead, Rv, StatusChip } from '@/components/ui';
import { useFeed, useLive, useShard } from '@/lib/data';
import { priceLabel, priceView } from '@/lib/price';
import { crore, dateLabel, num, pct } from '@/lib/format';
import { companyHref } from '@/lib/slug';

/** The figures the study was written from, beside today's, so a reader never mistakes one for the other. */
function LatestFigures({ sym, price, mcap, writtenAt }: { sym: string; price: number; mcap: number; writtenAt: string | null }) {
  const sh = useShard(sym);
  const lv = useLive();
  const row = sh.data?.row;
  // the same rule as every price on the site (lib/price.ts): live when newer than the screen close, else the close
  const pv = row ? priceView(sym, row, lv.snap) : null;
  const now = pv?.price ?? null;
  const move = now !== null && price > 0 ? (now / price - 1) * 100 : null;
  return (
    <div className="grid g2" style={{ margin: '0 0 16px' }} role="group" aria-label="Figures at publication and latest figures">
      <div className="panel tight"><div className="eyebrow">At publication{writtenAt ? ` · ${dateLabel(writtenAt)}` : ''}</div><div className="num" style={{ marginTop: 6 }}>₹{num(price, 2)} · {crore(mcap)}</div><div className="dim" style={{ fontSize: 13.5 }}>What the study below was written from. It is not updated.</div></div>
      <div className="panel tight"><div className="eyebrow">Latest{pv ? ` · ${priceLabel(pv).text}` : ''}</div>
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
      <div className="read-progress" aria-hidden />
      <PageHead method="reads" eyebrow="Weekly reads" title="Seven companies," em="read from the numbers." />
      <section className="wrap">
        <Async loading={r.loading} error={r.error}>
          <div className="reads-bar">
            <label className="reads-ed"><span className="eyebrow">Edition</span>
              <select className="field" value={e} onChange={(ev) => { setE(Number(ev.target.value)); setOpen(0); setSector(''); }}>
                {r.data?.editions.map((x, i) => <option key={x.week} value={i}>Week of {dateLabel(x.week)}{i === 0 ? ' (latest)' : ''}</option>)}
              </select>
            </label>
            {ed && <p className="dim">Written {written && !Number.isNaN(written.getTime()) ? `${written.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}, ${written.toISOString().slice(11, 16)} UTC` : dateLabel(ed.week)}. Prices and ratios inside each study are as of that moment, not today.</p>}
          </div>
          {sectors.length > 1 && <div className="tabrow reads-sec" role="group" aria-label="Sector"><button className="chip" aria-pressed={sector === ''} onClick={() => setSector('')}>All sectors</button>{sectors.map((x) => <button key={x} className="chip" aria-pressed={sector === x} onClick={() => { setSector(x); const first = ed?.studies.findIndex((y) => y.sector === x); if (first !== undefined && first >= 0) setOpen(first); }}>{x}</button>)}</div>}
          <div className="reads-grid">
            <div className="list panel tight reads-list" role="group" aria-label={`${studies.length} ${studies.length === 1 ? 'study' : 'studies'} this week`}>
              {studies.map(({ x, i }) => (
                <button key={x.sym} className="li" style={{ textAlign: 'left' }} onClick={() => setOpen(i)} aria-pressed={open === i}>
                  <div style={{ minWidth: 0 }}><div className="t">{x.name}</div><div className="s">{x.sector} · {x.read_minutes} min{x.review?.status === 'under_review' ? ' · under review' : x.corrections?.length ? ' · corrected' : ''}</div></div>
                </button>
              ))}
              {studies.length === 0 && <p className="dim" style={{ padding: 12, margin: 0 }}>No study in this sector this week.</p>}
            </div>
            {s && (
              <Rv key={s.sym} className="panel reads-study">
                <div className="eyebrow">{s.industry && s.industry !== s.sector ? `${s.sector} · ${s.industry}` : s.sector}</div>
                <h2 className="disp" style={{ fontSize: 'clamp(34px, 4vw, 52px)', margin: '12px 0 8px' }}>{s.name}</h2>
                <div className="dim num" style={{ fontSize: 14, marginBottom: 12 }}>{crore(s.mcap_cr)} · ₹{s.price.toLocaleString('en-IN')} at writing · <Link href={companyHref(s.sym)} style={{ color: 'var(--accent-2)' }}>full company page →</Link></div>
                <p className="dim" style={{ fontSize: 13.5, margin: '0 0 18px' }}>Machine-written{s.model ? ` (${s.model})` : ''} from the figures listed at the end, and not reviewed by a person. {s.review?.status === 'machine_checked' ? `Passed Alpha's interpretation checks on ${dateLabel(s.review.checked_at)}. ` : ''}Not investment advice.</p>
                {s.review?.status === 'under_review' && (
                  <div className="notice warn" role="note" style={{ margin: '0 0 20px' }}>
                    <div><StatusChip kind="review">Under review</StatusChip> <b>Since {dateLabel(s.review.checked_at)}.</b> Alpha&apos;s checks found {s.review.problems.length === 1 ? 'a problem' : `${s.review.problems.length} problems`} in this study:</div>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{s.review.problems.map((p) => <li key={p}>{p}</li>)}</ul>
                    <div style={{ marginTop: 6 }}>The text below is kept exactly as published. A corrected study will be published as a new version; until then, do not rely on the sentences named above.</div>
                  </div>
                )}
                {s.corrections && s.corrections.some((c) => c.fix?.trim()) && <div className="notice" style={{ margin: '0 0 20px' }}><b>Corrected after publication.</b><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{s.corrections.filter((c) => c.fix?.trim()).map((c) => <li key={c.fix}>{dateLabel(c.date)}: {c.fix}</li>)}</ul></div>}
                <LatestFigures key={s.sym} sym={s.sym} price={s.price} mcap={s.mcap_cr} writtenAt={ed?.written_at ?? null} />
                {headingsOf(s.study).length > 1 && <nav aria-label="In this study" className="filters" style={{ margin: '0 0 18px' }}><span className="eyebrow">In this study</span>{headingsOf(s.study).map((h) => <a key={h} className="chip" href={`#${slug(h)}`}>{h}</a>)}</nav>}
                <Prose md={s.study} />
                <details style={{ marginTop: 28 }}><summary className="eyebrow" style={{ cursor: 'pointer' }}>The figures this was written from</summary>
                  <ul className="muted num" style={{ fontSize: 14, columns: 2, paddingLeft: 18 }}>{s.facts.map((f) => <li key={f}>{f}</li>)}</ul>
                </details>
              </Rv>
            )}
          </div>
          {r.data?.corrections && r.data.corrections.length > 0 && (
            <details className="panel tight" style={{ marginTop: 16 }} id="corrections">
              <summary className="eyebrow" style={{ cursor: 'pointer' }}>Corrections log · {r.data.corrections.length} {r.data.corrections.length === 1 ? 'entry' : 'entries'}</summary>
              <ul className="muted" style={{ fontSize: 14, paddingLeft: 18, margin: '8px 0 0', display: 'grid', gap: 6 }}>
                {r.data.corrections.map((c) => <li key={`${c.week}-${c.sym}`}><b style={{ color: 'var(--text)' }}>{c.sym}</b>, week of {dateLabel(c.week)} · {dateLabel(c.date)}: {c.issue}. {c.action}</li>)}
              </ul>
            </details>
          )}
        </Async>
      </section>
    </>
  );
}
