'use client';

import Link from 'next/link';
import { CompanyPeek } from '@/components/Peek';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TickerLink } from '@/components/TickerLink';
import { csvProvenance, csvRow } from '@/lib/csv';
import AskScreen, { type NlState } from '@/components/AskScreen';
import { DataStamp } from '@/components/DataStamp';
import { Async, Chg, PageHead } from '@/components/ui';
import { useSignals, useFeed } from '@/lib/data';
import { dash, num, pct, ratio } from '@/lib/format';
import { canAnimate } from '@/lib/motion';
import { Flip } from '@/lib/flip';
import { useStoredList } from '@/lib/store';
import { fromQuery, toQuery } from '@/lib/screenUrl';
import type { Row } from '@/lib/types';
import { companyHref } from '@/lib/slug';
import { useToday } from '@/lib/useToday';

type Num = number | null | undefined;
interface Field { id: string; label: string; get: (r: Row) => Num; fmt: (v: number) => string; kind?: 'chg'; step?: number }
const has = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

const FIELDS: Field[] = [
  { id: 'price', label: 'Price', get: (r) => r.price, fmt: (v) => `₹${num(v, 2)}` },
  { id: 'mcap_cr', label: 'Market cap (₹ cr)', get: (r) => r.mcap_cr, fmt: (v) => (v >= 1e5 ? `${num((v / 1e5), 2)}L cr` : `${num(v, 0)} cr`) },
  { id: 'pe', label: 'P/E', get: (r) => r.pe, fmt: (v) => num(v, 1) },
  { id: 'pb', label: 'P/B', get: (r) => r.pb, fmt: (v) => num(v, 2) },
  { id: 'roce', label: 'ROCE %', get: (r) => r.roce, fmt: (v) => `${pct(v, 1, false)}` },
  { id: 'roe', label: 'ROE %', get: (r) => r.roe, fmt: (v) => `${pct(v, 1, false)}` },
  { id: 'de', label: 'Debt / equity', get: (r) => r.de, fmt: (v) => num(v, 2) },
  { id: 'div_yield', label: 'Dividend yield %', get: (r) => r.div_yield, fmt: (v) => `${pct(v, 2, false)}` },
  { id: 'rev_cagr', label: 'Revenue CAGR %', get: (r) => r.rev_cagr, fmt: (v) => `${pct(v, 1, false)}` },
  { id: 'eps_cagr', label: 'EPS CAGR %', get: (r) => r.eps_cagr, fmt: (v) => `${pct(v, 1, false)}` },
  { id: 'cfo_pat', label: 'Cash / profit', get: (r) => r.cfo_pat, fmt: (v) => `${ratio(v, 2)}` },
  { id: 'piotroski', label: 'Piotroski F (of 9)', get: (r) => r.piotroski, fmt: (v) => String(v) },
  { id: 'q', label: 'Quality score', get: (r) => r.q, fmt: (v) => String(Math.round(v)) },
  { id: 'g', label: 'Growth score', get: (r) => r.g, fmt: (v) => String(Math.round(v)) },
  { id: 'v', label: 'Value score', get: (r) => r.v, fmt: (v) => String(Math.round(v)) },
  { id: 'tech', label: 'Technical score', get: (r) => r.tech, fmt: (v) => String(Math.round(v)) },
  { id: 'comp', label: 'Composite score', get: (r) => r.comp, fmt: (v) => String(Math.round(v)) },
  { id: 'r1d', label: 'Today %', get: (r) => r.r1d, fmt: (v) => String(v), kind: 'chg' },
  { id: 'r1w', label: 'Week %', get: (r) => r.r1w, fmt: (v) => String(v), kind: 'chg' },
  { id: 'r1m', label: 'Month %', get: (r) => r.r1m, fmt: (v) => String(v), kind: 'chg' },
  { id: 'r3m', label: '3 months %', get: (r) => r.r3m, fmt: (v) => String(v), kind: 'chg' },
  { id: 'r1y', label: 'Year %', get: (r) => r.r1y, fmt: (v) => String(v), kind: 'chg' },
  { id: 'rs3m', label: 'Vs index, 3 months %', get: (r) => r.rs3m, fmt: (v) => String(v), kind: 'chg' },
  { id: 'from_high', label: 'From 52-week high %', get: (r) => r.from_high, fmt: (v) => `${pct(v, 0, false)}` },
  { id: 'rsi', label: 'RSI (14)', get: (r) => r.rsi, fmt: (v) => num(v, 0) },
  { id: 'pe_pctile', label: 'P/E percentile in own history', get: (r) => r.pe_pctile, fmt: (v) => `${Math.round(v)}` },
  { id: 'turnover_cr', label: 'Daily turnover (₹ cr)', get: (r) => r.turnover_cr, fmt: (v) => `${num(v, 1)} cr` },
];
const F = new Map(FIELDS.map((f) => [f.id, f]));
const DEFAULT_COLS = ['price', 'r1d', 'r1m', 'r1y', 'pe', 'roce', 'de', 'q', 'g', 'v', 'comp'];

