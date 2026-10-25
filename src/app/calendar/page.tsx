'use client';
// Calendar: results dates on file for the next days, by day. Every date in the screen feed is an estimate the pipeline holds,
// not an exchange confirmation, so each one says "estimated", links to where it can be confirmed, and none is offered as a
// reminder (E12). "Next 7 days" is today and the six days after it, and the page prints both ends (E13, lib/support.ts).

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PageHead, Skel } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { crore, dateLabel } from '@/lib/format';
import { plural } from '@/lib/status';
import { daysBetween, inWindow, windowEnd } from '@/lib/support';
import { useStoredList } from '@/lib/store';
import type { Row } from '@/lib/types';
import { companyHref } from '@/lib/slug';

const WINDOWS = [7, 14, 30, 60] as const;
const nseFilings = (sym: string) => `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(sym)}`;
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });

export default function Calendar() {
  const s = useFeed('screen');
  const [watch] = useStoredList('alpha-watchlist');
  const [span, setSpan] = useState<number>(14);
  const [tier, setTier] = useState('');
  const [sector, setSector] = useState('');
  const [mine, setMine] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })), []);
  const rows = useMemo(() => s.data?.rows ?? [], [s.data]);
  const sectors = useMemo(() => Array.from(new Set(rows.map((r) => r.sector).filter(Boolean))).sort(), [rows]);
  const withDate = useMemo(() => rows.filter((r) => r.next_earnings).length, [rows]);
  const w = useMemo(() => new Set(watch), [watch]);
  const days = useMemo(() => {
    if (!today) return [];
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const d = r.next_earnings;
      if (!d || !inWindow(daysBetween(today, d), span)) continue;
      if (tier && r.tier !== tier) continue;
      if (sector && r.sector !== sector) continue;
      if (mine && !w.has(r.sym)) continue;
      m.set(d, [...(m.get(d) ?? []), r]);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, l]) => [d, l.sort((a, b) => Number(w.has(b.sym)) - Number(w.has(a.sym)) || (b.mcap_cr ?? 0) - (a.mcap_cr ?? 0))] as const);
  }, [rows, today, span, tier, sector, mine, w]);
  const total = days.reduce((t, [, l]) => t + l.length, 0);
  const followedIn = days.reduce((t, [, l]) => t + l.filter((r) => w.has(r.sym)).length, 0);
  const end = today ? windowEnd(today, span) : null;
  const filtered = !!(tier || sector || mine);

  return (
    <div className="sp">
      <PageHead method="calendar" eyebrow="Calendar" title="Results dates," em="estimated, by day." />
      <section className="wrap">
        <div className="sp-status" role="group" aria-label="What these dates are">
          <div><span className="k">Status of every date</span><span className="v"><span className="pill warn">Estimated</span></span><span className="n">Held by the screen feed; not confirmed by the exchange</span></div>
          <div><span className="k">Window</span><span className="v">{today && end ? `${dateLabel(today)} to ${dateLabel(end)}` : '…'}</span><span className="n">Today and the next {span - 1} days, both ends included (India time)</span></div>
          <div><span className="k">Dates on file</span><span className="v num">{s.data ? `${withDate} of ${rows.length}` : '…'}</span><span className="n">companies in the screen have a date</span></div>
          <div><span className="k">Confirm a date</span><span className="v"><a className="link" href="https://www.nseindia.com/companies-listing/corporate-filings-board-meetings" target="_blank" rel="noopener noreferrer">NSE board meetings ↗</a></span><span className="n">The company&apos;s own filing is the only confirmation</span></div>
        </div>

        <div className="sp-controls">
          <div className="sp-seg" role="group" aria-label="How far ahead">{WINDOWS.map((n) => <button key={n} type="button" aria-pressed={span === n} onClick={() => setSpan(n)}>Next {n} days</button>)}</div>
          <div className="sp-chips" role="group" aria-label="Filter">
            {watch.length > 0 && <button type="button" className="sp-chip" aria-pressed={mine} onClick={() => setMine((v) => !v)}>Following only</button>}
            {['large', 'mid', 'small'].map((t) => <button key={t} type="button" className="sp-chip" aria-pressed={tier === t} onClick={() => setTier(tier === t ? '' : t)}>{t[0].toUpperCase() + t.slice(1)} cap</button>)}
          </div>
          <label className="sr" htmlFor="cal-sec">Sector</label>
          <select id="cal-sec" className="field cal-sec" value={sector} onChange={(e) => setSector(e.target.value)}><option value="">All sectors</option>{sectors.map((x) => <option key={x}>{x}</option>)}</select>
        </div>

        {s.loading || !today ? <div className="sp-stack" aria-busy="true"><Skel h={120} /><Skel h={120} /></div>
          : s.error ? <div className="state"><b>The results dates did not load.</b><p>They come with the screen ({s.error}). A refresh usually brings them back.</p><div className="acts"><button type="button" className="act" onClick={() => window.location.reload()}>Refresh</button></div></div>
            : (
              <>
                <p className="sp-statusline" role="status"><b className="num">{plural(total, 'estimated date')}</b> in the window{watch.length > 0 ? <>, <b className="num">{followedIn}</b> for companies you follow</> : ''}. Largest companies first; names you follow lead each day.</p>
                {days.length === 0 ? (
                  <div className="state"><b>No results date on file from {dateLabel(today)} to {end ? dateLabel(end) : ''}{filtered ? ' for these filters' : ''}.</b><p>{filtered ? 'Widen the filters or the window.' : 'A longer window may hold dates; a company with no date on file is not listed at all.'}</p><div className="acts">{filtered && <button type="button" className="act" onClick={() => { setTier(''); setSector(''); setMine(false); }}>Clear filters</button>}{span < 60 && <button type="button" className="act quiet" onClick={() => setSpan(60)}>Next 60 days</button>}</div></div>
                ) : (
                  <ol className="cal-days">
                    {days.map(([d, list]) => {
                      const n = daysBetween(today, d);
                      return (
                        <li key={d} className="card cal-day">
                          <div className="cal-dh">
                            <div><h2 className="cal-date num">{dateLabel(d)}</h2><span className="sp-note">{weekday(d)} · {n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${plural(n, 'day')}`} · estimated</span></div>
                            <span className="pill nodot num">{plural(list.length, 'company', 'companies')}</span>
                          </div>
                          <ul className="rows cal-list">
                            {list.slice(0, 12).map((r) => (
                              <li key={r.sym} className="row cal-row">
                                <Link href={companyHref(r.sym)} className="cal-co"><span className="row-t">{r.sym}{w.has(r.sym) && <span className="pill acc nodot cal-f">Following</span>}</span><span className="row-s">{r.name} · {crore(r.mcap_cr)}</span></Link>
                                <a className="link cal-src" href={nseFilings(r.sym)} target="_blank" rel="noopener noreferrer" aria-label={`Check ${r.sym}'s filings on NSE (opens in a new tab)`}>Filings on NSE ↗</a>
                              </li>
                            ))}
                          </ul>
                          {list.length > 12 && <details className="cal-more"><summary>{list.length - 12} smaller {list.length - 12 === 1 ? 'company' : 'companies'}</summary><p className="cal-chips">{list.slice(12).map((r) => <Link key={r.sym} className="sp-chip" href={companyHref(r.sym)}>{r.sym}</Link>)}</p></details>}
                        </li>
                      );
                    })}
                  </ol>
                )}
                <p className="sp-note cal-foot">No date here is a confirmed reminder: the pipeline does not say where it found each date, so the page cannot call one confirmed. Open the company&apos;s filings before planning around it.</p>
              </>
            )}
      </section>
    </div>
  );
}
