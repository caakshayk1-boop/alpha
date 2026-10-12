'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import { DataStamp } from '@/components/DataStamp';
import SymbolPicker from '@/components/SymbolPicker';
import { Async, Chg, Notice, PageHead, Rv } from '@/components/ui';
import { useFeed, useShard } from '@/lib/data';
import { crore, dash, num } from '@/lib/format';
import type { Row } from '@/lib/types';

const COLORS = ['var(--accent)', 'var(--up)', 'var(--warn)', 'var(--down)'];
const has = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const PERIOD_DEPENDENT = new Set(['Revenue CAGR', 'EPS CAGR']);
type Spec = { label: string; get: (r: Row) => number | null | undefined; fmt: (v: number) => string; better: 'high' | 'low' | null };
const SPECS: Spec[] = [
  { label: 'Market cap', get: (r) => r.mcap_cr, fmt: (v) => crore(v), better: null },
  { label: 'Composite score', get: (r) => r.comp, fmt: (v) => v.toFixed(0), better: 'high' },
  { label: 'Quality', get: (r) => r.q, fmt: (v) => v.toFixed(0), better: 'high' },
  { label: 'Growth', get: (r) => r.g, fmt: (v) => v.toFixed(0), better: 'high' },
  { label: 'Value', get: (r) => r.v, fmt: (v) => v.toFixed(0), better: 'high' },
  { label: 'Technical', get: (r) => r.tech, fmt: (v) => v.toFixed(0), better: 'high' },
  { label: 'P/E', get: (r) => (has(r.pe) && r.pe > 0 ? r.pe : null), fmt: (v) => `${v.toFixed(1)}×`, better: 'low' },
  { label: 'P/B', get: (r) => r.pb, fmt: (v) => `${v.toFixed(2)}×`, better: 'low' },
  { label: 'ROCE', get: (r) => r.roce, fmt: (v) => `${v.toFixed(1)}%`, better: 'high' },
  { label: 'ROE', get: (r) => r.roe, fmt: (v) => `${v.toFixed(1)}%`, better: 'high' },
  { label: 'EBIT margin', get: (r) => r.ebit_margin, fmt: (v) => `${v.toFixed(1)}%`, better: 'high' },
  { label: 'Debt / equity', get: (r) => r.de, fmt: (v) => v.toFixed(2), better: 'low' },
  { label: 'Revenue CAGR', get: (r) => r.rev_cagr, fmt: (v) => `${v.toFixed(1)}%`, better: 'high' },
  { label: 'EPS CAGR', get: (r) => r.eps_cagr, fmt: (v) => `${v.toFixed(1)}%`, better: 'high' },
  { label: 'Cash conversion', get: (r) => r.cfo_pat, fmt: (v) => `${v.toFixed(2)}×`, better: 'high' },
  { label: 'Dividend yield', get: (r) => r.div_yield, fmt: (v) => `${v.toFixed(2)}%`, better: 'high' },
  { label: 'Piotroski F', get: (r) => r.piotroski, fmt: (v) => `${v.toFixed(0)}/9`, better: 'high' },
  { label: '1 year', get: (r) => r.r1y, fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`, better: 'high' },
  { label: 'From 52-week high', get: (r) => r.from_high, fmt: (v) => `${v.toFixed(0)}%`, better: 'high' },
];

function Radar({ rows }: { rows: Row[] }) {
  const axes: [string, (r: Row) => number | null | undefined][] = [['Quality', (r) => r.q], ['Growth', (r) => r.g], ['Value', (r) => r.v], ['Technical', (r) => r.tech], ['Composite', (r) => r.comp]];
  const C = 120, R = 92;
  const pt = (i: number, v: number) => { const a = (-Math.PI / 2) + (i / axes.length) * Math.PI * 2; return [C + Math.cos(a) * R * (v / 100), C + Math.sin(a) * R * (v / 100)] as const; };
  return (
    <svg viewBox="0 0 240 240" style={{ width: '100%', maxWidth: 360, margin: '0 auto', display: 'block' }} role="img" aria-label="Score profile of each company">
      {[25, 50, 75, 100].map((g) => <polygon key={g} points={axes.map((_, i) => pt(i, g).join(',')).join(' ')} fill="none" stroke="var(--line-2)" />)}
      {axes.map(([l], i) => { const [x, y] = pt(i, 112); return <text key={l} x={x} y={y + 4} textAnchor="middle" fontSize="10" fill="var(--dim)" fontFamily="var(--f-mono)">{l}</text>; })}
      {rows.map((r, k) => <polygon key={r.sym} points={axes.map(([, g], i) => pt(i, Math.max(2, Math.min(100, g(r) ?? 0))).join(',')).join(' ')} fill={COLORS[k]} fillOpacity=".14" stroke={COLORS[k]} strokeWidth="2" />)}
    </svg>
  );
}

function Compare() {
  const sp = useSearchParams();
  const router = useRouter();
  const syms = (sp.get('s') ?? '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean).slice(0, 4);
  const s = useFeed('screen');
  const sh = [useShard(syms[0] ?? ''), useShard(syms[1] ?? ''), useShard(syms[2] ?? ''), useShard(syms[3] ?? '')];
  const yearsOf = (sym: string) => { const i = syms.indexOf(sym); const y = i >= 0 ? sh[i].data?.years : null; return y ? y.length : null; };
  const rows = useMemo(() => syms.map((x) => s.data?.rows.find((r) => r.sym.toUpperCase() === x)).filter((r): r is Row => !!r), [s.data, syms.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (next: string[]) => router.replace(next.length ? `/compare/?s=${next.join(',')}` : '/compare/');
  return (
    <>
      <PageHead eyebrow="Compare" title="Side by side," em="up to four." lede="Pick companies, see every number in one table, with the highest or lowest marked where that is meaningful, and the shape of each one's scores on a single chart." />
      <section className="wrap">
        <div className="filters">
          <SymbolPicker onPick={(x) => syms.length < 4 && set([...syms, x])} placeholder={syms.length < 4 ? 'Add a company…' : 'Four is the limit'} exclude={syms} />
          {syms.map((x, i) => <button key={x} className="chip on" style={{ background: COLORS[i], borderColor: COLORS[i], color: '#0a0c14' }} onClick={() => set(syms.filter((y) => y !== x))} aria-label={`Remove ${x}`}>{x} ✕</button>)}
        </div>
        <Async loading={s.loading} error={s.error} rows={3}>
          {rows.length >= 2 && <div style={{ margin: '0 0 12px' }}><DataStamp ids={['screen']} /></div>}
          {rows.length < 2 ? <Notice>Add at least two companies. Try <Link href="/compare/?s=TCS,INFY,HCLTECH" style={{ color: 'var(--accent-2)' }}>TCS, Infosys and HCLTech</Link>.</Notice> : (
            <div className="grid g-7-5" style={{ alignItems: 'start' }}>
              <div className="tbl-wrap" style={{ maxHeight: 'none' }}>
                <table className="tbl" style={{ minWidth: 560 }}>
                  <thead><tr><th>Measure</th>{rows.map((r, i) => <th key={r.sym} style={{ color: COLORS[i] }}><Link href={`/company/?s=${r.sym}`}>{r.sym}</Link></th>)}</tr></thead>
                  <tbody>
                    <tr style={{ cursor: 'default' }}><td>Price</td>{rows.map((r) => <td key={r.sym} className="num">₹{num(r.price, 2)}</td>)}</tr>
                    <tr style={{ cursor: 'default' }}><td>Today</td>{rows.map((r) => <td key={r.sym}><Chg v={r.r1d} dp={1} /></td>)}</tr>
                    <tr style={{ cursor: 'default' }}><td>Statement years on file</td>{rows.map((r) => <td key={r.sym} className="num">{yearsOf(r.sym) ?? dash}</td>)}</tr>
                    {SPECS.map((sp2) => {
                      const vals = rows.map((r) => sp2.get(r));
                      const nums = vals.filter(has);
                      const yrs = rows.map((r) => yearsOf(r.sym));
                      const periodsAgree = !PERIOD_DEPENDENT.has(sp2.label) || (yrs.every((y) => y !== null) && new Set(yrs).size === 1);
                      const best = sp2.better && periodsAgree && nums.length > 1 ? (sp2.better === 'high' ? Math.max(...nums) : Math.min(...nums)) : null;
                      return <tr key={sp2.label} style={{ cursor: 'default' }}><td>{sp2.label}</td>{vals.map((v, i) => <td key={i} className="num" style={best !== null && v === best ? { color: 'var(--up)', fontWeight: 700 } : undefined}>{has(v) ? sp2.fmt(v) : <span title="Not in the feed for this company" aria-label="Not available">{dash}</span>}{best !== null && v === best ? <span className="sr">{sp2.better === 'high' ? ' (highest in this comparison)' : ' (lowest in this comparison)'}</span> : null}</td>)}</tr>;
                    })}
                  </tbody>
                </table>
              </div>
              <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 12 }}>Score profile</div><Radar rows={rows} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 10 }}>{rows.map((r, i) => <span key={r.sym} className="num" style={{ color: COLORS[i], fontSize: 12.5 }}>● {r.sym}</span>)}</div>
                <p className="dim" style={{ fontSize: 12.5, margin: '12px 0 0' }}>Green marks the highest or lowest in a row where higher or lower is clearly better, among the companies shown. A dash means the number is not in the feed: it is left out of the comparison, never counted as zero. CAGR rows are marked only when every company has the same number of statement years; otherwise they are shown without a winner, and banks and lenders have no ROCE or cash-conversion figure. It is arithmetic, not advice: a cheaper P/E can be cheap for a reason.</p></Rv>
            </div>
          )}
        </Async>
      </section>
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="wrap section"><h1 className="sr">Compare companies side by side</h1></div>}><Compare /></Suspense>;
}
