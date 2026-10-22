'use client';
/** Compare (brief Part I §4): a short read of what differs and what cannot be compared, then one table with company headings
 *  that stay in view, switched between Overview, Quality, Valuation, Financials and the full table. No winner: a figure is
 *  marked only where "better" is defined and the gap is material (lib/compare.ts). Companies are replaced in place, the
 *  selection lives in the address, and the comparison can be saved to My Desk as a research card. */
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { Overflow } from '@/components/company/Parts';
import { DataStamp, useDatasetStatus } from '@/components/DataStamp';
import { AskAI } from '@/components/Explain';
import SymbolPicker from '@/components/SymbolPicker';
import { Chg, Flash, PageHead } from '@/components/ui';
import { buildCard } from '@/lib/card';
import { LENDER_CARE, SPECS, VIEWS, lenderCaveat, mark, summarise, type View } from '@/lib/compare';
import { useFeedWhen, useLive, useShard } from '@/lib/data';
import { dash, dateLabel, num } from '@/lib/format';
import { useCards } from '@/lib/library';
import { priceLabel, priceView, sessionLabel } from '@/lib/price';
import { isLender } from '@/lib/sector';
import { companyHref } from '@/lib/slug';
import type { Row } from '@/lib/types';

const has = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** One small score profile per company, titled with its name (small multiples). Identity comes from the label, not a colour.
 *  Same scale (0 to 100) and the same axes in every panel, so shapes compare directly. */
const AXES: [string, (r: Row) => number | null | undefined][] = [['Quality', (r) => r.q], ['Growth', (r) => r.g], ['Value', (r) => r.v], ['Technical', (r) => r.tech], ['Composite', (r) => r.comp]];
function Radar({ r }: { r: Row }) {
  const C = 80, R = 52;
  const pt = (i: number, v: number) => { const a = (-Math.PI / 2) + (i / AXES.length) * Math.PI * 2; return [C + Math.cos(a) * R * (v / 100), C + Math.sin(a) * R * (v / 100)] as const; };
  const label = AXES.map(([l, g]) => `${l} ${has(g(r)) ? Math.round(g(r) as number) : 'not scored'}`).join(', ');
  return (
    <figure className="cmpx-radar">
      <figcaption><Link href={companyHref(r.sym)}>{r.sym}</Link></figcaption>
      <svg viewBox="-24 0 208 160" role="img" aria-label={`${r.sym} scores: ${label}`}>
        {[50, 100].map((g) => <polygon key={g} points={AXES.map((_, i) => pt(i, g).join(',')).join(' ')} fill="none" stroke="var(--line-2)" />)}
        {AXES.map(([l], i) => { const [x, y] = pt(i, 128); return <text key={l} x={x} y={y + 3} textAnchor="middle" fontSize="9" fill="var(--dim)" fontFamily="var(--f-ui)">{l}</text>; })}
        <polygon points={AXES.map(([, g], i) => pt(i, Math.max(2, Math.min(100, g(r) ?? 0))).join(',')).join(' ')} fill="var(--text)" fillOpacity=".08" stroke="var(--text)" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </figure>
  );
}

const EXAMPLES: [string, string][] = [['IT services', 'TCS,INFY,HCLTECH,WIPRO'], ['Private banks', 'HDFCBANK,ICICIBANK,KOTAKBANK,AXISBANK'], ['FMCG', 'HINDUNILVR,NESTLEIND,BRITANNIA,DABUR']];
const VIEW_IDS = new Set(VIEWS.map(([k]) => k));