interface Cond { f: string; op: '>=' | '<='; v: string }
type Flag = 'vetted' | 'ahimsa' | 'uptrend' | 'magic' | 'signal';
interface Lens { id: string; label: string; hint: string; conds: Cond[]; flags?: Flag[] }
const LENSES: Lens[] = [
  { id: 'quality', label: 'Quality compounders', hint: 'ROCE 20%+ and debt/equity 0.5 or less', conds: [{ f: 'roce', op: '>=', v: '20' }, { f: 'de', op: '<=', v: '0.5' }] },
  { id: 'value', label: 'Cheap and healthy', hint: 'P/E under 15 and ROCE 15%+', conds: [{ f: 'pe', op: '<=', v: '15' }, { f: 'pe', op: '>=', v: '1' }, { f: 'roce', op: '>=', v: '15' }] },
  { id: 'growth', label: 'Fast growers', hint: 'Revenue and EPS compounding above 15% a year', conds: [{ f: 'rev_cagr', op: '>=', v: '15' }, { f: 'eps_cagr', op: '>=', v: '15' }] },
  { id: 'debtfree', label: 'Debt-free', hint: 'Debt to equity 0.1 or less', conds: [{ f: 'de', op: '<=', v: '0.1' }] },
  { id: 'income', label: 'Dividend income', hint: 'Yield 2% or more', conds: [{ f: 'div_yield', op: '>=', v: '2' }] },
  { id: 'cashrich', label: 'Cash earners', hint: 'Operating cash flow at least 1x profit, Piotroski 7+', conds: [{ f: 'cfo_pat', op: '>=', v: '1' }, { f: 'piotroski', op: '>=', v: '7' }] },
  { id: 'trend', label: 'In an uptrend', hint: 'Above its 50 and 200-day, ahead of the index over 3 months', conds: [], flags: ['uptrend'] },
  { id: 'cheaphist', label: 'Cheap vs its own history', hint: 'P/E in the lowest quarter of its own range, quality score 50+', conds: [{ f: 'pe_pctile', op: '<=', v: '25' }, { f: 'q', op: '>=', v: '50' }] },
  { id: 'vetted', label: 'Vetted', hint: 'Passes the data-quality and balance-sheet checks', conds: [], flags: ['vetted'] },
  { id: 'ahimsa', label: 'Ahimsa 500', hint: "In NSE's Nifty500 Ahimsa index", conds: [], flags: ['ahimsa'] },
  { id: 'magic', label: 'Magic Formula top 100', hint: 'Ranked in the first hundred on Greenblatt’s rule', conds: [], flags: ['magic'] },
  { id: 'signal', label: 'Has an engine signal', hint: 'Selected by one of the five AI engines at the latest close', conds: [], flags: ['signal'] },
];

const PAGE = 60;
const FLAGS: ReadonlySet<string> = new Set<Flag>(['vetted', 'ahimsa', 'uptrend', 'magic', 'signal']);
const LENS_IDS: ReadonlySet<string> = new Set(LENSES.map((l) => l.id));
const TIERS: ReadonlySet<string> = new Set(['large', 'mid', 'small']);
interface Saved { name: string; conds: Cond[]; flags: Flag[]; sector: string; tier: string; nl?: NlState }

