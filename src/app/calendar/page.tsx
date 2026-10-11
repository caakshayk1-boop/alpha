'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Async, PageHead, Rv } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { crore, dateLabel } from '@/lib/format';
import type { Row } from '@/lib/types';

const daysUntil = (iso: string) => Math.round((new Date(`${iso}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 864e5);

export default function Calendar() {
  const s = useFeed('screen');
  const [window, setWindow] = useState(30);
  const [tier, setTier] = useState('');
  const [sector, setSector] = useState('');
  const sectors = useMemo(() => Array.from(new Set((s.data?.rows ?? []).map((r) => r.sector).filter(Boolean))).sort(), [s.data]);
  const days = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of s.data?.rows ?? []) {
      const d = r.next_earnings;
      if (!d || daysUntil(d) < 0 || daysUntil(d) > window) continue;
      if (tier && r.tier !== tier) continue;
      if (sector && r.sector !== sector) continue;
      m.set(d, [...(m.get(d) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, l]) => [d, l.sort((a, b) => (b.mcap_cr ?? 0) - (a.mcap_cr ?? 0))] as const);
  }, [s.data, window, tier, sector]);
  const total = days.reduce((t, [, l]) => t + l.length, 0);
  return (
    <>
      <PageHead eyebrow="Calendar" title="Results season," em="by the day." lede="The next results date on file for each screened company, largest first. Dates come from the company's own announcements and are the exchange's to change." />
      <section className="wrap">
        <div className="filters">
          {[7, 14, 30, 60].map((n) => <button key={n} className="chip" aria-pressed={window === n} onClick={() => setWindow(n)}>Next {n} days</button>)}
          {['large', 'mid', 'small'].map((t) => <button key={t} className="chip" aria-pressed={tier === t} onClick={() => setTier(tier === t ? '' : t)}>{t[0].toUpperCase() + t.slice(1)} cap</button>)}
          <select className="field" aria-label="Sector" value={sector} onChange={(e) => setSector(e.target.value)}><option value="">All sectors</option>{sectors.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
        <p className="muted" style={{ margin: '0 0 14px' }}>{total} results dates in the window.</p>
        <Async loading={s.loading} error={s.error} rows={4}>
          <div className="grid">
            {days.map(([d, list]) => (
              <Rv key={d} className="panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <div className="disp" style={{ fontSize: 28 }}>{dateLabel(d)}</div>
                  <span className="num dim" style={{ fontSize: 12.5 }}>{daysUntil(d) === 0 ? 'today' : `in ${daysUntil(d)} days`} · {list.length} companies</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  {list.slice(0, 30).map((r) => <Link key={r.sym} className="chip" href={`/company/?s=${r.sym}`} title={`${r.name} · ${crore(r.mcap_cr)}`}>{r.sym}</Link>)}
                  {list.length > 30 && <span className="dim" style={{ fontSize: 12.5, alignSelf: 'center' }}>+{list.length - 30} smaller</span>}
                </div>
              </Rv>
            ))}
            {days.length === 0 && <p className="notice">No results dates in this window for these filters.</p>}
          </div>
        </Async>
      </section>
    </>
  );
}
