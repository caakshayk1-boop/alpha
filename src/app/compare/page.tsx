'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import { DataStamp } from '@/components/DataStamp';
import SymbolPicker from '@/components/SymbolPicker';
import { Async, Chg, Notice, PageHead, Rv } from '@/components/ui';
import { useFeedWhen, useShard } from '@/lib/data';
import { crore, dash, num } from '@/lib/format';
import type { Row } from '@/lib/types';
import { companyHref } from '@/lib/slug';

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

/** One small score profile per company, titled with its name (small multiples). Identity comes from the label, not a colour:
 *  four overlaid polygons needed four hues, and no set of four non-gain/loss hues stays apart on the dark surface (checked with
 *  the dataviz palette validator, 15 Oct). Same scale (0 to 100) and same axes in every panel, so shapes compare directly. */
const AXES: [string, (r: Row) => number | null | undefined][] = [['Quality', (r) => r.q], ['Growth', (r) => r.g], ['Value', (r) => r.v], ['Technical', (r) => r.tech], ['Composite', (r) => r.comp]];
function Radar({ r }: { r: Row }) {
  const C = 80, R = 52;
  const pt = (i: number, v: number) => { const a = (-Math.PI / 2) + (i / AXES.length) * Math.PI * 2; return [C + Math.cos(a) * R * (v / 100), C + Math.sin(a) * R * (v / 100)] as const; };
  const label = AXES.map(([l, g]) => `${l} ${has(g(r)) ? Math.round(g(r) as number) : 'not scored'}`).join(', ');
  return (
    <figure style={{ margin: 0, textAlign: 'center' }}>
      <figcaption style={{ font: '600 15px var(--f-ui)' }}><Link href={companyHref(r.sym)}>{r.sym}</Link></figcaption>
      <svg viewBox="-24 0 208 160" style={{ width: '100%', maxWidth: 200, display: 'block', margin: '0 auto' }} role="img" aria-label={`${r.sym} scores: ${label}`}>
        {[50, 100].map((g) => <polygon key={g} points={AXES.map((_, i) => pt(i, g).join(',')).join(' ')} fill="none" stroke="var(--line-2)" />)}
        {AXES.map(([l], i) => { const [x, y] = pt(i, 128); return <text key={l} x={x} y={y + 3} textAnchor="middle" fontSize="9" fill="var(--dim)" fontFamily="var(--f-ui)">{l}</text>; })}
        <polygon points={AXES.map(([, g], i) => pt(i, Math.max(2, Math.min(100, g(r) ?? 0))).join(',')).join(' ')} fill="var(--accent)" fillOpacity=".16" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </figure>
  );
}

const EXAMPLES: [string, string][] = [['IT services', 'TCS,INFY,HCLTECH,WIPRO'], ['Private banks', 'HDFCBANK,ICICIBANK,KOTAKBANK,AXISBANK'], ['FMCG', 'HINDUNILVR,NESTLEIND,BRITANNIA,DABUR']];

