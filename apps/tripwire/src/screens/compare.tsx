import { useEffect, useMemo, useState } from 'react';
import { go, setState, useAppState } from '../app.tsx';
import { getJson, useScreen } from '../data.ts';
import { CompareChart } from './CompareChart.tsx';
import { livePrice, useQuotes, useWatchQuotes } from '../quotes.ts';
import { Empty, useUi } from '../ui.tsx';
import { Failed, PageBar } from './common.tsx';
import { trendOf, TREND_WORD } from '../screen.ts';
import { eligibilityOf, isFinancialSector, meaningful, type MetricId } from '../eligibility.ts';
import { cr, dash, inr, initials, isNum, pct, x1 } from '../fmt.ts';
import { saveCompare } from '../store.ts';
import type { Company } from '../data.ts';

type View = 'overview' | 'growth' | 'profit' | 'value' | 'balance' | 'risk';
type Line = { live?: 'px' | 'ch'; label: string; get: (c: Company) => number | null | undefined | string; fmt: (v: never) => string; best?: 'high' | 'low'; metric?: MetricId };
const num = (f: (c: Company) => number | null | undefined) => f;
const VIEWS: Record<View, { label: string; lines: Line[] }> = {
  overview: { label: 'Overview', lines: [
    { live: 'px', label: 'Price', get: (c) => c.row.price, fmt: inr as never }, { live: 'ch', label: 'Day', get: (c) => c.row.r1d, fmt: pct as never },
    { label: 'Against the Nifty, 3m (pts)', get: (c) => c.row.rs3m, fmt: ((v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`) as never, best: 'high' },
    { label: 'From 52-week high (at close)', get: (c) => c.row.from_high, fmt: pct as never, best: 'high' }, { label: 'Trend', get: (c) => { const x = trendOf(c.row).trend; return x ? TREND_WORD[x] : null; }, fmt: ((v: string) => v) as never },
    { label: 'Size', get: (c) => c.row.tier, fmt: ((v: string) => v) as never }, { label: 'Sector', get: (c) => c.row.sector, fmt: ((v: string) => v) as never } ] },
  growth: { label: 'Growth', lines: [
    { label: 'Revenue growth, 3y', get: (c) => c.row.rev_cagr, fmt: pct as never, best: 'high' }, { label: 'EPS growth, 3y', get: (c) => c.row.eps_cagr, fmt: pct as never, best: 'high' } ] },
  profit: { label: 'Profit', lines: [
    { label: 'ROCE (median)', get: (c) => c.row.roce_med, fmt: ((v: number) => pct(v, 1, false)) as never, best: 'high', metric: 'roce' },
    { label: 'EBIT margin', get: (c) => c.row.ebit_margin, fmt: ((v: number) => pct(v, 1, false)) as never, best: 'high', metric: 'margin' },
    { label: 'Net margin', get: (c) => c.row.net_margin, fmt: ((v: number) => pct(v, 1, false)) as never, best: 'high', metric: 'margin' } ] },
  value: { label: 'Valuation', lines: [
    { label: 'PE (trailing)', get: (c) => c.row.pe, fmt: x1 as never }, { label: 'Price to book', get: (c) => c.row.pb, fmt: x1 as never }, { label: 'Dividend yield', get: (c) => c.row.div_yield, fmt: ((v: number) => pct(v, 2, false)) as never } ] },
  balance: { label: 'Balance sheet', lines: [
    { label: 'Debt to equity', get: (c) => c.row.de, fmt: ((v: number) => v.toFixed(2)) as never, metric: 'leverage' } ] },
  risk: { label: 'Risk', lines: [
    { label: 'Screen risk grade', get: (c) => c.row.risk_lvl, fmt: ((v: string) => v) as never }, { label: 'Flags raised', get: (c) => (c.risk ? c.risk.flags.length : null), fmt: ((v: number) => String(v)) as never },
    { label: 'Main flag', get: (c) => c.row.risk_top, fmt: ((v: string) => v) as never } ] },
};
/** Loads each chosen company's file. The set can change as names are added or removed, so this is an effect, not a hook per name. */
function useCompanies(syms: string[]) {
  const key = syms.join(','); const [st, set] = useState<{ data: Record<string, Company>; errs: Record<string, string> }>({ data: {}, errs: {} });
  useEffect(() => {
    let live = true;
    for (const x of syms) getJson<Company>(`/data/c/${encodeURIComponent(x)}.json`).then((d) => live && set((s) => ({ data: { ...s.data, [x]: d }, errs: { ...s.errs, [x]: '' } }))).catch((e: Error) => live && set((s) => ({ ...s, errs: { ...s.errs, [x]: e.message } })));
    return () => { live = false; };
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}
const setSyms = (next: string[]) => go(`/compare?s=${next.join(',')}`);

/** Choose another company to put beside the ones already chosen: search by name or symbol, or take a peer from the same sector. */
function Picker({ syms }: { syms: string[] }) {
  const scr = useScreen(); const [q, setQ] = useState(''); const rows = scr.data?.rows ?? [];
  const first = rows.find((r) => r.sym === syms[0]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const ok = rows.filter((r) => !syms.includes(r.sym) && (t.length >= 2 ? r.sym.toLowerCase().includes(t) || r.name.toLowerCase().includes(t) : r.sector === first?.sector && r.liquid));
    return (t.length >= 2 ? ok : ok.sort((a, b) => (b.turnover_cr ?? 0) - (a.turnover_cr ?? 0))).slice(0, 6);
  }, [rows, q, syms.join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (syms.length >= 3) return null;
  return <div className="card" style={{ marginBottom: 10 }}>
    <label className="l" htmlFor="cmp-add" style={{ marginTop: 0 }}>{syms.length < 2 ? `Compare ${syms[0] ?? 'a company'} with…` : 'Add a third company'}</label>
    <input id="cmp-add" className="field" type="search" placeholder="Company or symbol" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
    {scr.loading && <div className="sk" style={{ height: 40, marginTop: 8 }} />}
    <div className="small mute" style={{ margin: '8px 0 2px' }}>{q.trim().length >= 2 ? 'Matches' : first?.sector ? `Largest ${first.sector} names by value traded` : 'Search to begin'}</div>
    <div className="list">{list.map((r) => <button key={r.sym} className="pick-row" onClick={() => { setSyms([...syms, r.sym]); setQ(''); }}>
      <span className="avatar" aria-hidden="true">{initials(r.sym)}</span><span className="grow" style={{ minWidth: 0 }}><span className="sym" style={{ display: 'block' }}>{r.sym}</span><span className="dim small trunc" style={{ display: 'block' }}>{r.name}</span></span><span className="tag lime">Add</span></button>)}
      {q.trim().length >= 2 && !list.length && <p className="dim small" style={{ margin: '8px 0 0' }}>No company matches “{q.trim()}”.</p>}</div></div>;
}

export function Compare({ syms }: { syms: string[] }) {
  const s = useAppState(); const { toast } = useUi();
  const [view, setView] = useState<View>('overview');
  const { data, errs } = useCompanies(syms); useWatchQuotes(syms); const quotes = useQuotes(syms);
  const cs = syms.map((x) => data[x]);
  const ready = syms.length > 0 && cs.every((c) => c);
  const saved = s.compares.some((c) => [...c].sort().join() === [...syms].sort().join());
  return <div>
    <PageBar title="Compare" onBack sub={syms.join(' · ') || undefined} />
    {syms.length > 0 && <div className="cchips" role="list" aria-label="Companies being compared">{syms.map((x) => <span key={x} role="listitem" className="cchip">{x}<button aria-label={`Remove ${x} from the comparison`} onClick={() => setSyms(syms.filter((y) => y !== x))}>×</button></span>)}</div>}
    <Picker syms={syms} />
    {syms.length < 2 ? <Empty title={syms.length ? `Add one more to compare with ${syms[0]}` : 'Pick two companies'}>Search above, or take a peer from the same sector. Up to three. You can also tick the compare button on rows in Discover.</Empty> : <>
      {Object.entries(errs).filter(([, e]) => e).map(([k, e]) => <Failed key={k} what={k} err={e} retry={() => location.reload()} />)}
      <CompareChart syms={syms} />
      <div className="chips" role="group" aria-label="Comparison view" style={{ margin: '12px 0 10px' }}>{(Object.keys(VIEWS) as View[]).map((id) => <button key={id} className="chip" aria-pressed={view === id} onClick={() => setView(id)}>{VIEWS[id].label}</button>)}</div>
      {!ready ? <div className="card"><div className="sk" style={{ height: 120 }} /></div> : <div className="card cmp" style={{ padding: '0 14px 6px' }}><table className="tbl" style={{ tableLayout: 'fixed', width: '100%' }}>
        <thead><tr><th className="s" scope="col" style={{ width: '34%' }}><span className="sr">Measure</span></th>{cs.map((c) => <th key={c!.sym} className="s" scope="col"><a href={`#/c/${c!.sym}`}>{c!.sym}</a></th>)}</tr></thead>
        <tbody>{VIEWS[view].lines.map((ln) => {
          const vals = cs.map((c) => { if (ln.metric) { const e = eligibilityOf(c!.row, c!.years); if (!meaningful(e, ln.metric)) return { v: null as null, why: `not meaningful: ${e.metrics[ln.metric].reason}` }; } const lp = ln.live ? livePrice(c!.row, quotes[c!.sym]) : null; const v = lp ? (ln.live === 'px' ? lp.px : lp.ch) : ln.get(c!); return { v: v === undefined || v === '' ? null : v, why: 'not reported' }; });
          const nums = vals.map((x) => (isNum(x.v) ? x.v : null)); const meas = nums.filter(isNum);
          const top = ln.best && meas.length > 1 ? (ln.best === 'high' ? Math.max(...meas) : Math.min(...meas)) : null;
          return <tr key={ln.label}><td>{ln.label}</td>{vals.map((x, i) => <td key={i} className="num" style={isNum(top) && nums[i] === top ? { color: 'var(--lime)', fontWeight: 700 } : undefined}>{x.v === null ? <span className="mute small">{x.why}</span> : (ln.fmt as (v: unknown) => string)(x.v)}</td>)}</tr>;
        })}</tbody></table></div>}
      {ready && <p className="small dim" style={{ marginTop: 10 }}>{diffs(cs as Company[])} Highlighted figures are the highest or lowest among those measured. They are not a verdict: they carry different risks.</p>}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn grow" disabled={saved} onClick={() => { setState((x) => saveCompare(x, syms)); toast('Comparison saved to My Desk'); }}>{saved ? 'Saved' : 'Save comparison'}</button>
      </div></>}
  </div>;
}
function diffs(cs: Company[]): string {
  const best = (f: (c: Company) => number | null | undefined, hi = true) => { const m = cs.map((c) => ({ s: c.sym, v: f(c) })).filter((x) => isNum(x.v)) as { s: string; v: number }[]; if (m.length < 2) return null; return m.sort((a, b) => (hi ? b.v - a.v : a.v - b.v))[0]; };
  const roce = best((c) => (isFinancialSector(c.row) ? null : c.row.roce_med)), pe = best((c) => (isNum(c.row.pe) && c.row.pe > 0 ? c.row.pe : null), false), g = best((c) => c.row.rev_cagr);
  return [roce && `${roce.s} has the highest median ROCE (${roce.v.toFixed(1)}%).`, pe && `${pe.s} has the lowest PE (${pe.v.toFixed(1)}).`, g && `${g.s} has the fastest 3-year revenue growth (${g.v.toFixed(1)}%).`].filter(Boolean).join(' ') || 'Not enough measured figures to say how they differ.';
}
void cr; void dash;
