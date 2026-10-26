import { useDeferredValue, useMemo, useState } from 'react';
import { go, setState, useAppState, useLoc } from '../app.tsx';
import { useScreen } from '../data.ts';
import { Icon, Sheet, useUi, Empty } from '../ui.tsx';
import { CompanyRow, Failed, Head, Loading, PageBar } from './common.tsx';
import { NO_FILTER, filterRows, sortRows, describeFilters, TREND_WORD, type Filters, type SortKey } from '../screen.ts';
import { saveScreen } from '../store.ts';
import { useWatchQuotes } from '../quotes.ts';
import { inr0, pct } from '../fmt.ts';
import type { Row } from '../screen.ts';

const SORTS: { id: SortKey; label: string; dir: 'asc' | 'desc' }[] = [
  { id: 'name', label: 'Name A to Z', dir: 'asc' }, { id: 'r1d', label: 'Biggest day gain', dir: 'desc' }, { id: 'rs3m', label: 'Ahead of the Nifty, 3 months', dir: 'desc' },
  { id: 'roce_med', label: 'Highest ROCE', dir: 'desc' }, { id: 'pe', label: 'Lowest PE', dir: 'asc' }, { id: 'from_high', label: 'Closest to 52-week high', dir: 'desc' }, { id: 'turnover_cr', label: 'Most traded', dir: 'desc' },
];
const PAGE = 40;
/** One tap, one idea: each lens is a fixed combination of the screen's own filters, with the number of names that pass it today. The colour says what kind of idea it is. */
const LENSES: { id: string; title: string; line: string; f: Partial<Filters>; c: string }[] = [
  { id: 'leaders', title: 'Leaders', line: 'Uptrend and ahead of the Nifty', f: { trend: 'up', momentum: 'strong' }, c: 'var(--up)' },
  { id: 'quality', title: 'Quality, fair price', line: 'ROCE 20%+ and PE 15 or less', f: { quality: 'high', value: 'cheap' }, c: 'var(--a3)' },
  { id: 'highs', title: 'Near highs', line: 'Within 5% of the 52-week high', f: { momentum: 'near-high' }, c: 'var(--a4)' },
  { id: 'cheap', title: 'Cheap', line: 'PE 15 or less', f: { value: 'cheap' }, c: 'var(--a2)' },
  { id: 'weak', title: 'Under pressure', line: 'In a downtrend', f: { trend: 'down' }, c: 'var(--down)' },
];
const KIND_C: Record<string, string> = { sector: 'var(--a6)', tier: 'var(--a6)', value: 'var(--a2)', quality: 'var(--a3)', trend: 'var(--up)', momentum: 'var(--a4)', q: 'var(--lime)' };
/** The figure the list is sorted by, shown on every row in its own colour, so the order can be checked by eye. */
function metaFor(key: SortKey, r: Row) {
  const t = (c: string, text: string) => <span className="metatag" style={{ '--mc': c } as React.CSSProperties}>{text}</span>;
  if (key === 'rs3m' && typeof r.rs3m === 'number') return t('var(--a4)', `vs Nifty ${pct(r.rs3m, 0)}`);
  if (key === 'roce_med' && typeof r.roce_med === 'number') return t('var(--a3)', `ROCE ${r.roce_med.toFixed(0)}%`);
  if (key === 'pe' && typeof r.pe === 'number') return t('var(--a2)', `PE ${r.pe.toFixed(1)}`);
  if (key === 'from_high' && typeof r.from_high === 'number') return t('var(--a4)', `${pct(r.from_high, 1)} from high`);
  if (key === 'turnover_cr' && typeof r.turnover_cr === 'number') return t('var(--a6)', `${inr0(r.turnover_cr)} cr a day`);
  return null;
}
export function Discover() {
  const scr = useScreen(); const s = useAppState(); const { toast, tick } = useUi();
  const loc = useLoc();
  // a link from Today (a sector, a trend) opens Discover already filtered
  const [f, setF] = useState<Filters>(() => ({ ...NO_FILTER, sector: loc.q.get('sector') ?? '', trend: (['up', 'down', 'mixed'].includes(loc.q.get('trend') ?? '') ? loc.q.get('trend') : '') as Filters['trend'] }));
  const [sort, setSort] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [sheet, setSheet] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  const rows = scr.data?.rows ?? [];
  const sectors = useMemo(() => [...new Set(rows.map((r) => r.sector).filter(Boolean) as string[])].sort(), [rows]);
  // the pressed state of a chip answers at once; the list under it catches up a moment later, so a tap never waits for forty rows to be drawn
  const df = useDeferredValue(f); const dsort = useDeferredValue(sort);
  const res = useMemo(() => filterRows(rows, df), [rows, df]);
  const list = useMemo(() => sortRows(res.rows, SORTS[dsort].id, SORTS[dsort].dir), [res.rows, dsort]);
  useWatchQuotes(list.slice(0, limit).map((r) => r.sym));        // live prices for the rows on screen
  const active = describeFilters(f);
  const chosen = ([['q', f.q && `“${f.q}”`], ['sector', f.sector], ['tier', f.tier && `${f.tier} cap`], ['trend', f.trend && TREND_WORD[f.trend]], ['value', f.value === 'cheap' ? 'PE 15 or less' : f.value === 'rich' ? 'PE 40 or more' : ''], ['quality', f.quality && 'ROCE 20%+'], ['momentum', f.momentum === 'strong' ? 'Ahead of Nifty' : f.momentum === 'weak' ? 'Behind Nifty' : f.momentum === 'near-high' ? 'Near 52w high' : '']] as [string, string | undefined][]).filter(([, l]) => l).map(([k, label]) => ({ k, label: label as string }));
  const counts = useMemo(() => Object.fromEntries(LENSES.map((l) => [l.id, rows.length ? filterRows(rows, { ...NO_FILTER, ...l.f }).rows.length : null])) as Record<string, number | null>, [rows]);
  const lensOn = (l: (typeof LENSES)[number]) => (Object.entries(l.f) as [keyof Filters, string][]).every(([k, v]) => (f[k] ?? '') === v);
  const applyLens = (l: (typeof LENSES)[number]) => { if (lensOn(l)) set(Object.fromEntries(Object.keys(l.f).map((k) => [k, ''])) as Partial<Filters>); else set({ trend: '', momentum: '', value: '', quality: '', ...l.f }); tick(); };
  const set = (p: Partial<Filters>) => { setF((x) => ({ ...x, ...p })); setLimit(PAGE); };
  const toggle = (sym: string) => setPick((p) => (p.includes(sym) ? p.filter((x) => x !== sym) : p.length < 3 ? [...p, sym] : p));
  return <div>
    <PageBar title="Discover" sub={scr.data ? <>{scr.data.count} companies in the published screen · <a href="#/data" style={{ textDecoration: 'underline' }}>coverage</a></> : undefined} />
    <div className="search"><Icon n="search" /><input className="field" type="search" placeholder="Company or symbol" value={f.q} onChange={(e) => set({ q: e.target.value })} aria-label="Search companies" autoComplete="off" /></div>
    <div className="strip lenses" role="group" aria-label="Ideas" style={{ marginTop: 10 }}>{LENSES.map((l) => { const on = lensOn(l); const n = counts[l.id];
      return <button key={l.id} className={`lens ${on ? 'on' : ''}`} style={{ '--lc': l.c } as React.CSSProperties} aria-pressed={on} onClick={() => applyLens(l)}>
        <span className="lt">{l.title}</span><span className="ln num">{n == null ? '…' : n}<small> names</small></span><span className="ll">{l.line}</span></button>; })}</div>
    <div className="chips" style={{ marginTop: 8 }} role="group" aria-label="Quick filters">
      <button className="chip" onClick={() => setSheet(true)}><Icon n="filter" className="" />Filters{active.length ? ` · ${active.length}` : ''}</button>
      {s.prefs.interests.map((x) => <button key={x} className="chip cc" style={{ '--cc': 'var(--a6)' } as React.CSSProperties} aria-pressed={f.sector === x} onClick={() => set({ sector: f.sector === x ? '' : x })}>{x}</button>)}
      {([['trend', 'up', 'Uptrend', 'var(--up)'], ['trend', 'down', 'Downtrend', 'var(--down)'], ['trend', 'mixed', 'Sideways', 'var(--dim)'], ['quality', 'high', 'High ROCE', 'var(--a3)'], ['momentum', 'strong', 'Ahead of Nifty', 'var(--a4)']] as const).map(([k, v, l, c]) =>
        <button key={l} className="chip cc" style={{ '--cc': c } as React.CSSProperties} aria-pressed={(f[k] ?? '') === v} onClick={() => set({ [k]: (f[k] ?? '') === v ? '' : v } as Partial<Filters>)}>{l}</button>)}
    </div>
    {chosen.length > 0 && <div className="chips chosen" role="group" aria-label="Active filters">{chosen.map((c) => <button key={c.k} className="chip cc on-x" style={{ '--cc': KIND_C[c.k] } as React.CSSProperties} onClick={() => set({ [c.k]: '' } as Partial<Filters>)} aria-label={`Remove filter: ${c.label}`}>{c.label}<span aria-hidden="true">×</span></button>)}<button className="chip" onClick={() => { setF(NO_FILTER); setLimit(PAGE); }}>Clear all</button></div>}
    {s.screens.length > 0 && <div className="chips" aria-label="Saved screens">{s.screens.map((x) => <button key={x.name} className="chip" onClick={() => { setF(x.f); setLimit(PAGE); toast(`Screen “${x.name}” applied`); }}><Icon n="star" />{x.name}</button>)}</div>}
    <div className="row between" style={{ margin: '12px 0 4px' }}>
      <span className="small dim num">{scr.data ? `${list.length} of ${rows.length}` : ''}{res.unmeasured ? ` · ${res.unmeasured} lacked a figure for a filter` : ''}{res.notApplicable ? ` · ${res.notApplicable} financial-sector or not-meaningful names left out of the ROCE filter` : ''}</span>
      <label className="small dim row" style={{ minWidth: 0, flex: '1 1 11rem', justifyContent: 'flex-end' }}><span className="sr">Sort by</span><select className="field" style={{ minHeight: 36, padding: '4px 10px', width: 'auto', maxWidth: '100%' }} value={sort} onChange={(e) => setSort(Number(e.target.value))} aria-label="Sort by">{SORTS.map((x, i) => <option key={x.id} value={i}>{x.label}</option>)}</select></label>
    </div>
    {scr.loading && <Loading what="the screen" />}
    {scr.err && <Failed what="the screen" err={scr.err} retry={scr.retry} />}
    {scr.data && (list.length ? <div className="card" style={{ padding: '2px 14px' }}><div className="list">
      {list.slice(0, limit).map((r) => <CompanyRow key={r.sym} r={r} meta={metaFor(SORTS[dsort].id, r)} compare={{ on: pick.includes(r.sym), toggle: () => { toggle(r.sym); tick(); }, disabled: pick.length >= 3 }} />)}
    </div></div> : <Empty title="No company matches" action={<button className="btn" onClick={() => setF(NO_FILTER)}>Reset filters</button>}>Filters are exact. A name with no figure for a filter is left out, never counted as a match.</Empty>)}
    {list.length > limit && <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, list.length - limit)} more</button>}
    {pick.length >= 2 && <div className="fab-row" style={{ gridTemplateColumns: '1fr 1fr' }}><button className="btn" onClick={() => setPick([])}>Clear {pick.length}</button><button className="btn pri" style={{ flexDirection: 'row', fontSize: '0.875rem' }} onClick={() => go(`/compare?s=${pick.join(',')}`)}><Icon n="compare" />Compare {pick.length}</button></div>}
    {sheet && <Sheet title="Filters" onClose={() => setSheet(false)}>
      <label className="l" htmlFor="f-sec">Sector</label>
      <select id="f-sec" className="field" value={f.sector} onChange={(e) => set({ sector: e.target.value })}><option value="">All sectors</option>{sectors.map((x) => <option key={x}>{x}</option>)}</select>
      <label className="l" htmlFor="f-size">Size</label>
      <select id="f-size" className="field" value={f.tier} onChange={(e) => set({ tier: e.target.value })}><option value="">All sizes</option>{['large', 'mid', 'small', 'micro'].map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)} cap</option>)}</select>
      <label className="l" htmlFor="f-val">Valuation</label>
      <select id="f-val" className="field" value={f.value} onChange={(e) => set({ value: e.target.value as Filters['value'] })}><option value="">Any</option><option value="cheap">PE 15 or less</option><option value="rich">PE 40 or more</option></select>
      <label className="l" htmlFor="f-q">Quality</label>
      <select id="f-q" className="field" value={f.quality} onChange={(e) => set({ quality: e.target.value as Filters['quality'] })}><option value="">Any</option><option value="high">Median ROCE 20%+ (financial sector left out)</option></select>
      <label className="l" htmlFor="f-t">Trend</label>
      <select id="f-t" className="field" value={f.trend ?? ''} onChange={(e) => set({ trend: e.target.value as Filters['trend'] })}><option value="">Any</option><option value="up">Uptrend (all four: above 20/50-day, 50-day 1% over 200-day, 3-month up)</option><option value="down">Downtrend (all four, mirrored)</option><option value="mixed">Sideways (meets neither rule)</option></select>
      <label className="l" htmlFor="f-m">Momentum</label>
      <select id="f-m" className="field" value={f.momentum} onChange={(e) => set({ momentum: e.target.value as Filters['momentum'] })}><option value="">Any</option><option value="strong">Ahead of the Nifty, 3 months</option><option value="weak">Behind the Nifty, 3 months</option><option value="near-high">Within 5% of the 52-week high</option></select>
      <p className="small dim">Every figure: Alpha screen, last close. PE is trailing and absent for loss-makers. ROCE is the median of up to four fiscal years.</p>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn grow" onClick={() => setF(NO_FILTER)}>Reset</button>
        <button className="btn pri grow" onClick={() => setSheet(false)}>Show {list.length}</button>
      </div>
      {active.length > 0 && <SaveScreen f={f} labels={active} />}
    </Sheet>}
  </div>;
}
function SaveScreen({ f, labels }: { f: Filters; labels: string[] }) {
  const [n, setN] = useState(''); const { toast } = useUi();
  return <div style={{ marginTop: 16 }}><Head>Save this screen</Head><p className="small dim" style={{ margin: '0 0 8px' }}>{labels.join(' · ')}</p>
    <div className="row"><input className="field" placeholder="Name it" value={n} maxLength={40} onChange={(e) => setN(e.target.value)} aria-label="Screen name" /><button className="btn pri" disabled={!n.trim()} onClick={() => { setState((x) => saveScreen(x, n, f)); toast(`Saved “${n.trim()}”`); setN(''); }}>Save</button></div></div>;
}
