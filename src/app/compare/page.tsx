'use client';
import { LENDER_NA, isLender } from '@/lib/sector';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { DataStamp } from '@/components/DataStamp';
import SymbolPicker from '@/components/SymbolPicker';
import { Async, Chg, Flash, Notice, PageHead, Rv, Segmented } from '@/components/ui';
import { useStoredPreset } from '@/lib/layout';
import { useFeedWhen, useLive, useShard } from '@/lib/data';
import { priceLabel, priceView, sessionLabel } from '@/lib/price';
import { crore, dash, num, pct, ratio } from '@/lib/format';
import type { Row } from '@/lib/types';
import { companyHref } from '@/lib/slug';

const has = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const PERIOD_DEPENDENT = new Set(['Revenue CAGR', 'EPS CAGR']);
/** `material`: the smallest difference between the best and the next value that is worth marking (Pro §22.5): in the
 *  measure's own units for levels (5 points of a margin, 0.3 of debt/equity), or as a share for multiples (`rel`). Below it
 *  the row stays neutral: a 0.4-point gap in ROCE is noise, not a winner. */
type Spec = { label: string; quick?: boolean; get: (r: Row) => number | null | undefined; fmt: (v: number) => string; better: 'high' | 'low' | null; material?: number; rel?: boolean };
const SPECS: Spec[] = [
  { label: 'Market cap', get: (r) => r.mcap_cr, fmt: (v) => crore(v), better: null },
  { label: 'Composite score', quick: true, material: 10, get: (r) => r.comp, fmt: (v) => num(v, 0), better: 'high' },
  { label: 'Quality', quick: true, material: 10, get: (r) => r.q, fmt: (v) => num(v, 0), better: 'high' },
  { label: 'Growth', quick: true, material: 10, get: (r) => r.g, fmt: (v) => num(v, 0), better: 'high' },
  { label: 'Value', quick: true, material: 10, get: (r) => r.v, fmt: (v) => num(v, 0), better: 'high' },
  { label: 'Technical', quick: true, material: 10, get: (r) => r.tech, fmt: (v) => num(v, 0), better: 'high' },
  { label: 'P/E', quick: true, material: 0.2, rel: true, get: (r) => (has(r.pe) && r.pe > 0 ? r.pe : null), fmt: (v) => `${ratio(v, 1)}`, better: 'low' },
  { label: 'P/B', material: 0.2, rel: true, get: (r) => r.pb, fmt: (v) => `${ratio(v, 2)}`, better: 'low' },
  { label: 'ROCE', quick: true, material: 5, get: (r) => r.roce, fmt: (v) => `${pct(v, 1, false)}`, better: 'high' },
  { label: 'ROE', material: 5, get: (r) => r.roe, fmt: (v) => `${pct(v, 1, false)}`, better: 'high' },
  { label: 'EBIT margin', material: 5, get: (r) => r.ebit_margin, fmt: (v) => `${pct(v, 1, false)}`, better: 'high' },
  { label: 'Debt / equity', quick: true, material: 0.3, get: (r) => r.de, fmt: (v) => num(v, 2), better: 'low' },
  { label: 'Revenue CAGR', material: 5, get: (r) => r.rev_cagr, fmt: (v) => `${pct(v, 1, false)}`, better: 'high' },
  { label: 'EPS CAGR', material: 5, get: (r) => r.eps_cagr, fmt: (v) => `${pct(v, 1, false)}`, better: 'high' },
  { label: 'Cash conversion', material: 0.2, get: (r) => r.cfo_pat, fmt: (v) => `${ratio(v, 2)}`, better: 'high' },
  { label: 'Dividend yield', material: 1, get: (r) => r.div_yield, fmt: (v) => `${pct(v, 2, false)}`, better: 'high' },
  { label: 'Piotroski F', material: 2, get: (r) => r.piotroski, fmt: (v) => `${num(v, 0)}/9`, better: 'high' },
  { label: '1 year', quick: true, material: 10, get: (r) => r.r1y, fmt: (v) => `${pct(v, 1)}`, better: 'high' },
  { label: 'From 52-week high', material: 10, get: (r) => r.from_high, fmt: (v) => `${pct(v, 0, false)}`, better: 'high' },
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
  const lv = useLive();
  // layout preset (Pro §28 P2): Quick look keeps the scores, P/E, ROCE, leverage and the year's return; Deep dive shows all
  const [preset, setPreset] = useStoredPreset('alpha-compare-layout');
  // linked views: pointing at or focusing any part of one company (its column, a cell, its score shape) highlights all of it
  const [focusCol, setFocusCol] = useState<number | null>(null);
  const linkOn = (e: React.SyntheticEvent) => { const c = (e.target as HTMLElement).closest<HTMLElement>('[data-col]')?.dataset.col; setFocusCol(c === undefined ? null : Number(c)); };
  const set = (next: string[]) => router.replace(next.length ? `/compare/?s=${next.join(',')}` : '/compare/');
  return (
    <>
      <PageHead method="compare" eyebrow="Compare" title="Side by side," em="up to four." />
      <section className="wrap wide">
        <div className="cmp-bar">
          <ol className="cmp-slots" aria-label={`Companies chosen: ${syms.length} of 4`}>
            {[0, 1, 2, 3].map((i) => {
              const x = syms[i];
              return x
                ? <li key={x} className="cmp-slot on"><span className="cmp-i" aria-hidden>{i + 1}</span><Link href={companyHref(x)}><b>{x}</b></Link><button className="cmp-x" onClick={() => set(syms.filter((y) => y !== x))} aria-label={`Remove ${x}`}>✕</button></li>
                : <li key={`e${i}`} className="cmp-slot"><span className="cmp-i" aria-hidden>{i + 1}</span><span className="dim">{i < 2 ? 'Add a company' : 'Optional'}</span></li>;
            })}
          </ol>
          <div className="cmp-add">
            <SymbolPicker onPick={(x) => syms.length < 4 && set([...syms, x])} placeholder={syms.length < 4 ? 'Type a symbol or name…' : 'Four is the limit'} exclude={syms} />
            {syms.length > 0 && <button className="chip" onClick={() => set([])}>Clear all</button>}
          </div>
        </div>
        <Async loading={loading} error={needFull ? s.error : null} rows={3}>
          {rows.length >= 2 && <div style={{ margin: '0 0 12px' }}><DataStamp ids={['prices', 'screen']} /></div>}
          {rows.length < 2 ? (
            <div className="cmp-start">
              <ol className="cmp-steps" aria-label="How it works">
                <li className={syms.length >= 2 ? 'done' : 'now'}><b>Pick two to four</b><span>{syms.length === 1 ? `${syms[0]} is in. Add one more to start the table.` : 'Type a symbol or a name above, or open a set below.'}</span></li>
                <li><b>Read one table</b><span>Every number side by side; the highest or lowest is tagged where higher or lower is clearly better.</span></li>
                <li><b>Check the shapes</b><span>Each company&apos;s score profile on the same 0 to 100 scale.</span></li>
              </ol>
              <div className="eyebrow" style={{ margin: '20px 0 10px' }}>Ready-made sets</div>
              <div className="cmp-sets">
                {EXAMPLES.map(([l, q]) => (
                  <button key={l} className="cmp-set" onClick={() => set(q.split(','))}>
                    <b>{l}</b>
                    <span className="cmp-tk">{q.split(',').map((t) => <span key={t} className="tag">{t}</span>)}</span>
                    <span className="cmp-go">Compare these four <span aria-hidden>→</span></span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '0 0 12px' }}>
              <Segmented label="Layout" role="group" value={preset} onChange={setPreset} options={[['quick', 'Quick look'], ['deep', 'Deep dive']] as const} />
              <span className="dim" style={{ fontSize: 13.5 }}>{preset === 'quick' ? 'Scores, P/E, ROCE, leverage and the one-year return.' : 'Every measure on file.'} Point at a company to follow it across the table and its score shape.</span>
            </div>
            {focusCol !== null && <style>{`.cmp-linked [data-col="${focusCol}"] { background: var(--accent-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent); }`}</style>}
            <div className="grid g-7-5 cmp-linked" style={{ alignItems: 'start' }} onPointerOver={linkOn} onFocus={linkOn} onPointerLeave={() => setFocusCol(null)} onBlur={() => setFocusCol(null)}>
              <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)" style={{ maxHeight: 'none' }}>
                <table className="tbl" style={{ minWidth: 560 }}>
                  <thead><tr><th>Measure</th>{rows.map((r, ci) => <th key={r.sym} data-col={ci}><Link href={companyHref(r.sym)}>{r.sym}</Link></th>)}</tr></thead>
                  <tbody>
                    <tr style={{ cursor: 'default' }}><td>Price</td>{rows.map((r, ci) => { const pv = priceView(r.sym, r, lv.snap); return <td key={r.sym} data-col={ci} className="num"><Flash value={pv.price}>₹{num(pv.price, 2)}</Flash><div className="dim" style={{ fontSize: 12, fontWeight: 400 }}>{priceLabel(pv).text}</div></td>; })}</tr>
                    <tr style={{ cursor: 'default' }}><td>Day move</td>{rows.map((r, ci) => { const pv = priceView(r.sym, r, lv.snap); return <td key={r.sym} data-col={ci}><Flash value={pv.pct} dir={null}><Chg v={pv.pct} dp={1} /></Flash></td>; })}</tr>
                    <tr style={{ cursor: 'default' }}><td>Statement years on file</td>{rows.map((r, ci) => <td key={r.sym} data-col={ci} className="num">{yearsOf(r.sym) ?? dash}<div className="dim" style={{ fontSize: 12 }}>{spanOf(r.sym)?.split('|').reverse().map((d) => d.slice(0, 7)).join(' → ') ?? ''}</div></td>)}</tr>
                    {SPECS.filter((x) => preset === 'deep' || x.quick).map((sp2) => {
                      const vals = rows.map((r) => sp2.get(r));
                      const nums = vals.filter(has);
                      const spans = rows.map((r) => spanOf(r.sym));
                      const periodsAgree = !PERIOD_DEPENDENT.has(sp2.label) || (spans.every((y) => y !== null) && new Set(spans).size === 1);
                      // a lender's ROCE, margins, leverage and cash conversion are not comparable with an operating company's
                      const na = rows.map((r) => LENDER_NA.has(sp2.label) && isLender(r));
                      const cmp = vals.filter((v, i) => has(v) && !na[i]) as number[];
                      const sorted = [...cmp].sort((a, b) => (sp2.better === 'low' ? a - b : b - a));
                      const gap = sorted.length > 1 ? (sp2.rel ? Math.abs(sorted[0] / sorted[1] - 1) : Math.abs(sorted[0] - sorted[1])) : 0;
                      const best = sp2.better && periodsAgree && sorted.length > 1 && gap >= (sp2.material ?? 0) ? sorted[0] : null;
                      return <tr key={sp2.label} style={{ cursor: 'default' }}><td>{sp2.label}</td>{vals.map((v, i) => <td key={i} data-col={i} className="num" style={best !== null && v === best && !na[i] ? { fontWeight: 700 } : undefined}>{na[i] ? <span className="dim" title="The screen reads this measure differently for a bank, NBFC or insurer: debt is the raw material" style={{ fontSize: 12.5 }}>not comparable</span> : has(v) ? sp2.fmt(v) : <span title="Not in the feed for this company"><span aria-hidden>{dash}</span><span className="sr">not available</span></span>}{best !== null && v === best && !na[i] ? <span className="tag acc" style={{ marginLeft: 6, fontSize: 11.5 }}>{sp2.better === 'high' ? 'highest' : 'lowest'}</span> : null}</td>)}</tr>;
                    })}
                  </tbody>
                </table>
              </div>
              <Rv className="panel"><div className="eyebrow" style={{ marginBottom: 12 }}>Score profiles · percentiles, 0 to 100</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>{rows.map((r, ci) => <div key={r.sym} data-col={ci} className="cmp-radar"><Radar r={r} /></div>)}</div>
                <p className="dim" style={{ fontSize: 13.5, margin: '12px 0 0' }}>Price and day move follow the prices stamp above (live in market hours); every other row is from the screen{rows[0]?.last_date ? ` (the ${sessionLabel(rows[0].last_date)} close and the latest filed statements)` : ''}. A tag marks the highest or lowest in a row where higher or lower is clearly better, and only when the gap to the next company is material (5 points of a margin or return, 0.3 of debt/equity, 20% of a P/E); a smaller gap is left unmarked, because it is not a difference worth acting on. A dash means the number is not in the feed: it is left out of the comparison, never counted as zero. CAGR rows are marked only when every company&apos;s statements cover the same period; otherwise they are shown unmarked. For banks, NBFCs and insurers, ROCE, margins, debt/equity and cash conversion read &ldquo;not comparable&rdquo;: debt is their raw material. It is arithmetic, not advice: a cheaper P/E can be cheap for a reason.</p></Rv>
            </div>
            </>
          )}
        </Async>
      </section>
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="wrap section"><h1 className="sr">Compare companies side by side</h1></div>}><Compare /></Suspense>;
}