function Compare() {
  const sp = useSearchParams();
  const router = useRouter();
  const syms = (sp.get('s') ?? '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, 4);
  const vRaw = sp.get('v') ?? 'overview';
  const view = (VIEW_IDS.has(vRaw as View) ? vRaw : 'overview') as View | 'full';
  const sh = [useShard(syms[0] ?? ''), useShard(syms[1] ?? ''), useShard(syms[2] ?? ''), useShard(syms[3] ?? '')];
  // Each company's row comes from its own 6 KB file; the 490 KB screen is fetched only if one of those is missing.
  const needFull = syms.some((x, i) => !!x && !!sh[i].error);
  const s = useFeedWhen('screen', needFull);
  const shardRows = sh.map((x) => x.data?.row ?? null);
  const rows = useMemo(() => syms.map((x, i) => shardRows[i] ?? s.data?.rows.find((r) => r.sym.toUpperCase() === x)).filter((r): r is Row => !!r), [s.data, syms.join(','), ...shardRows]); // eslint-disable-line react-hooks/exhaustive-deps
  const yearsOf = (sym: string) => { const i = syms.indexOf(sym); const y = i >= 0 ? sh[i].data?.years : null; return y ? y.length : null; };
  // the periods a CAGR spans: first and last statement date, not just how many years
  const spanOf = (sym: string) => { const i = syms.indexOf(sym); const y = i >= 0 ? sh[i].data?.years : null; return y && y.length ? `${y[0].end}|${y[y.length - 1].end}` : null; };
  const spans = rows.map((r) => spanOf(r.sym));
  const loading = syms.some((x, i) => !!x && sh[i].loading) || (needFull && s.loading);
  const missingSyms = !loading ? syms.filter((x) => !rows.some((r) => r.sym.toUpperCase() === x)) : [];
  const lv = useLive();
  const { add, ok: canSave } = useCards();
  const { items } = useDatasetStatus();
  const [replacing, setReplacing] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  // linked views: pointing at or focusing any part of one company highlights all of it
  const [focusCol, setFocusCol] = useState<number | null>(null);
  const linkOn = (e: React.SyntheticEvent) => { const c = (e.target as HTMLElement).closest<HTMLElement>('[data-col]')?.dataset.col; setFocusCol(c === undefined ? null : Number(c)); };

  const go = (next: string[], v: string = view) => {
    const p = new URLSearchParams();
    if (next.length) p.set('s', next.join(','));
    if (v !== 'overview') p.set('v', v);
    const qs = p.toString().replace(/%2C/g, ',');
    setMsg('');
    router.replace(qs ? `/compare/?${qs}` : '/compare/', { scroll: false });
  };
  const replaceAt = (i: number, sym: string) => { const next = [...syms]; next[i] = sym; setReplacing(null); go(next); };
  const summary = useMemo(() => summarise(rows, spans), [rows, spans.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const cautions = rows.map((r) => ({ sym: r.sym, text: lenderCaveat(r) })).filter((x) => x.text);
  const specs = SPECS.filter((x) => view === 'full' || x.views.includes(view as View));

  const save = () => {
    const card = buildCard({
      question: `How do ${rows.map((r) => r.sym).join(', ').replace(/, ([^,]*)$/, ' and $1')} compare?`,
      companies: rows.map((r) => { const pv = priceView(r.sym, r, lv.snap); return { sym: r.sym, name: r.name, price: has(pv.price) ? pv.price : null, priceAsOf: r.last_date ?? null }; }),
      comparison: SPECS.map((x) => { const m = mark(x, rows, spans); return { metric: x.label, values: Object.fromEntries(rows.map((r, i) => [r.sym, m.na[i] ? null : m.vals[i]])) }; }),
      nextResults: Object.fromEntries(rows.map((r) => [r.sym, r.next_earnings ?? null])),
      dataStatus: items.map((i) => ({ id: i.id, asOf: i.asOf, refreshedAt: i.refreshedAt, state: i.state })),
      note: [...summary, ...cautions.map((c) => `${c.sym}: ${c.text}`)].join(' '),
    });
    setMsg(add(card) ? 'Saved to My Desk in this browser, with every figure, the summary and the data dates. A figure that is not comparable is saved as empty.' : 'Could not save: browser storage is blocked or full.');
  };
  const copy = () => { try { void navigator.clipboard.writeText(window.location.href).then(() => setMsg('Link copied. It opens this same selection and view.'), () => setMsg('Could not copy; the address bar holds the same link.')); } catch { setMsg('Could not copy; the address bar holds the same link.'); } };

  return (
    <>
      <PageHead method="compare" eyebrow="Compare" title="Side by side," em="up to four." />
      <section className="wrap wide cmpx">
        <div className="cmpx-top">
          <ol className="cmpx-slots" aria-label={`Companies chosen: ${syms.length} of 4`}>
            {[0, 1, 2, 3].map((i) => {
              const x = syms[i];
              const r = rows.find((y) => y.sym === x);
              if (x && replacing !== i) return (
                <li key={x} className="cmpx-slot on">
                  <span className="cmpx-i" aria-hidden>{i + 1}</span>
                  <span className="cmpx-id"><Link href={companyHref(x)}><b>{x}</b></Link><span className="cmpx-nm">{r?.name ?? (loading ? 'Loading…' : 'Not in the screen')}</span></span>
                  <span className="cmpx-sa">
                    <button type="button" className="act quiet" onClick={() => setReplacing(i)} aria-label={`Replace ${x}`}>Replace</button>
                    <button type="button" className="act quiet cmpx-x" onClick={() => go(syms.filter((y) => y !== x))} aria-label={`Remove ${x}`}><span aria-hidden>✕</span></button>
                  </span>
                </li>
              );
              const first = !x && i === syms.length;
              return (
                <li key={x ? `r${i}` : `e${i}`} className={`cmpx-slot${x ? ' on' : ''}${first || x ? ' pick' : ''}`}>
                  <span className="cmpx-i" aria-hidden>{i + 1}</span>
                  {x ? (
                    <span className="cmpx-rep"><SymbolPicker onPick={(n) => replaceAt(i, n)} placeholder={`Replace ${x} with…`} exclude={syms} /><button type="button" className="act quiet" onClick={() => setReplacing(null)}>Cancel</button></span>
                  ) : first ? <SymbolPicker onPick={(n) => go([...syms, n])} placeholder={i < 2 ? 'Add a company…' : 'Add another (optional)…'} exclude={syms} /> : <span className="dim">{i < 2 ? 'Add a company' : 'Optional'}</span>}
                </li>
              );
            })}
          </ol>
          {rows.length >= 2 && (
            <div className="cmpx-acts">
              <DataStamp ids={['prices', 'screen']} />
              <span className="cmpx-acts-r">
                <button type="button" className="act primary" onClick={save} disabled={!canSave}>Save to My Desk</button>
                <Overflow label="More compare actions">
                  <button type="button" onClick={copy}>Copy link to this comparison</button>
                  <button type="button" onClick={() => go([])}>Clear all</button>
                </Overflow>
              </span>
            </div>
          )}
          {msg && <p className="cmpx-msg" role="status">{msg}</p>}
          {missingSyms.length > 0 && <div className="state"><b>{missingSyms.join(', ')} {missingSyms.length === 1 ? 'is' : 'are'} not in the screen.</b><p>The symbol may be mistyped or not covered. It is left out; nothing is shown in its place.</p><div className="acts"><button type="button" className="act" onClick={() => go(syms.filter((x) => !missingSyms.includes(x)))}>Remove {missingSyms.join(', ')}</button></div></div>}
        </div>

        {loading ? (
          <div className="state" role="status" aria-busy="true"><b>Loading {syms.join(', ')}…</b><p>Each company&apos;s figures come from its own small file.</p></div>
        ) : needFull && s.error ? (
          <div className="state" role="alert"><b>The figures could not be loaded.</b><p>{s.error}. They are read live, so trying again usually fixes it.</p><div className="acts"><button type="button" className="act primary" onClick={() => window.location.reload()}>Try again</button></div></div>
        ) : rows.length < 2 ? (
          <div className="cmp-start">
            <ol className="cmp-steps" aria-label="How it works">
              <li className={syms.length >= 2 ? 'done' : 'now'}><b>Pick two to four</b><span>{syms.length === 1 ? `${syms[0]} is in. Add one more to start the table.` : 'Type a symbol or a name above, or open a set below.'}</span></li>
              <li><b>Read what differs</b><span>A short summary first: material differences, and what cannot be compared.</span></li>
              <li><b>Check the table</b><span>Every measure side by side, marked only where a difference is defined and material. No winner is picked.</span></li>
            </ol>
            <div className="eyebrow" style={{ margin: '20px 0 10px' }}>Ready-made sets</div>
            <div className="cmp-sets">
              {EXAMPLES.map(([l, q]) => (
                <button key={l} type="button" className="cmp-set" onClick={() => go(q.split(','))}>
                  <b>{l}</b>
                  <span className="cmp-tk">{q.split(',').map((t) => <span key={t} className="tag">{t}</span>)}</span>
                  <span className="cmp-go">Compare these four <span aria-hidden>→</span></span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <section className="card cmpx-sum" aria-labelledby="cmpx-sum-h">
              <div className="card-h"><h2 id="cmpx-sum-h">What differs</h2><span className="dim cmpx-asof">{rows[0]?.last_date ? `${sessionLabel(rows[0].last_date)} close · latest filed statements` : 'latest filed statements'}</span></div>
              <ul className="cmpx-pts">{summary.map((x) => <li key={x}>{x}</li>)}</ul>
              {cautions.length > 0 && <p className="cmpx-care-note"><span className="pill warn">Read with care</span> {cautions.length === rows.length ? 'For these lenders' : `For ${cautions.map((c) => c.sym).join(', ')}`}: {cautions[0].text}</p>}
              <p className="card-foot">Built from the figures below, by fixed rules. It names differences; it does not pick a winner. A cheaper P/E can be cheap for a reason.</p>
            </section>

            <div className="secnav cmpx-tabs" role="tablist" aria-label="Measures to show" onKeyDown={(e) => {
              const keys = VIEWS.map(([k]) => k); const at = keys.indexOf(view);
              const n = e.key === 'ArrowRight' ? (at + 1) % keys.length : e.key === 'ArrowLeft' ? (at - 1 + keys.length) % keys.length : -1;
              if (n < 0) return; e.preventDefault(); go(syms, keys[n]); (e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[n])?.focus();
            }}>
              {VIEWS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} tabIndex={view === k ? 0 : -1} aria-controls="cmpx-table" onClick={() => go(syms, k)}>{l}</button>)}
            </div>

            {focusCol !== null && <style>{`.cmp-linked [data-col="${focusCol}"] { background: var(--accent-soft); }`}</style>}
            <div id="cmpx-table" role="tabpanel" aria-label={VIEWS.find(([k]) => k === view)?.[1]} className="cmp-linked" onPointerOver={linkOn} onFocus={linkOn} onPointerLeave={() => setFocusCol(null)} onBlur={() => setFocusCol(null)}>
              <div className="tbl-wrap cmpx-wrap" tabIndex={0} role="region" aria-label="Comparison table (scrolls inside this box on small screens)">
                <table className={`tbl cmpx-tbl n${rows.length}`}>
                  <thead>
                    <tr>
                      <th scope="col">Measure</th>
                      {rows.map((r, ci) => { const pv = priceView(r.sym, r, lv.snap); return (
                        <th key={r.sym} scope="col" data-col={ci}>
                          <Link href={companyHref(r.sym)}>{r.sym}</Link>
                          <span className="cmpx-hn">{r.name}</span>
                          <span className="cmpx-hp"><span className="num">{has(pv.price) ? `₹${num(pv.price, 2)}` : dash}</span> <Chg v={pv.pct} dp={1} /></span>
                          {isLender(r) && <span className="pill nodot cmpx-lender" title="A bank, NBFC or insurer: the screen's lender rule applies">Lender</span>}
                        </th>
                      ); })}
                    </tr>
                  </thead>
                  <tbody>
                    {(view === 'overview' || view === 'full') && (
                      <tr><th scope="row">Price<span className="cmpx-b">live in market hours, else the last close</span></th>{rows.map((r, ci) => { const pv = priceView(r.sym, r, lv.snap); return <td key={r.sym} data-col={ci}><Flash value={pv.price}><span className="num">{has(pv.price) ? `₹${num(pv.price, 2)}` : dash}</span></Flash><span className="cmpx-sub">{priceLabel(pv).text}</span></td>; })}</tr>
                    )}
                    {(view === 'overview' || view === 'full') && (
                      <tr><th scope="row">Day move</th>{rows.map((r, ci) => { const pv = priceView(r.sym, r, lv.snap); return <td key={r.sym} data-col={ci}><Flash value={pv.pct} dir={null}><Chg v={pv.pct} dp={1} /></Flash></td>; })}</tr>
                    )}
                    {(view === 'financials' || view === 'full') && (
                      <tr><th scope="row">Statement years on file</th>{rows.map((r, ci) => <td key={r.sym} data-col={ci}><span className="num">{yearsOf(r.sym) ?? dash}</span><span className="cmpx-sub">{spanOf(r.sym)?.split('|').reverse().map((d) => dateLabel(d.slice(0, 10))).join(' back to ') ?? ''}</span></td>)}</tr>
                    )}
                    {specs.map((x) => {
                      const m = mark(x, rows, spans);
                      return (
                        <tr key={x.label}>
                          <th scope="row">{x.label}<span className="cmpx-b">{x.basis}</span></th>
                          {m.vals.map((v, i) => {
                            const best = m.best !== null && v === m.best && !m.na[i];
                            const care = LENDER_CARE.has(x.label) && isLender(rows[i]);
                            return (
                              <td key={i} data-col={i} className={best ? 'best' : undefined}>
                                {m.na[i] ? <span className="dim cmpx-na" title="The screen reads this measure differently for a bank, NBFC or insurer: debt is the raw material">not comparable</span>
                                  : v !== null ? <span className="num">{x.fmt(v, rows[i])}</span>
                                  : <span className="dim" title="Not in the feed for this company"><span aria-hidden>{dash}</span><span className="sr">not available</span></span>}
                                {best && <span className="tag acc cmpx-tag">{x.better === 'high' ? 'highest' : 'lowest'}</span>}
                                {care && v !== null && <span className="cmpx-sub warn" title={lenderCaveat(rows[i]) ?? undefined}>read with care</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="cmpx-method">Price and day move follow the prices stamp above (live in market hours); every other row is from the screen{rows[0]?.last_date ? ` (the ${sessionLabel(rows[0].last_date)} close and the latest filed statements)` : ''}. A tag marks the highest or lowest only where higher or lower is clearly better and the gap to the next company is material (5 points of a margin or return, 0.3 of debt/equity, 20% of a P/E); past returns, size and the distance from the high are never marked. CAGR rows are marked only when every company&apos;s statements cover the same period, Piotroski only when the same number of tests could be computed. For banks, NBFCs and insurers, ROCE, margins, debt/equity, cash conversion and interest cover read &ldquo;not comparable&rdquo;, and their Quality and Piotroski are never marked, because they rest on inputs that do not apply to lenders. A dash means the number is not in the feed: it is left out, never counted as zero.</p>

            {(view === 'overview' || view === 'full') && (
              <section className="card cmpx-shapes" aria-labelledby="cmpx-shp-h">
                <div className="card-h"><h2 id="cmpx-shp-h">Score profiles</h2><span className="dim cmpx-asof">scores, 0 to 100, screen build</span></div>
                <div className={`cmpx-radars n${rows.length}`}>{rows.map((r, ci) => <div key={r.sym} data-col={ci}><Radar r={r} /></div>)}</div>
              </section>
            )}
            <div className="cmpx-ask"><AskAI subject="compare" syms={rows.map((r) => r.sym)} title="Ask how these compare" compact /></div>
          </>
        )}
      </section>
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="wrap section"><h1 className="sr">Compare companies side by side</h1></div>}><Compare /></Suspense>;
}
