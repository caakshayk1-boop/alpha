'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSignals, useFeed, useLive, useRotation, useSummary } from '@/lib/data';
import { useBarometer } from '@/lib/useBarometer';
import { priceLabel } from '@/lib/price';
import { dateLabel } from '@/lib/format';
import Link from 'next/link';
import { describe, expectedSession, reconcile, sessionGaps, weekThrough, type DataStatus, type DatasetInput } from '@/lib/status';
import { noSessionDays } from '@/lib/plan';

const TONE: Record<DataStatus['state'], string> = { current: 'up', delayed: 'warn', stale: 'down', partial: 'warn', missing: 'down', unavailable: 'down', error: 'down' };
const ICON: Record<DataStatus['state'], string> = { current: '●', delayed: '◐', stale: '○', partial: '◐', missing: '○', unavailable: '○', error: '✕' };

const refreshed = (s: string | null) => {
  if (!s) return 'not stated';
  if (s.length <= 10) return dateLabel(s);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}, ${d.toISOString().slice(11, 16)} UTC`;
};

/** Every dataset Alpha reads, with the session it describes and when it last refreshed, judged against the session Alpha should already hold (see expectedSession). */
export function useDatasetStatus(): { items: DataStatus[]; loading: boolean } {
  // The screen's dates come from /api/summary (1 KB), not the 480 KB screen itself: a freshness stamp must not cost a page its speed.
  const scr = useSummary();
  const bar = useFeed('barometer');
  const baro = useBarometer();
  const eng = useSignals();
  const rot = useRotation();
  // Judged against the calendar (the session Alpha should already hold), not against its own newest dataset. Weekdays the market
  // itself shows had no trading (a gap in the Nifty's bars, or no trade at all in the live snapshot) are not sessions.
  const lv = useLive();
  const skip = useMemo(() => new Set([...sessionGaps(scr.data?.sessions), ...noSessionDays(lv.snap?.session, lv.snap ? Date.parse(lv.snap.fetchedAt) / 1000 : null)]), [scr.data?.sessions, lv.snap]);
  const expected = useMemo(() => expectedSession(new Date(), skip), [skip]);
  const items = useMemo<DataStatus[]>(() => {
    const list: DatasetInput[] = [];
    const lastWeek = rot.data?.dates[rot.data.dates.length - 1];
    const rotThrough = rot.data && lastWeek ? weekThrough(lastWeek, eng.data?.data_through ?? null, rot.data.generated ?? null) : null;
    list.push(scr.data ? { id: 'screen', label: 'Screen', source: 'Alpha screen: company filings and Yahoo Finance prices', asOf: scr.data.as_of, refreshedAt: scr.data.built_on ?? null } : { id: 'screen', label: 'Screen', source: 'Alpha screen', asOf: null, refreshedAt: null, error: !!scr.error });
    list.push(bar.data ? { id: 'barometer', label: 'Barometer', source: baro.view?.source === 'live' ? 'Computed live in Alpha from the Nifty, India VIX and every screened stock (same formula as the published reading)' : 'Alpha market barometer: Nifty, India VIX and the screen universe', asOf: baro.view?.session ?? bar.data.today.nifty_date ?? null, refreshedAt: baro.view?.source === 'live' && baro.view.at ? new Date(baro.view.at * 1000).toISOString() : bar.data.generated_at ?? null } : { id: 'barometer', label: 'Barometer', source: 'Alpha market barometer', asOf: null, refreshedAt: null, error: !!bar.error });
    list.push(eng.data ? { id: 'engines', label: 'Signals', source: 'Alpha Swing v2: rule book on Yahoo Finance daily prices', asOf: eng.data.data_through, refreshedAt: eng.data.generated ?? null } : { id: 'engines', label: 'Signals', source: 'Alpha Swing v2', asOf: null, refreshedAt: null, error: !!eng.error });
    list.push(rot.data ? { id: 'rotation', label: 'Rotation', source: 'Alpha group indices built from screened stocks, plus the NSE Nifty IT, Pharma and Bank indices', asOf: rotThrough?.through ?? null, refreshedAt: rot.data.generated ?? null, note: rotThrough?.inProgress ? 'The latest weekly point is the week in progress.' : undefined, cadence: 'weekly' } : { id: 'rotation', label: 'Rotation', source: 'Alpha group indices', asOf: null, refreshedAt: null, error: !!rot.error });
    return reconcile(list, expected, skip);
  }, [expected, skip, scr.data, scr.error, bar.data, bar.error, baro.view, eng.data, eng.error, rot.data, rot.error]);
  return { items, loading: scr.loading || bar.loading || eng.loading || rot.loading };
}

/** The "prices" stamp: what the stock prices on this page are, under the same rule as every price (lib/price.ts). "Prices ·
 *  10:26 IST live" while NSE is trading, otherwise "Prices · 15 Oct 2026 close". Without a live snapshot it falls back to the
 *  screen's close and says so in the tooltip. Only mounted where a page asks for it, so pages without prices start no poll. */
function PricesStamp({ screenAsOf }: { screenAsOf: string | null }) {
  const { snap, loading } = useLive();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  if (now === null || (loading && !screenAsOf)) return <span className="stamp-item" aria-busy="true"><span aria-hidden>○</span> <b>Prices</b> <span className="num">checking time</span> <em>status</em></span>;
  // the live snapshot only describes the day when it is a newer session than the screen (or the same one, which reads the same)
  const useSnap = !!snap && (!screenAsOf || snap.session >= screenAsOf);
  const l = useSnap ? priceLabel({ source: 'live', session: snap!.session, at: snap!.newest }, now) : priceLabel({ source: 'close', session: screenAsOf, at: null }, now);
  const [when, word] = l.live ? [l.text.replace(/^live /, ''), 'live'] : l.text.startsWith('last trade ') ? [l.text.replace(/^last trade /, ''), 'last trade'] : [l.text.replace(/ close$/, ''), 'close'];
  const src = useSnap ? `Yahoo Finance quotes for ${snap!.count} of ${snap!.universe} screened stocks, refreshed every minute while trading` : `Live quotes unavailable: prices are the screen's close`;
  return (
    <span className={`stamp-item${l.live ? ' up' : ''}`} title={`${src}. A price is labelled live only inside NSE hours with a trade in the last 15 minutes.`}>
      <span aria-hidden>{l.live ? '●' : '○'}</span> <b>Prices</b> <span className="num">{when}</span> <em>{word}</em>
    </span>
  );
}

