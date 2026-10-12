'use client';

import { useMemo } from 'react';
import { useEngines, useFeed, useRotation } from '@/lib/data';
import { dateLabel } from '@/lib/format';
import { describe, reconcile, type DataStatus, type DatasetInput } from '@/lib/status';

const TONE: Record<DataStatus['state'], string> = { current: 'up', delayed: 'warn', stale: 'down', partial: 'warn', missing: 'down', unavailable: 'down', error: 'down' };
const ICON: Record<DataStatus['state'], string> = { current: '●', delayed: '◐', stale: '○', partial: '◐', missing: '○', unavailable: '○', error: '✕' };

const refreshed = (s: string | null) => {
  if (!s) return 'not stated';
  if (s.length <= 10) return dateLabel(s);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}, ${d.toISOString().slice(11, 16)} UTC`;
};

/** Every dataset Alpha reads, with the session it describes and when it last refreshed, judged against the newest session among them. */
export function useDatasetStatus(): { items: DataStatus[]; loading: boolean } {
  const scr = useFeed('screen');
  const bar = useFeed('barometer');
  const eng = useEngines();
  const rot = useRotation();
  const items = useMemo<DataStatus[]>(() => {
    const list: DatasetInput[] = [];
    list.push(scr.data ? { id: 'screen', label: 'Screen', source: 'Alpha screen: company filings and Yahoo Finance prices', asOf: scr.data.breadth.as_of, refreshedAt: scr.data.built_on ?? null } : { id: 'screen', label: 'Screen', source: 'Alpha screen', asOf: null, refreshedAt: null, error: !!scr.error });
    list.push(bar.data ? { id: 'barometer', label: 'Barometer', source: 'Alpha market barometer: Nifty, India VIX and the screen universe', asOf: bar.data.today.nifty_date ?? null, refreshedAt: bar.data.generated_at ?? null } : { id: 'barometer', label: 'Barometer', source: 'Alpha market barometer', asOf: null, refreshedAt: null, error: !!bar.error });
    list.push(eng.data ? { id: 'engines', label: 'Engines', source: 'Alpha engines: models retrained on Yahoo Finance daily prices', asOf: eng.data.data_through, refreshedAt: eng.data.generated ?? null } : { id: 'engines', label: 'Engines', source: 'Alpha engines', asOf: null, refreshedAt: null, error: !!eng.error });
    list.push(rot.data ? { id: 'rotation', label: 'Rotation', source: 'Alpha group indices built from screened stocks, plus the NSE Nifty IT, Pharma and Bank indices', asOf: rot.data.dates[rot.data.dates.length - 1] ?? null, refreshedAt: rot.data.generated ?? null, note: 'Weekly: the last bar is the week ending on this date.' } : { id: 'rotation', label: 'Rotation', source: 'Alpha group indices', asOf: null, refreshedAt: null, error: !!rot.error });
    return reconcile(list);
  }, [scr.data, scr.error, bar.data, bar.error, eng.data, eng.error, rot.data, rot.error]);
  return { items, loading: scr.loading || bar.loading || eng.loading || rot.loading };
}

/** A compact stamp: dataset, session, state. The full source and refresh time are in the tooltip and in the Data status table on About. */
export function DataStamp({ ids, className }: { ids: string[]; className?: string }) {
  const { items, loading } = useDatasetStatus();
  const shown = ids.map((id) => items.find((i) => i.id === id)).filter((x): x is DataStatus => !!x);
  if (loading && !shown.some((s) => s.asOf)) return <div className={`stamp ${className ?? ''}`} aria-busy="true"><span className="dim">Checking data dates…</span></div>;
  return (
    <div className={`stamp ${className ?? ''}`} role="group" aria-label="Data dates">
      {shown.map((s) => (
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
    <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
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
