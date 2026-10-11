'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Async, Chg, PageHead } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { dash, num } from '@/lib/format';
import { canAnimate, Flip } from '@/lib/motion';
import type { Row } from '@/lib/types';

type Key = 'comp' | 'q' | 'g' | 'v' | 'roce' | 'pe' | 'de' | 'r1d' | 'r1m' | 'r1y' | 'mcap_cr' | 'div_yield' | 'price';
interface Preset { id: string; label: string; hint: string; test: (r: Row) => boolean }

const has = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
const PRESETS: Preset[] = [
  { id: 'quality', label: 'Quality compounders', hint: 'ROCE 20%+ and debt to equity 0.5 or less', test: (r) => has(r.roce) && r.roce >= 20 && has(r.de) && r.de <= 0.5 },
  { id: 'value', label: 'Cheap and healthy', hint: 'P/E under 15 (positive) and ROCE 15%+', test: (r) => has(r.pe) && r.pe > 0 && r.pe < 15 && has(r.roce) && r.roce >= 15 },
  { id: 'debtfree', label: 'Debt-free', hint: 'Debt to equity 0.1 or less', test: (r) => has(r.de) && r.de <= 0.1 },
  { id: 'income', label: 'Dividend income', hint: 'Dividend yield 2% or more', test: (r) => has(r.div_yield) && r.div_yield >= 2 },
  { id: 'trend', label: 'In an uptrend', hint: 'Above its 50 and 200-day averages, ahead of the Nifty over 3 months', test: (r) => has(r.price) && has(r.sma50) && has(r.sma200) && r.price > r.sma50 && r.price > r.sma200 && has(r.rs3m) && r.rs3m > 0 },
  { id: 'vetted', label: 'Vetted', hint: 'Passes the screen’s data-quality and balance-sheet checks', test: (r) => r.vet?.s === 'cleared' },
  { id: 'ahimsa', label: 'Ahimsa 500', hint: 'In NSE’s Nifty500 Ahimsa index', test: (r) => r.ahimsa === true },
];

const COLS: { k: Key; label: string; cell: (r: Row) => React.ReactNode }[] = [
  { k: 'price', label: 'Price', cell: (r) => <span className="num">₹{num(r.price, 2)}</span> },
  { k: 'r1d', label: '1D', cell: (r) => <Chg v={r.r1d} dp={1} /> },
  { k: 'r1m', label: '1M', cell: (r) => <Chg v={r.r1m} dp={1} /> },
  { k: 'r1y', label: '1Y', cell: (r) => <Chg v={r.r1y} dp={1} /> },
  { k: 'pe', label: 'P/E', cell: (r) => <span className="num">{has(r.pe) ? r.pe.toFixed(1) : dash}</span> },
  { k: 'roce', label: 'ROCE', cell: (r) => <span className="num">{has(r.roce) ? `${r.roce.toFixed(1)}%` : dash}</span> },
  { k: 'de', label: 'D/E', cell: (r) => <span className="num">{has(r.de) ? r.de.toFixed(2) : dash}</span> },
  { k: 'q', label: 'Quality', cell: (r) => <span className="num">{has(r.q) ? Math.round(r.q) : dash}</span> },
  { k: 'g', label: 'Growth', cell: (r) => <span className="num">{has(r.g) ? Math.round(r.g) : dash}</span> },
  { k: 'v', label: 'Value', cell: (r) => <span className="num">{has(r.v) ? Math.round(r.v) : dash}</span> },
  { k: 'comp', label: 'Composite', cell: (r) => <b className="num">{has(r.comp) ? Math.round(r.comp) : dash}</b> },
];

const PAGE = 60;