/** A compact stamp: dataset, session, state. The full source and refresh time are in the tooltip and in the Data status table on About.
 *  The id "prices" adds the live-or-close price stamp (PricesStamp). */
export function DataStamp({ ids, className }: { ids: string[]; className?: string }) {
  const { items, loading } = useDatasetStatus();
  const prices = ids.includes('prices') ? <PricesStamp key="prices" screenAsOf={items.find((i) => i.id === 'screen')?.asOf ?? null} /> : null;
  ids = ids.filter((id) => id !== 'prices');
  const shown = ids.map((id) => items.find((i) => i.id === id)).filter((x): x is DataStatus => !!x);
  // A dataset still loading shows as "checking", never as "no date / unavailable" (that would be a false alarm), and its pill
  // has the same shape as the finished one so the row keeps its size (no layout shift).
  const checking = (label: string, key: string) => <span key={key} className="stamp-item" aria-busy="true"><span aria-hidden>○</span> <b>{label}</b> <span className="num">checking date</span> <em>status</em></span>;
  if (loading && !shown.some((s) => s.asOf)) return <div className={`stamp ${className ?? ''}`} role="group" aria-label="Checking data dates" tabIndex={0}>{prices}{ids.map((id) => checking(items.find((i) => i.id === id)?.label ?? id, id))}</div>;
  return (
    <div className={`stamp ${className ?? ''}`} role="group" aria-label="Data dates (scrolls sideways on small screens)" tabIndex={0}>
      {prices}
      {shown.map((s) => (loading && !s.asOf && s.state !== 'error' ? checking(s.label, s.id) :
        <span key={s.id} className={`stamp-item ${TONE[s.state]}`} title={`${s.source}. Describes: ${s.asOf ? dateLabel(s.asOf) : 'no session date'}. Last refreshed: ${refreshed(s.refreshedAt)}.${s.note ? ` ${s.note}` : ''}`}>
          <span aria-hidden>{ICON[s.state]}</span> <b>{s.label}</b> <span className="num">{s.asOf ? dateLabel(s.asOf) : 'no date'}</span> <em>{describe(s)}</em>
        </span>
      ))}
    </div>
  );
}