export default function Screen() {
  const s = useFeed('screen');
  const eng = useSignals();
  const [peek, setPeek] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [nlTests, setNlTests] = useState<((r: Row) => boolean)[]>([]);
  const [nl, setNl] = useState<NlState>({ text: '', off: [] });
  const [sector, setSector] = useState('');
  const [tier, setTier] = useState('');
  const [conds, setConds] = useState<Cond[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [lens, setLens] = useState('');
  const [sort, setSort] = useState('comp');
  const [dir, setDir] = useState<1 | -1>(-1);
  const [limit, setLimit] = useState(PAGE);
  const [cols, setCols] = useState<string[]>(DEFAULT_COLS);
  const [showCols, setShowCols] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [, , , addWatchAll, watchError] = useStoredList('alpha-watchlist');
  const [watchedNote, setWatchedNote] = useState('');
  const body = useRef<HTMLTableSectionElement>(null);
  const flipState = useRef<ReturnType<typeof Flip.getState> | null>(null);

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem('alpha-screen-cols') ?? 'null'); if (Array.isArray(c) && c.length) setCols(c.filter((x: string) => F.has(x)));
      const sv = JSON.parse(localStorage.getItem('alpha-screen-saved') ?? '[]'); if (Array.isArray(sv)) setSaved(sv);
    } catch { /* storage blocked or corrupt: defaults */ }
  }, []);
  // The view lives in the address: read it once on arrival, then keep it current with replaceState (no history entry per keystroke),
  // so refresh, Back from a company page and a shared link all restore the same filters and sort.
  const fromUrl = useRef(false);
  useEffect(() => {
    const st = fromQuery(window.location.search, { fields: F, flags: FLAGS, lenses: LENS_IDS, tiers: TIERS });
    setQ(st.q); setSector(st.sector); setTier(st.tier); setConds(st.conds); setFlags(st.flags as Flag[]); setLens(st.lens); setSort(st.sort); setDir(st.dir);
    if (st.ask) setNl({ text: st.ask, off: st.off });
    fromUrl.current = true;
  }, []);
  useEffect(() => {
    if (!fromUrl.current) return;
    const next = `${window.location.pathname}${toQuery({ q, sector, tier, conds, flags, lens, sort, dir, ask: nl.text, off: nl.off })}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, '', next);
  }, [q, sector, tier, conds, flags, lens, sort, dir, nl]);
  const persist = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* not persisted */ } };

  // Price and Today % follow the site's one rule for "today" (lib/live.ts): while live prices describe a newer session than the
  // screen, every row carries the live price and move, so the table, the filters, the sort, the plain-English box and the CSV
  // all read the same displayed number. A stock the live snapshot does not cover shows a dash rather than an older close.
  const asOf = s.data?.breadth.as_of ?? null;
  const { view: tv, day } = useToday(asOf);
  const base = useMemo<Row[]>(() => {
    const list = s.data?.rows ?? [];
    if (!tv.live) return list;
    return list.map((r) => { const price = tv.price(r.sym, r.price); return { ...r, price, r1d: tv.pct(r.sym, r.r1d), last_date: price === null ? r.last_date : tv.session ?? r.last_date }; });
  }, [s.data, tv]);
  const liveCol = (c: string) => tv.live && (c === 'price' || c === 'r1d');

  const sectors = useMemo(() => Array.from(new Set((s.data?.rows ?? []).map((r) => r.sector).filter(Boolean))).sort(), [s.data]);
  const sigSyms = useMemo(() => new Set((eng.data?.signals ?? []).map((x) => x.sym)), [eng.data]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const active = conds.filter((c) => c.v !== '' && Number.isFinite(Number(c.v)));
    const list = base.filter((r) => {
      if (nlTests.length && !nlTests.every((t) => t(r))) return false;
      if (term && !(r.sym.toLowerCase().includes(term) || r.name.toLowerCase().includes(term))) return false;
      if (sector && r.sector !== sector) return false;
      if (tier && r.tier !== tier) return false;
      for (const c of active) {
        const v = F.get(c.f)?.get(r);
        if (!has(v)) return false;                       // a missing figure never passes a filter
        if (c.op === '>=' ? v < Number(c.v) : v > Number(c.v)) return false;
      }
      if (flags.includes('vetted') && r.vet?.s !== 'cleared') return false;
      if (flags.includes('ahimsa') && !r.ahimsa) return false;
      if (flags.includes('uptrend') && !(has(r.price) && has(r.sma50) && has(r.sma200) && r.price > r.sma50 && r.price > r.sma200 && has(r.rs3m) && r.rs3m > 0)) return false;
      if (flags.includes('magic') && !(has(r.mf?.rank) && (r.mf?.rank as number) <= 100)) return false;
      if (flags.includes('signal') && !sigSyms.has(r.sym)) return false;
      return true;
    });
    const g = F.get(sort)?.get;
    return list.sort((a, b) => {
      const av = g ? g(a) : null, bv = g ? g(b) : null;
      if (!has(av) && !has(bv)) return 0;
      if (!has(av)) return 1;                           // missing values sort last whichever way
      if (!has(bv)) return -1;
      return (av - bv) * dir;
    });
  }, [base, q, sector, tier, conds, flags, sort, dir, sigSyms, nlTests]);

  const capture = () => { if (body.current && canAnimate()) flipState.current = Flip.getState(body.current.querySelectorAll('tr')); };
  useEffect(() => {
    if (flipState.current && body.current) { Flip.from(flipState.current, { duration: 0.55, ease: 'power3.inOut' }); flipState.current = null; }
  }, [sort, dir, conds, flags, sector, tier, nlTests]);

  const applyLens = (l: Lens) => {
    capture();
    if (lens === l.id) { setLens(''); setConds([]); setFlags([]); return; }
    setLens(l.id); setConds(l.conds.map((c) => ({ ...c }))); setFlags(l.flags ?? []); setLimit(PAGE);
  };
  const setSortKey = (k: string) => { capture(); if (k === sort) setDir((d) => (d === 1 ? -1 : 1)); else { setSort(k); setDir(k === 'pe' || k === 'de' || k === 'pb' ? 1 : -1); } setLimit(PAGE); };
  const updateCond = (i: number, patch: Partial<Cond>) => { capture(); setLens(''); setConds((c) => c.map((x, k) => (k === i ? { ...x, ...patch } : x))); };
  const toggleCol = (id: string) => { const next = cols.includes(id) ? cols.filter((x) => x !== id) : [...cols, id]; const ordered = FIELDS.map((f) => f.id).filter((x) => next.includes(x)); setCols(ordered); persist('alpha-screen-cols', ordered); };
  const toggle = (sym: string) => setPicked((p) => (p.includes(sym) ? p.filter((x) => x !== sym) : p.length < 4 ? [...p, sym] : p));
  const save = () => { const name = window.prompt('Name this screen'); if (!name) return; const next = [...saved.filter((x) => x.name !== name), { name, conds, flags, sector, tier, nl }]; setSaved(next); persist('alpha-screen-saved', next); };
  const load = (v: Saved) => { capture(); setConds(v.conds); setFlags(v.flags); setSector(v.sector); setTier(v.tier); setNl(v.nl ?? { text: '', off: [] }); setLimit(PAGE); setLens(''); };
  const csv = () => {
    // the displayed values, plus where they came from: live price and move carry their time, everything else the screen's date
    const stamp = tv.live ? `price and today: ${tv.asOf}; other columns: close ${asOf ?? 'unknown'}` : `close ${asOf ?? 'unknown'}`;
    const head = ['symbol', 'name', 'sector', ...cols.map((c) => (F.get(c)?.label ?? c) + (liveCol(c) ? ` (${tv.tag} IST)` : '')), 'as_of'];
    const lines = [...csvProvenance('alpha.askakshay.com screen (company filings via Yahoo Finance; prices from NSE via Yahoo)', stamp), csvRow(head), ...rows.map((r) => csvRow([r.sym, r.name, r.sector, ...cols.map((c) => { const v = F.get(c)?.get(r); return has(v) ? v : null; }), stamp]))];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = 'alpha-screen.csv'; a.click();
  };
  const tierNoCap = useMemo(() => (s.data?.rows ?? []).filter((r) => r.tier && !has(r.mcap_cr)).length, [s.data]);
  const activeLens = LENSES.find((l) => l.id === lens);

  return (
    <>
      <PageHead method="screen" eyebrow={`Screen · ${s.data ? num(s.data.count) : 'Indian'} companies`} title="Find companies" em="that match your criteria." />
      <section className="wrap" style={{ paddingTop: 0 }}><DataStamp ids={['screen']} /></section>
      <section className="wrap wide">
        <AskScreen rows={base} tableRows={rows} value={nl} onValue={(v) => { setNl(v); setLimit(PAGE); }} onTests={setNlTests} />
        <div className="filters">
          <input className="field" placeholder="Search name or symbol" aria-label="Search companies" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
          <select className="field" aria-label="Sector" value={sector} onChange={(e) => { capture(); setSector(e.target.value); setLimit(PAGE); }}><option value="">All sectors</option>{sectors.map((x) => <option key={x}>{x}</option>)}</select>
          <select className="field" aria-label="Size" value={tier} onChange={(e) => { capture(); setTier(e.target.value); setLimit(PAGE); }}><option value="">Any size</option><option value="large">Large cap</option><option value="mid">Mid cap</option><option value="small">Small cap</option></select>
        </div>
        <div className="filters" role="group" aria-label="Lenses">
          {LENSES.map((l) => <button key={l.id} className="chip" aria-pressed={lens === l.id} title={l.hint} onClick={() => applyLens(l)}>{l.label}</button>)}
        </div>

        <div className="panel tight" style={{ marginBottom: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Your filters {flags.length > 0 && <span className="dim">· plus {flags.join(', ')}</span>}</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {conds.map((c, i) => (
              <div className="filters" style={{ margin: 0 }} key={i}>
                <select className="field" style={{ height: 36 }} aria-label="Measure" value={c.f} onChange={(e) => updateCond(i, { f: e.target.value })}>{FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
                <select className="field" style={{ height: 36 }} aria-label="Comparison" value={c.op} onChange={(e) => updateCond(i, { op: e.target.value as Cond['op'] })}><option value=">=">is at least</option><option value="<=">is at most</option></select>
                <input className="field" style={{ minWidth: 90, width: 110, height: 36 }} inputMode="decimal" aria-label="Value" value={c.v} onChange={(e) => updateCond(i, { v: e.target.value.replace(/[^\d.-]/g, '') })} />
                <button className="chip" onClick={() => { capture(); setLens(''); setConds((x) => x.filter((_, k) => k !== i)); }} aria-label="Remove filter">✕</button>
              </div>
            ))}
            <div className="filters" style={{ margin: 0 }}>
              <button className="chip" onClick={() => { setLens(''); setConds((c) => [...c, { f: 'roce', op: '>=', v: '15' }]); }}>+ Add a filter</button>
              {(conds.length > 0 || flags.length > 0) && <button className="chip" onClick={() => { capture(); setConds([]); setFlags([]); setLens(''); }}>Clear all</button>}
              <button className="chip" onClick={save}>Save this screen</button>
              {saved.map((v) => <span key={v.name} style={{ display: 'inline-flex' }}><button className="chip" onClick={() => load(v)}>{v.name}</button><button className="chip" aria-label={`Delete ${v.name}`} onClick={() => { const n = saved.filter((x) => x.name !== v.name); setSaved(n); persist('alpha-screen-saved', n); }}>✕</button></span>)}
            </div>
          </div>
        </div>

        <div className="filters" style={{ justifyContent: 'space-between' }}>
          <span className="muted" aria-live="polite">{activeLens && <><b style={{ color: 'var(--text)' }}>{activeLens.label}:</b> {activeLens.hint}. </>}<span key={rows.length} className="num count-tint">{num(rows.length)}</span> match{rows.length === 1 ? '' : 'es'}{s.data ? ` of ${num(s.data.rows.length)}` : ''}.</span>
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {picked.length >= 2 && <Link className="chip on" href={`/compare/?s=${picked.join(',')}`}>Compare {picked.length}</Link>}
            {picked.length > 0 && <button className="chip" onClick={() => { const n = picked.length; if (addWatchAll(picked)) { setWatchedNote(`${n} added to your watchlist, saved in this browser`); setPicked([]); } }}>Watch {picked.length}</button>}
            {(watchError || watchedNote) && <span className={watchError ? 'warn' : 'dim'} role="status" style={{ fontSize: 13.5 }}>{watchError ?? watchedNote}</span>}
            <button className="chip" aria-expanded={showCols} onClick={() => setShowCols((v) => !v)}>Columns</button>
            <button className="chip" onClick={csv}>Download CSV</button>
          </span>
        </div>
        {showCols && <div className="panel tight" style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>{FIELDS.map((f) => <button key={f.id} className="chip" aria-pressed={cols.includes(f.id)} onClick={() => toggleCol(f.id)}>{f.label}</button>)}</div>}

        <Async loading={s.loading} error={s.error} rows={6}>
          <span className="sr" aria-live="polite">{sort ? `Sorted by ${(F.get(sort)?.label ?? sort).replace(' %', '').replace(' (₹ cr)', '')}, ${dir === 1 ? 'ascending' : 'descending'}` : ''}</span>
          <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col" style={{ minWidth: 250 }}>Company</th>
                  {/* A08: each sortable heading holds a real button, so sorting works by keyboard; focus stays on it after the sort */}
                  {cols.map((c) => { const f = F.get(c)!; const label = f.label.replace(' %', '').replace(' (₹ cr)', ''); return <th key={c} scope="col" aria-sort={sort === c ? (dir === 1 ? 'ascending' : 'descending') : 'none'}><button type="button" className="th-sort" onClick={() => setSortKey(c)} aria-label={`Sort by ${label}${sort === c ? (dir === 1 ? ', now ascending' : ', now descending') : ''}`}>{label}{liveCol(c) && <span className="lv-tag"> ({tv.tag})</span>}<span aria-hidden className="th-dir">{sort === c ? (dir === 1 ? ' ↑' : ' ↓') : ' ↕'}</span></button></th>; })}
                </tr>
              </thead>
              <tbody ref={body}>
                {rows.slice(0, limit).map((r) => (
                  <tr key={r.sym} data-flip-id={r.sym} tabIndex={0} onClick={() => setPeek(r.sym)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) setPeek(r.sym); }} title="Open a quick look">
                    <td>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input type="checkbox" aria-label={`Select ${r.sym} to compare`} checked={picked.includes(r.sym)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.sym)} />
                        <div className="co"><b><TickerLink sym={r.sym} title="Open the full page" /> {sigSyms.has(r.sym) && <span className="tag acc" style={{ marginLeft: 4 }}>signal</span>}</b><span>{r.name}</span></div>
                      </div>
                    </td>
                    {cols.map((c) => { const f = F.get(c)!; const v = f.get(r); return <td key={c}>{!has(v) ? <span className="dim">{dash}</span> : f.kind === 'chg' ? <Chg v={v} dp={1} /> : c === 'comp' ? <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><span style={{ width: 44, height: 5, borderRadius: 9, background: 'var(--panel-3)', overflow: 'hidden', display: 'inline-block' }}><i style={{ display: 'block', height: '100%', width: `${Math.max(0, Math.min(100, v))}%`, background: 'var(--accent)' }} /></span><b className="num">{f.fmt(v)}</b></span> : <span className="num">{f.fmt(v)}</span>}</td>; })}
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={cols.length + 1} className="muted" style={{ textAlign: 'center', padding: 40 }}>Nothing matches. Loosen a filter.</td></tr>}
              </tbody>
            </table>
          </div>
          {limit < rows.length && <div style={{ textAlign: 'center', marginTop: 20 }}><button className="btn ghost" onClick={() => setLimit((n) => n + PAGE * 2)}>Show more ({num(rows.length - limit)} left)</button></div>}
          <p className="dim" style={{ fontSize: 13, marginTop: 10 }}>{tv.live ? `Price and Today % live ${tv.at} IST${day?.stale ? ` (${day.stale} with no trade today show a dash)` : ''}; other columns the ${asOf ?? 'latest'} close.` : `All columns the ${asOf ?? 'latest'} close.`}{tierNoCap ? ` ${tierNoCap} companies carry a size class but no market cap.` : ''}</p>
        </Async>
      </section>
      <CompanyPeek sym={peek} onClose={() => setPeek(null)} />
    </>
  );
}