function Compare() {
  const sp = useSearchParams();
  const router = useRouter();
  const syms = (sp.get('s') ?? '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean).slice(0, 4);
  const sh = [useShard(syms[0] ?? ''), useShard(syms[1] ?? ''), useShard(syms[2] ?? ''), useShard(syms[3] ?? '')];
  // Each company's row comes from its own 6 KB file; the 490 KB screen is fetched only if one of those is missing.
  const needFull = syms.some((x, i) => !!x && !!sh[i].error);
  const s = useFeedWhen('screen', needFull);
  const yearsOf = (sym: string) => { const i = syms.indexOf(sym); const y = i >= 0 ? sh[i].data?.years : null; return y ? y.length : null; };
  // the periods a CAGR spans: first and last statement date, not just how many years
  const spanOf = (sym: string) => { const i = syms.indexOf(sym); const y = i >= 0 ? sh[i].data?.years : null; return y && y.length ? `${y[0].end}|${y[y.length - 1].end}` : null; };
  const shardRows = sh.map((x) => x.data?.row ?? null);
  const rows = useMemo(() => syms.map((x, i) => shardRows[i] ?? s.data?.rows.find((r) => r.sym.toUpperCase() === x)).filter((r): r is Row => !!r), [s.data, syms.join(','), ...shardRows]); // eslint-disable-line react-hooks/exhaustive-deps
  const loading = syms.some((x, i) => !!x && sh[i].loading) || (needFull && s.loading);
  const set = (next: string[]) => router.replace(next.length ? `/compare/?s=${next.join(',')}` : '/compare/');
  return (
    <>
      <PageHead eyebrow="Compare" title="Side by side," em="up to four." lede="Pick companies, see every number in one table, with the highest or lowest marked where that is meaningful, and each one's score profile drawn on the same scale." />
      <section className="wrap">
        <div className="filters">
          <SymbolPicker onPick={(x) => syms.length < 4 && set([...syms, x])} placeholder={syms.length < 4 ? 'Add a company…' : 'Four is the limit'} exclude={syms} />
          {syms.map((x) => <button key={x} className="chip on" onClick={() => set(syms.filter((y) => y !== x))} aria-label={`Remove ${x}`}>{x} ✕</button>)}
        </div>
        <Async loading={loading} error={needFull ? s.error : null} rows={3}>
          {rows.length >= 2 && <div style={{ margin: '0 0 12px' }}><DataStamp ids={['screen']} /></div>}
          {rows.length < 2 ? (
            <div className="panel">
              <div className="eyebrow">Start with a set</div>
              <p className="disp" style={{ fontSize: 26, lineHeight: 1.2, margin: '10px 0 14px' }}>Add two to four companies above, or open a ready-made comparison.</p>
              <div className="filters" style={{ margin: 0 }}>{EXAMPLES.map(([l, q]) => <button key={l} className="chip" onClick={() => set(q.split(','))}>{l}: {q.split(',').join(', ')}</button>)}</div>
            </div>
          ) : (
            <div className="grid g-7-5" style={{ alignItems: 'start' }}>
              <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)" style={{ maxHeight: 'none' }}>
                <table className="tbl" style={{ minWidth: 560 }}>
                  <thead><tr><th>Measure</th>{rows.map((r) => <th key={r.sym}><Link href={companyHref(r.sym)}>{r.sym}</Link></th>)}</tr></thead>
                  <tbody>
                    <tr style={{ cursor: 'default' }}><td>Price</td>{rows.map((r) => <td key={r.sym} className="num">₹{num(r.price, 2)}</td>)}</tr>
                    <tr style={{ cursor: 'default' }}><td>Today</td>{rows.map((r) => <td key={r.sym}><Chg v={r.r1d} dp={1} /></td>)}</tr>
                    <tr style={{ cursor: 'default' }}><td>Statement years on file</td>{rows.map((r) => <td key={r.sym} className="num">{yearsOf(r.sym) ?? dash}<div className="dim" style={{ fontSize: 12 }}>{spanOf(r.sym)?.split('|').reverse().map((d) => d.slice(0, 7)).join(' → ') ?? ''}</div></td>)}</tr>
                    {SPECS.map((sp2) => {
                      const vals = rows.map((r) => sp2.get(r));
                      const nums = vals.filter(has);
                      const spans = rows.map((r) => spanOf(r.sym));
                      const periodsAgree = !PERIOD_DEPENDENT.has(sp2.label) || (spans.every((y) => y !== null) && new Set(spans).size === 1);
                      const best = sp2.better && periodsAgree && nums.length > 1 ? (sp2.better === 'high' ? Math.max(...nums) : Math.min(...nums)) : null;
                      return <tr key={sp2.label} style={{ cursor: 'default' }}><td>{sp2.label}</td>{vals.map((v, i) => <td key={i} className="num" style={best !== null && v === best ? { fontWeight: 700 } : undefined}>{has(v) ? sp2.fmt(v) : <span title="Not in the feed for this company" aria-label="Not available">{dash}</span>}{best !== null && v === best ? <span className="tag acc" style={{ marginLeft: 6, fontSize: 11.5 }}>{sp2.better === 'high' ? 'highest' : 'lowest'}</span> : null}</td>)}</tr>;
                    })}
                  </tbody>
                </table>
              </div>
              <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 12 }}>Score profiles · percentiles, 0 to 100</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>{rows.map((r) => <Radar key={r.sym} r={r} />)}</div>
                <p className="dim" style={{ fontSize: 13.5, margin: '12px 0 0' }}>A tag marks the highest or lowest in a row where higher or lower is clearly better, among the companies shown. A dash means the number is not in the feed: it is left out of the comparison, never counted as zero. CAGR rows are marked only when every company&apos;s statements cover the same period; otherwise they are shown without a winner, and banks and lenders have no ROCE or cash-conversion figure. It is arithmetic, not advice: a cheaper P/E can be cheap for a reason.</p></Rv>
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