export function DataStatusTable() {
  const { items, loading } = useDatasetStatus();
  if (loading && !items.some((i) => i.asOf)) return <p className="dim">Reading the data dates…</p>;
  return (
    <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)" style={{ maxHeight: 'none' }}>
      <table className="tbl" style={{ minWidth: 640 }}>
        <thead><tr><th>Dataset</th><th>Describes (session or week)</th><th>Last refreshed</th><th>State</th><th>Source</th></tr></thead>
        <tbody>
          {items.map((s) => (
            <tr key={s.id} style={{ cursor: 'default' }}>
              <td><b>{s.label}</b></td>
              <td className="num">{s.asOf ? dateLabel(s.asOf) : 'not stated'}</td>
              <td className="num">{refreshed(s.refreshedAt)}</td>
              <td><span className={`tag ${TONE[s.state]}`}>{ICON[s.state]} {describe(s)}</span></td>
              <td className="dim" style={{ whiteSpace: 'normal', minWidth: 220 }}>{s.source}{s.note ? ` ${s.note}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One line under the header, on every page, when a core dataset is behind the calendar. Silent when everything is on schedule, so it
 *  means something when it shows. A one-session gap may be an exchange holiday (Alpha holds no holiday calendar) or a late update. */
export function FreshnessBanner() {
  const { items, loading } = useDatasetStatus();
  if (loading) return null;
  const behind = items.filter((i) => i.state !== 'current');
  if (behind.length === 0) return null;
  const serious = behind.some((i) => i.state === 'stale' || i.state === 'error' || i.state === 'unavailable' || i.state === 'missing');
  // Datasets that share a status read as one sentence: "Screen, Barometer and Engines are stale: 3 sessions behind ...".
  const groups = new Map<string, DataStatus[]>();
  for (const i of behind) groups.set(`${describe(i)}|${i.asOf ?? ''}`, [...(groups.get(`${describe(i)}|${i.asOf ?? ''}`) ?? []), i]);
  const join = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  const parts = [...groups.values()].map((g) => {
    const first = g[0];
    const names = join(g.map((x) => x.label));
    const when = first.asOf ? ` (describes ${dateLabel(first.asOf)})` : '';
    return first.state === 'error' ? `${names} could not be loaded` : `${names} ${g.length > 1 ? 'are' : 'is'} ${describe(first)}${when}`;
  });
  return (
    <div className={`fresh ${serious ? 'down' : 'warn'}`} role="status">
      <div className="wrap">
        <span className="fresh-t" title={`${parts.join('; ')}.`}><b>{serious ? 'Some data is out of date. ' : 'Data check. '}</b>{parts.join('; ')}.</span>
        <Link href="/about/#data-dates">Data dates</Link>
      </div>
    </div>
  );
}

/** The one global freshness indicator (brief §7.5): a pill in the header. Silent green when every core dataset is on schedule;
 *  otherwise it names how many are behind, and the full sentence is its label and tooltip. Each page warns locally only where a
 *  figure it shows is affected; the detail lives in Method → Data dates. */
export function FreshnessPill() {
  const { items, loading } = useDatasetStatus();
  if (loading) return <span className="fresh-pill" aria-hidden><i style={{ background: 'var(--line-2)' }} />Data</span>;
  const behind = items.filter((i) => i.state !== 'current');
  const serious = behind.some((i) => i.state === 'stale' || i.state === 'error' || i.state === 'unavailable' || i.state === 'missing');
  const sentence = behind.length
    ? behind.map((i) => (i.state === 'error' ? `${i.label} could not be loaded` : `${i.label} ${describe(i)}${i.asOf ? ` (describes ${dateLabel(i.asOf)})` : ''}`)).join('; ')
    : `Every core dataset is on schedule: ${items.map((i) => `${i.label} ${i.asOf ? dateLabel(i.asOf) : ''}`.trim()).join(', ')}`;
  const word = !behind.length ? 'Data current' : `${behind.length} ${behind.length === 1 ? 'dataset' : 'datasets'} behind`;
  return (
    <Link href="/about/#data-dates" className={`fresh-pill${behind.length ? (serious ? ' bad' : ' warn') : ''}`} title={`${sentence}.`} aria-label={`${word}. ${sentence}. Open the data dates.`}>
      <i aria-hidden />{word}
    </Link>
  );
}
