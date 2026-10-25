import { useMemo, useState } from 'react';
import { go, setState, useAppState } from '../app.tsx';
import { useScreen } from '../data.ts';
import { Icon, Sheet, useUi, Empty } from '../ui.tsx';
import { CompanyRow, Failed, Head, Loading, PageBar } from './common.tsx';
import { NO_FILTER, filterRows, sortRows, describeFilters, type Filters, type SortKey } from '../screen.ts';
import { saveScreen } from '../store.ts';

const SORTS: { id: SortKey; label: string; dir: 'asc' | 'desc' }[] = [
  { id: 'name', label: 'Name A to Z', dir: 'asc' }, { id: 'r1d', label: 'Biggest day gain', dir: 'desc' }, { id: 'rs3m', label: 'Ahead of the Nifty, 3 months', dir: 'desc' },
  { id: 'roce_med', label: 'Highest ROCE', dir: 'desc' }, { id: 'pe', label: 'Lowest PE', dir: 'asc' }, { id: 'from_high', label: 'Closest to 52-week high', dir: 'desc' }, { id: 'turnover_cr', label: 'Most traded', dir: 'desc' },
];
const PAGE = 40;
export function Discover() {
  const scr = useScreen(); const s = useAppState(); const { toast, tick } = useUi();
  const [f, setF] = useState<Filters>(NO_FILTER);
  const [sort, setSort] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [sheet, setSheet] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  const rows = scr.data?.rows ?? [];
  const sectors = useMemo(() => [...new Set(rows.map((r) => r.sector).filter(Boolean) as string[])].sort(), [rows]);
  const res = useMemo(() => filterRows(rows, f), [rows, f]);
  const list = useMemo(() => sortRows(res.rows, SORTS[sort].id, SORTS[sort].dir), [res.rows, sort]);
  const active = describeFilters(f);
  const set = (p: Partial<Filters>) => { setF((x) => ({ ...x, ...p })); setLimit(PAGE); };
  const toggle = (sym: string) => setPick((p) => (p.includes(sym) ? p.filter((x) => x !== sym) : p.length < 3 ? [...p, sym] : p));
  return <div>
    <PageBar title="Discover" sub={scr.data ? `${scr.data.count} companies in the Nifty 500 screen` : undefined} />
    <div className="search"><Icon n="search" /><input className="field" type="search" placeholder="Company or symbol" value={f.q} onChange={(e) => set({ q: e.target.value })} aria-label="Search companies" autoComplete="off" /></div>
    <div className="chips" style={{ marginTop: 10 }} role="group" aria-label="Quick filters">
      <button className="chip" onClick={() => setSheet(true)}><Icon n="filter" className="" />Filters{active.length ? ` · ${active.length}` : ''}</button>
      {([['trend', 'up', 'Uptrend'], ['trend', 'down', 'Downtrend'], ['value', 'cheap', 'PE 15 or less'], ['quality', 'high', 'High ROCE'], ['momentum', 'strong', 'Ahead of Nifty'], ['momentum', 'near-high', 'Near 52w high']] as const).map(([k, v, l]) =>
        <button key={l} className="chip" aria-pressed={(f[k] ?? '') === v} onClick={() => set({ [k]: (f[k] ?? '') === v ? '' : v } as Partial<Filters>)}>{l}</button>)}
    </div>
    {s.screens.length > 0 && <div className="chips" aria-label="Saved screens">{s.screens.map((x) => <button key={x.name} className="chip" onClick={() => { setF(x.f); setLimit(PAGE); toast(`Screen “${x.name}” applied`); }}><Icon n="star" />{x.name}</button>)}</div>}
    <div className="row between" style={{ margin: '12px 0 4px' }}>
      <span className="small dim num">{scr.data ? `${list.length} of ${rows.length}` : ''}{res.unmeasured ? ` · ${res.unmeasured} lacked a figure for a filter` : ''}</span>
      <label className="small dim row"><span className="sr">Sort by</span><select className="field" style={{ minHeight: 36, padding: '4px 10px', width: 'auto' }} value={sort} onChange={(e) => setSort(Number(e.target.value))} aria-label="Sort by">{SORTS.map((x, i) => <option key={x.id} value={i}>{x.label}</option>)}</select></label>
    </div>
    {scr.loading && <Loading what="the screen" />}
    {scr.err && <Failed what="the screen" err={scr.err} retry={scr.retry} />}
    {scr.data && (list.length ? <div className="card" style={{ padding: '2px 14px' }}><div className="list">
      {list.slice(0, limit).map((r) => <CompanyRow key={r.sym} r={r} compare={{ on: pick.includes(r.sym), toggle: () => { toggle(r.sym); tick(); }, disabled: pick.length >= 3 }} />)}
    </div></div> : <Empty title="No company matches" action={<button className="btn" onClick={() => setF(NO_FILTER)}>Reset filters</button>}>Filters are exact. A name with no figure for a filter is left out, never counted as a match.</Empty>)}
    {list.length > limit && <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, list.length - limit)} more</button>}
    {pick.length >= 2 && <div className="fab-row" style={{ gridTemplateColumns: '1fr 1fr' }}><button className="btn" onClick={() => setPick([])}>Clear {pick.length}</button><button className="btn pri" style={{ flexDirection: 'row', fontSize: 14 }} onClick={() => go(`/compare?s=${pick.join(',')}`)}><Icon n="compare" />Compare {pick.length}</button></div>}
    {sheet && <Sheet title="Filters" onClose={() => setSheet(false)}>
      <label className="l" htmlFor="f-sec">Sector</label>
      <select id="f-sec" className="field" value={f.sector} onChange={(e) => set({ sector: e.target.value })}><option value="">All sectors</option>{sectors.map((x) => <option key={x}>{x}</option>)}</select>
      <label className="l" htmlFor="f-size">Size</label>
      <select id="f-size" className="field" value={f.tier} onChange={(e) => set({ tier: e.target.value })}><option value="">All sizes</option>{['large', 'mid', 'small', 'micro'].map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)} cap</option>)}</select>
      <label className="l" htmlFor="f-val">Valuation</label>
      <select id="f-val" className="field" value={f.value} onChange={(e) => set({ value: e.target.value as Filters['value'] })}><option value="">Any</option><option value="cheap">PE 15 or less</option><option value="rich">PE 40 or more</option></select>
      <label className="l" htmlFor="f-q">Quality</label>
      <select id="f-q" className="field" value={f.quality} onChange={(e) => set({ quality: e.target.value as Filters['quality'] })}><option value="">Any</option><option value="high">Median ROCE 20%+ (lenders excluded)</option></select>
      <label className="l" htmlFor="f-t">Trend</label>
      <select id="f-t" className="field" value={f.trend ?? ''} onChange={(e) => set({ trend: e.target.value as Filters['trend'] })}><option value="">Any</option><option value="up">Uptrend (price above the 50-day, 50-day above the 200-day)</option><option value="down">Downtrend (the mirror of that)</option><option value="mixed">Mixed</option></select>
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