export default function Screen() {
  const s = useFeed('screen');
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sector, setSector] = useState('');
  const [preset, setPreset] = useState<string>('');
  const [sort, setSort] = useState<Key>('comp');
  const [dir, setDir] = useState<1 | -1>(-1);
  const [limit, setLimit] = useState(PAGE);
  const body = useRef<HTMLTableSectionElement>(null);
  const flipState = useRef<ReturnType<typeof Flip.getState> | null>(null);

  const sectors = useMemo(() => Array.from(new Set((s.data?.rows ?? []).map((r) => r.sector).filter(Boolean))).sort(), [s.data]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const p = PRESETS.find((x) => x.id === preset);
    const list = (s.data?.rows ?? []).filter((r) => (!term || r.sym.toLowerCase().includes(term) || r.name.toLowerCase().includes(term)) && (!sector || r.sector === sector) && (!p || p.test(r)));
    return list.sort((a, b) => {
      const av = (a[sort] as number | null | undefined) ?? null;
      const bv = (b[sort] as number | null | undefined) ?? null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1; // missing always last, whichever way we sort
      if (bv === null) return -1;
      return (av - bv) * dir;
    });
  }, [s.data, q, sector, preset, sort, dir]);

  // FLIP: capture row positions before a re-sort commits, animate from them after.
  const captureFlip = () => {
    if (body.current && canAnimate()) flipState.current = Flip.getState(body.current.querySelectorAll('tr'));
  };
  useEffect(() => {
    if (flipState.current && body.current) {
      Flip.from(flipState.current, { duration: 0.6, ease: 'power3.inOut', absolute: false, nested: false, onComplete: () => undefined });
      flipState.current = null;
    }
  }, [sort, dir, preset]);

  const setSortKey = (k: Key) => {
    captureFlip();
    if (k === sort) setDir((d) => (d === 1 ? -1 : 1));
    else { setSort(k); setDir(k === 'pe' || k === 'de' ? 1 : -1); }
    setLimit(PAGE);
  };
  const active = PRESETS.find((p) => p.id === preset);

  return (
    <>
      <PageHead eyebrow={`Screen · ${s.data ? num(s.data.count) : 'Indian'} companies`} title="Every name," em="filterable." lede="Price, trend, quality and value for each company, scored from filings and exchange data. Pick a lens or search, then sort by anything." />
      <section className="wrap">
        <div className="filters">
          <input className="field" placeholder="Search name or symbol" aria-label="Search companies" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
          <select className="field" aria-label="Sector" value={sector} onChange={(e) => { setSector(e.target.value); setLimit(PAGE); }}>
            <option value="">All sectors</option>
            {sectors.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        <div className="filters" role="group" aria-label="Lenses">
          {PRESETS.map((p) => <button key={p.id} className="chip" aria-pressed={preset === p.id} title={p.hint} onClick={() => { captureFlip(); setPreset(preset === p.id ? '' : p.id); setLimit(PAGE); }}>{p.label}</button>)}
        </div>
        <p className="muted" style={{ margin: '0 0 12px', minHeight: 24, fontSize: 14 }} aria-live="polite">
          {active ? <><b style={{ color: 'var(--text)' }}>{active.label}:</b> {active.hint}. </> : null}
          <span className="num">{num(rows.length)}</span> match{rows.length === 1 ? '' : 'es'}.
        </p>
        <Async loading={s.loading} error={s.error} rows={6}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col" style={{ minWidth: 230 }}>Company</th>
                  {COLS.map((c) => (
                    <th key={c.k} scope="col" aria-sort={sort === c.k ? (dir === 1 ? 'ascending' : 'descending') : undefined} onClick={() => setSortKey(c.k)}>
                      {c.label}{sort === c.k ? (dir === 1 ? ' ↑' : ' ↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody ref={body}>
                {rows.slice(0, limit).map((r) => (
                  <tr key={r.sym} data-flip-id={r.sym} tabIndex={0} onClick={() => router.push(`/company/?s=${encodeURIComponent(r.sym)}`)} onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/company/?s=${encodeURIComponent(r.sym)}`); }}>
                    <td><div className="co"><b>{r.sym}</b><span>{r.name}</span></div></td>
                    {COLS.map((c) => <td key={c.k}>{c.cell(r)}</td>)}
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={COLS.length + 1} className="muted" style={{ textAlign: 'center', padding: 40 }}>Nothing matches. Loosen a filter.</td></tr>}
              </tbody>
            </table>
          </div>
          {limit < rows.length && <div style={{ textAlign: 'center', marginTop: 20 }}><button className="btn ghost" onClick={() => setLimit((n) => n + PAGE * 2)}>Show more ({num(rows.length - limit)} left)</button></div>}
          <p className="dim" style={{ fontSize: 12.5, marginTop: 14 }}>Scores run 0 to 100 within this universe. Composite weights quality 35%, growth 25%, technical 25% and valuation 15%. Missing values sort last and show a dash. A lens describes the data; it is not a recommendation.</p>
        </Async>
      </section>
    </>
  );
}
