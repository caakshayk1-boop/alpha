'use client';

import { useMemo } from 'react';
import { useEngines, useFeed, useRotation, useSummary } from '@/lib/data';
import { dateLabel } from '@/lib/format';
import Link from 'next/link';
import { describe, expectedSession, reconcile, weekThrough, type DataStatus, type DatasetInput } from '@/lib/status';

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
  const eng = useEngines();
  const rot = useRotation();
  // Judged against the calendar (the session Alpha should already hold), not against its own newest dataset.
  const expected = useMemo(() => expectedSession(new Date()), []);
  const items = useMemo<DataStatus[]>(() => {
    const list: DatasetInput[] = [];
    const lastWeek = rot.data?.dates[rot.data.dates.length - 1];
    const rotThrough = rot.data && lastWeek ? weekThrough(lastWeek, eng.data?.data_through ?? null, rot.data.generated ?? null) : null;
    list.push(scr.data ? { id: 'screen', label: 'Screen', source: 'Alpha screen: company filings and Yahoo Finance prices', asOf: scr.data.as_of, refreshedAt: scr.data.built_on ?? null } : { id: 'screen', label: 'Screen', source: 'Alpha screen', asOf: null, refreshedAt: null, error: !!scr.error });
    list.push(bar.data ? { id: 'barometer', label: 'Barometer', source: 'Alpha market barometer: Nifty, India VIX and the screen universe', asOf: bar.data.today.nifty_date ?? null, refreshedAt: bar.data.generated_at ?? null } : { id: 'barometer', label: 'Barometer', source: 'Alpha market barometer', asOf: null, refreshedAt: null, error: !!bar.error });
    list.push(eng.data ? { id: 'engines', label: 'Engines', source: 'Alpha engines: models retrained on Yahoo Finance daily prices', asOf: eng.data.data_through, refreshedAt: eng.data.generated ?? null } : { id: 'engines', label: 'Engines', source: 'Alpha engines', asOf: null, refreshedAt: null, error: !!eng.error });
    list.push(rot.data ? { id: 'rotation', label: 'Rotation', source: 'Alpha group indices built from screened stocks, plus the NSE Nifty IT, Pharma and Bank indices', asOf: rotThrough?.through ?? null, refreshedAt: rot.data.generated ?? null, note: rotThrough?.inProgress ? 'The latest weekly point is the week in progress.' : undefined } : { id: 'rotation', label: 'Rotation', source: 'Alpha group indices', asOf: null, refreshedAt: null, error: !!rot.error });
    return reconcile(list, expected);
  }, [expected, scr.data, scr.error, bar.data, bar.error, eng.data, eng.error, rot.data, rot.error]);
  return { items, loading: scr.loading || bar.loading || eng.loading || rot.loading };
}

/** A compact stamp: dataset, session, state. The full source and refresh time are in the tooltip and in the Data status table on About. */
export function DataStamp({ ids, className }: { ids: string[]; className?: string }) {
  const { items, loading } = useDatasetStatus();
  const shown = ids.map((id) => items.find((i) => i.id === id)).filter((x): x is DataStatus => !!x);
  // A dataset still loading shows as "checking", never as "no date / unavailable" (that would be a false alarm), and its pill
  // has the same shape as the finished one so the row keeps its size (no layout shift).
  const checking = (label: string, key: string) => <span key={key} className="stamp-item" aria-busy="true"><span aria-hidden>○</span> <b>{label}</b> <span className="num">checking date</span> <em>status</em></span>;
  if (loading && !shown.some((s) => s.asOf)) return <div className={`stamp ${className ?? ''}`} aria-label="Checking data dates">{ids.map((id) => checking(items.find((i) => i.id === id)?.label ?? id, id))}</div>;
  return (
    <div className={`stamp ${className ?? ''}`} role="group" aria-label="Data dates">
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
        <b>{serious ? 'Some data is out of date. ' : 'Data check. '}</b>
        {parts.join('; ')}.
        {!serious && ' This can be an exchange holiday or a late update.'}{' '}
        <Link href="/about/#data-dates">See every data date</Link>
      </div>
    </div>
  );
}
