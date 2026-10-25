import { useMemo, useState } from 'react';
import { go, setState, useAppState } from '../app.tsx';
import { useCompany } from '../data.ts';
import { Empty, useUi } from '../ui.tsx';
import { Failed, PageBar } from './common.tsx';
import { isLender, trendOf, TREND_WORD } from '../screen.ts';
import { cr, dash, inr, isNum, pct, x1 } from '../fmt.ts';
import { saveCompare } from '../store.ts';
import type { Company } from '../data.ts';

type View = 'overview' | 'growth' | 'profit' | 'value' | 'balance' | 'risk';
type Line = { label: string; get: (c: Company) => number | null | undefined | string; fmt: (v: never) => string; best?: 'high' | 'low'; lender?: boolean };
const num = (f: (c: Company) => number | null | undefined) => f;
const VIEWS: Record<View, { label: string; lines: Line[] }> = {
  overview: { label: 'Overview', lines: [
    { label: 'Price', get: (c) => c.row.price, fmt: inr as never }, { label: 'Day', get: (c) => c.row.r1d, fmt: pct as never },
    { label: 'Against the Nifty, 3m (pts)', get: (c) => c.row.rs3m, fmt: ((v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`) as never, best: 'high' },
    { label: 'From 52-week high', get: (c) => c.row.from_high, fmt: pct as never, best: 'high' }, { label: 'Trend', get: (c) => { const x = trendOf(c.row).trend; return x ? TREND_WORD[x] : null; }, fmt: ((v: string) => v) as never },
    { label: 'Size', get: (c) => c.row.tier, fmt: ((v: string) => v) as never }, { label: 'Sector', get: (c) => c.row.sector, fmt: ((v: string) => v) as never } ] },
  growth: { label: 'Growth', lines: [
    { label: 'Revenue growth, 3y', get: (c) => c.row.rev_cagr, fmt: pct as never, best: 'high' }, { label: 'EPS growth, 3y', get: (c) => c.row.eps_cagr, fmt: pct as never, best: 'high' } ] },
  profit: { label: 'Profit', lines: [
    { label: 'ROCE (median)', get: (c) => c.row.roce_med, fmt: ((v: number) => pct(v, 1, false)) as never, best: 'high', lender: true },
    { label: 'EBIT margin', get: (c) => c.row.ebit_margin, fmt: ((v: number) => pct(v, 1, false)) as never, best: 'high', lender: true },
    { label: 'Net margin', get: (c) => c.row.net_margin, fmt: ((v: number) => pct(v, 1, false)) as never, best: 'high' } ] },
  value: { label: 'Valuation', lines: [
    { label: 'PE (trailing)', get: (c) => c.row.pe, fmt: x1 as never }, { label: 'Price to book', get: (c) => c.row.pb, fmt: x1 as never }, { label: 'Dividend yield', get: (c) => c.row.div_yield, fmt: ((v: number) => pct(v, 2, false)) as never } ] },
  balance: { label: 'Balance sheet', lines: [
    { label: 'Debt to equity', get: (c) => c.row.de, fmt: ((v: number) => v.toFixed(2)) as never, lender: true } ] },
  risk: { label: 'Risk', lines: [
    { label: 'Screen risk grade', get: (c) => c.row.risk_lvl, fmt: ((v: string) => v) as never }, { label: 'Flags raised', get: (c) => (c.risk ? c.risk.flags.length : null), fmt: ((v: number) => String(v)) as never },
    { label: 'Main flag', get: (c) => c.row.risk_top, fmt: ((v: string) => v) as never } ] },
};
function Col({ sym, onData }: { sym: string; onData: (c: Company | null, e: string | null) => void }) { const c = useCompany(sym); useMemoOnce(() => onData(c.data, c.err), [c.data, c.err]); return null; }
function useMemoOnce(fn: () => void, deps: unknown[]) { useMemo(() => { Promise.resolve().then(fn); }, deps); }   // eslint-disable-line react-hooks/exhaustive-deps

export function Compare({ syms }: { syms: string[] }) {
  const s = useAppState(); const { toast } = useUi();
  const [view, setView] = useState<View>('overview');
  const [data, setData] = useState<Record<string, Company | null>>({}); const [errs, setErrs] = useState<Record<string, string | null>>({});
  const cs = syms.map((x) => data[x]);
  const ready = syms.length > 0 && cs.every((c) => c);
  const saved = s.compares.some((c) => [...c].sort().join() === [...syms].sort().join());
  return <div>
    <PageBar title="Compare" onBack sub={syms.join(' · ') || undefined} />
    {syms.map((x) => <Col key={x} sym={x} onData={(c, e) => { setData((d) => (d[x] === c ? d : { ...d, [x]: c })); setErrs((d) => (d[x] === e ? d : { ...d, [x]: e })); }} />)}
    {syms.length < 2 ? <Empty title="Pick at least two companies" action={<button className="btn pri" onClick={() => go('/discover')}>Choose in Discover</button>}>Use the compare button on any row in Discover. Up to three.</Empty> : <>
      {Object.entries(errs).filter(([, e]) => e).map(([k, e]) => <Failed key={k} what={k} err={e!} retry={() => location.reload()} />)}
      <div className="chips" role="group" aria-label="Comparison view" style={{ marginBottom: 10 }}>{(Object.keys(VIEWS) as View[]).map((id) => <button key={id} className="chip" aria-pressed={view === id} onClick={() => setView(id)}>{VIEWS[id].label}</button>)}</div>
      {!ready ? <div className="card"><div className="sk" style={{ height: 120 }} /></div> : <div className="card cmp" style={{ padding: '0 14px 6px' }}><table className="tbl" style={{ tableLayout: 'fixed', width: '100%' }}>
        <thead><tr><th className="s" scope="col" style={{ width: '34%' }}><span className="sr">Measure</span></th>{cs.map((c) => <th key={c!.sym} className="s" scope="col"><a href={`#/c/${c!.sym}`}>{c!.sym}</a></th>)}</tr></thead>
        <tbody>{VIEWS[view].lines.map((ln) => {
          const vals = cs.map((c) => { if (ln.lender && isLender(c!.row)) return { v: null as null, why: 'not meaningful for a lender' }; const v = ln.get(c!); return { v: v === undefined || v === '' ? null : v, why: 'not reported' }; });
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
  const roce = best((c) => (isLender(c.row) ? null : c.row.roce_med)), pe = best((c) => (isNum(c.row.pe) && c.row.pe > 0 ? c.row.pe : null), false), g = best((c) => c.row.rev_cagr);
  return [roce && `${roce.s} has the highest median ROCE (${roce.v.toFixed(1)}%).`, pe && `${pe.s} has the lowest PE (${pe.v.toFixed(1)}).`, g && `${g.s} has the fastest 3-year revenue growth (${g.v.toFixed(1)}%).`].filter(Boolean).join(' ') || 'Not enough measured figures to say how they differ.';
}
void cr; void dash;
