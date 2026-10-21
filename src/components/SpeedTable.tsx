'use client';

// The field speed report (Pro §31) from /api/rum: the 75th percentile per page type over the last 7 days, from sampled,
// anonymous readings (worker/rum.js). A figure from fewer than MIN readings is shown as too few, never as a measurement.
import { useEffect, useState } from 'react';
import { num } from '@/lib/format';

type Cell = { at_most?: number; over?: number; n: number; rating: string };
type Report = { ok: boolean; days: number; routes: Record<string, Partial<Record<'phone' | 'desktop', Record<string, Cell>>>> };
const MIN = 20;
const COLS: [string, string, boolean][] = [['lcp', 'Largest paint', true], ['inp', 'Response to input', true], ['cls', 'Layout shift', false], ['ttfb', 'First byte', true]];
const LABEL: Record<string, string> = { '/': 'Today', '/company/[slug]/': 'Company pages' };

const fmt = (c: Cell | undefined, ms: boolean) => {
  if (!c) return '—';
  if (c.n < MIN) return `too few (${c.n})`;
  const v = c.at_most ?? c.over ?? 0;
  const s = ms ? (v >= 1000 ? `${num(v / 1000, 1)} s` : `${num(v, 0)} ms`) : num(v, 2);
  return `${c.at_most !== undefined ? '≤' : '>'} ${s}`;
};
const tone = (c: Cell | undefined) => (!c || c.n < MIN ? 'dim' : c.rating === 'good' ? 'up' : c.rating === 'poor' ? 'down' : 'warn');

export default function SpeedTable() {
  const [r, setR] = useState<Report | null | 'error'>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/rum').then((x) => (x.ok ? x.json() : Promise.reject(new Error(String(x.status))))).then((j: Report) => { if (live) setR(j); }, () => { if (live) setR('error'); });
    return () => { live = false; };
  }, []);
  if (r === null) return <p className="dim">Loading the speed readings…</p>;
  if (r === 'error' || !r.ok) return <p className="dim">The speed readings could not be loaded.</p>;
  const rows = Object.entries(r.routes).flatMap(([route, devs]) => (['phone', 'desktop'] as const).filter((d) => devs[d]).map((d) => ({ route, d, m: devs[d]! }))).sort((a, b) => (a.route < b.route ? -1 : a.route > b.route ? 1 : a.d < b.d ? 1 : -1));
  if (!rows.length) return <p className="dim">No readings in the last 7 days yet.</p>;
  return (
    <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Page speed by page type">
      <table className="tbl">
        <caption className="sr">75th percentile of sampled page loads, last 7 days</caption>
        <thead><tr><th scope="col">Page</th><th scope="col">Device</th>{COLS.map(([k, l]) => <th key={k} scope="col" className="num">{l}</th>)}</tr></thead>
        <tbody>{rows.map(({ route, d, m }) => (
          <tr key={`${route}${d}`}><td>{LABEL[route] ?? route}</td><td className="dim">{d}</td>{COLS.map(([k, , ms]) => <td key={k} className={`num ${tone(m[k])}`}>{fmt(m[k], ms)}{m[k] && m[k].n >= MIN && <span className="dim" style={{ display: 'block', fontSize: 12 }}>{m[k].rating}</span>}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}
