'use client';

import { FactorStrip } from '@/components/Peek';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import SymbolPicker from '@/components/SymbolPicker';
import { Async, Bar, Chg, Rv } from '@/components/ui';
import { useSignals, useFeed, usePx } from '@/lib/data';
import { breadth200 } from '@/lib/breadth';
import { decide, screenClass } from '@/lib/decision';
import { crore, dash, num } from '@/lib/format';
import type { Row } from '@/lib/types';
import { companyHref } from '@/lib/slug';

const has = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);
const SAMPLE = 'TCS 20 3400\nHDFCBANK 30 1650\nRELIANCE 15 2400\nDIXON 3 11000';

// ── Portfolio X-ray ───────────────────────────────────────────────────
export function PortfolioXray() {
  const s = useFeed('screen');
  const [text, setText] = useState('');
  useEffect(() => { try { setText(localStorage.getItem('alpha-xray') ?? ''); } catch { /* no storage: starts empty */ } }, []);
  const save = (v: string) => { setText(v); try { localStorage.setItem('alpha-xray', v); } catch { /* not persisted */ } };
  const bySym = useMemo(() => new Map((s.data?.rows ?? []).map((r) => [r.sym.toUpperCase(), r])), [s.data]);
  const parsed = useMemo(() => {
    const ok: { sym: string; qty: number; avg: number | null; row: Row }[] = [], bad: string[] = [];
    for (const line of text.split('\n')) {
      const t = line.trim(); if (!t) continue;
      const [sym, q, a] = t.split(/[\s,\t]+/);
      const row = bySym.get((sym ?? '').toUpperCase().replace(/^NSE:/, ''));
      const qty = Number(q), avg = a === undefined || a === '' ? null : Number(a);
      if (!row || !(qty > 0) || (avg !== null && !(avg > 0))) bad.push(t); else ok.push({ sym: row.sym, qty, avg, row });
    }
    return { ok, bad };
  }, [text, bySym]);
  const lines = useMemo(() => (text === '' ? [] : text.split('\n')).map((l) => l.trim()).map((l) => { const [sym = '', q = '', a = ''] = l.split(/[\s,\t]+/); return { sym, q, a }; }), [text]);
  const rowIssue = (l: { sym: string; q: string; a: string }): string | null => {
    if (!bySym.size) return null;
    if (!l.sym) return 'enter a symbol';
    if (!bySym.has(l.sym.toUpperCase().replace(/^NSE:/, ''))) return 'symbol not in the screen';
    if (!(Number(l.q) > 0)) return 'quantity must be above 0';
    if (l.a !== '' && !(Number(l.a) > 0)) return 'average price must be above 0';
    return null;
  };
  const setCell = (i: number, k: 'sym' | 'q' | 'a', v: string) => save(lines.map((l, j) => { const n = j === i ? { ...l, [k]: v.replace(/\s/g, '') } : l; return [n.sym, n.q, n.a].filter((x, idx) => idx < 2 || x !== '').join(' '); }).join('\n'));
  const isSample = text.trim() === SAMPLE;
  const px = usePx(parsed.ok.map((h) => h.sym));
  const eng = useSignals();
  const X = useMemo(() => {
    if (!parsed.ok.length) return null;
    const hs = parsed.ok.map((h) => {
      const price = px.quotes[h.sym]?.price ?? h.row.price ?? 0;
      const val = price * h.qty;
      const sigs = (eng.data?.signals ?? []).filter((x) => x.sym === h.sym && (x.status === 'open' || x.status === 'pending'));
      return { ...h, price, val, cost: h.avg ? h.avg * h.qty : null, d: decide(h.row, sigs) };
    });
    const total = hs.reduce((a, h) => a + h.val, 0) || 1;
    const w = (f: (h: (typeof hs)[number]) => number | null | undefined) => { let n = 0, d = 0; for (const h of hs) { const v = f(h); if (has(v)) { n += v * h.val; d += h.val; } } return d ? n / d : null; };
    const sector = new Map<string, number>();
    for (const h of hs) sector.set(h.row.sector || 'Other', (sector.get(h.row.sector || 'Other') ?? 0) + h.val);
    const sorted = [...hs].sort((a, b) => b.val - a.val);
    const hhi = hs.reduce((a, h) => a + (h.val / total) ** 2, 0);
    const lowTrend = hs.filter((h) => has(h.row.price) && has(h.row.sma200) && h.row.price < h.row.sma200).reduce((a, h) => a + h.val, 0) / total * 100;
    const toLow = hs.reduce((a, h) => a + (has(h.row.low52) ? Math.max(0, h.price - h.row.low52) * h.qty : 0), 0);
    const cost = hs.every((h) => h.cost !== null) ? hs.reduce((a, h) => a + (h.cost ?? 0), 0) : null;
    const notes: string[] = [];
    if (sorted[0].val / total > 0.3) notes.push(`${sorted[0].sym} is ${(sorted[0].val / total * 100).toFixed(0)}% of the portfolio: one bad result moves the whole book.`);
    const topSector = [...sector.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topSector[1] / total > 0.4 && sector.size > 1) notes.push(`${(topSector[1] / total * 100).toFixed(0)}% sits in ${topSector[0]}: a sector-wide fall is a portfolio-wide fall.`);
    if (hs.length < 8) notes.push(`${hs.length} holdings: risk depends on weights, sector overlap and how the stocks move together, not on the count alone.`);
    if (lowTrend > 50) notes.push(`${lowTrend.toFixed(0)}% of the value is in stocks below their 200-day average: the weight of the portfolio is in downtrends.`);
    const highRisk = hs.filter((h) => h.row.risk?.level === 'HIGH');
    if (highRisk.length) notes.push(`${highRisk.map((h) => h.sym).join(', ')} carry HIGH risk flags on the screen.`);
    const thin = hs.filter((h) => has(h.row.turnover_cr) && h.row.turnover_cr < 5);
    if (thin.length) notes.push(`${thin.map((h) => h.sym).join(', ')} trade under ₹5 crore a day: exits could be slow or costly.`);
    return { hs: sorted, total, cost, sector: [...sector.entries()].sort((a, b) => b[1] - a[1]), pe: w((h) => h.row.pe && h.row.pe > 0 ? h.row.pe : null), roce: w((h) => h.row.roce), q: w((h) => h.row.q), g: w((h) => h.row.g), hhi, eff: 1 / hhi, lowTrend, toLow, notes };
  }, [parsed.ok, px.quotes, eng.data]);
  return (
    <Rv className="panel spot">
      <div className="eyebrow">Portfolio X-ray · calculated in this browser</div>
      <p className="muted" style={{ margin: '8px 0 12px' }}>Paste holdings as <code>SYMBOL quantity average-price</code>, one per line (price optional). Kept in this browser only; nothing is uploaded.</p>
      {isSample && <p className="notice" role="status"><b>Example holdings, not your portfolio.</b> The figures below describe these four sample names. Edit the rows or clear them to use your own.</p>}
      {lines.length > 0 && (
        <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)" style={{ maxHeight: 'none', marginBottom: 8 }}>
          <table className="tbl" style={{ minWidth: 480 }}>
            <thead><tr><th scope="col">Symbol</th><th scope="col">Quantity</th><th scope="col">Average price (optional)</th><th scope="col">Check</th><th scope="col"><span className="sr">Remove</span></th></tr></thead>
            <tbody>{lines.map((l, i) => { const issue = rowIssue(l); return (
              <tr key={i} style={{ cursor: 'default' }}>
                <td><input className="field" style={{ height: 34, width: 120 }} aria-label={`Symbol, row ${i + 1}`} value={l.sym} onChange={(e) => setCell(i, 'sym', e.target.value.toUpperCase())} spellCheck={false} /></td>
                <td><input className="field" style={{ height: 34, width: 100 }} inputMode="decimal" aria-label={`Quantity, row ${i + 1}`} value={l.q} onChange={(e) => setCell(i, 'q', e.target.value.replace(/[^\d.]/g, ''))} /></td>
                <td><input className="field" style={{ height: 34, width: 130 }} inputMode="decimal" aria-label={`Average price, row ${i + 1}`} value={l.a} onChange={(e) => setCell(i, 'a', e.target.value.replace(/[^\d.]/g, ''))} /></td>
                <td>{issue ? <span className="tag warn">{issue}</span> : <span className="dim">ok</span>}</td>
                <td><button className="chip" aria-label={`Remove row ${i + 1}`} onClick={() => save(lines.filter((_, j) => j !== i).map((x) => [x.sym, x.q, x.a].filter((y, idx) => idx < 2 || y !== '').join(' ')).join('\n'))}>✕</button></td>
              </tr>); })}</tbody>
          </table>
        </div>
      )}
      <details style={{ margin: '4px 0 8px' }}>
        <summary className="eyebrow" style={{ cursor: 'pointer' }}>Paste many rows (text or CSV)</summary>
        <textarea className="field" style={{ width: '100%', minHeight: 100, padding: 12, fontFamily: 'var(--f-mono)', fontSize: 14, marginTop: 8 }} value={text} onChange={(e) => save(e.target.value)} placeholder={SAMPLE} spellCheck={false} aria-label="Holdings as text" />
      </details>
      <div style={{ display: 'flex', gap: 8, margin: '8px 0', flexWrap: 'wrap' }}>
        <button className="chip" onClick={() => save(SAMPLE)}>Try an example</button>
        <button className="chip" onClick={() => save('')}>Clear</button>
        <button className="chip" onClick={() => save(text.trim() ? `${text.replace(/\n+$/, '')}\n` : ' ')} title="Add an empty row">+ Row</button>
        <SymbolPicker placeholder="Add a symbol…" onPick={(sym) => save(`${text.trim()}${text.trim() ? '\n' : ''}${sym} 10`)} />
      </div>
      <Async loading={s.loading} error={s.error} rows={1}>
        {parsed.bad.length > 0 && <p className="notice">Could not read: {parsed.bad.join(' · ')}. Each line needs a symbol from the screen and a quantity.</p>}
        {X && (
          <>
            <div className="kv" style={{ margin: '14px 0' }}>
              <div><div className="k">Value</div><div className="v">₹{num(X.total, 0)}</div></div>
              {X.cost !== null && <div><div className="k">P/L vs cost</div><div className="v"><Chg v={(X.total / X.cost - 1) * 100} dp={1} /></div></div>}
              <div><div className="k">Weighted P/E</div><div className="v">{X.pe ? `${X.pe.toFixed(1)}×` : dash}</div></div>
              <div><div className="k">Weighted ROCE</div><div className="v">{X.roce !== null ? `${X.roce.toFixed(0)}%` : dash}</div></div>
              <div><div className="k">Avg quality</div><div className="v">{X.q !== null ? Math.round(X.q) : dash}</div></div>
              <div><div className="k">Effective holdings</div><div className="v">{X.eff.toFixed(1)}</div></div>
              <div><div className="k">Loss if every name hit its 52w low</div><div className="v down">−₹{num(X.toLow, 0)}</div></div>
            </div>
            {X.notes.length > 0 && <div className="panel tight" style={{ background: 'var(--panel-2)', marginBottom: 14 }}><div className="eyebrow" style={{ marginBottom: 6 }}>What stands out</div><ul className="muted" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.6 }}>{X.notes.map((n) => <li key={n}>{n}</li>)}</ul></div>}
            <div className="grid g-7-5">
              <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)" style={{ maxHeight: 'none' }}><table className="tbl" style={{ minWidth: 520 }}>
                <thead><tr><th>Holding</th><th>Weight</th><th>Value</th><th>P/L</th><th>Desk read</th></tr></thead>
                <tbody>{X.hs.map((h) => (
                  <tr key={h.sym}><td><Link href={companyHref(h.sym)}><b>{h.sym}</b></Link></td><td className="num">{(h.val / X.total * 100).toFixed(1)}%</td><td className="num">₹{num(h.val, 0)}</td><td>{h.avg ? <Chg v={(h.price / h.avg - 1) * 100} dp={1} /> : dash}</td><td className="dim" style={{ fontSize: 13.5, whiteSpace: 'normal' }}>{h.d.headline}</td></tr>
                ))}</tbody>
              </table></div>
              <div><div className="eyebrow" style={{ marginBottom: 10 }}>By sector</div><div className="meter">{X.sector.map(([n, v]) => <div className="meter-row" key={n}><span className="lab" style={{ minWidth: 130 }}>{n}</span><Bar pct={v / X.total * 100} kind="up" /><span className="num">{(v / X.total * 100).toFixed(0)}%</span></div>)}</div></div>
            </div>
          </>
        )}
      </Async>
    </Rv>
  );
}

// ── Reverse DCF ───────────────────────────────────────────────────────
function impliedGrowth(price: number, eps: number, r: number, years: number, tg: number): number | null {
  const pv = (g: number) => { let s = 0, e = eps; for (let t = 1; t <= years; t++) { e *= 1 + g; s += e / (1 + r) ** t; } return s + (e * (1 + tg) / (r - tg)) / (1 + r) ** years; };
  let lo = -0.3, hi = 0.8;
  if (pv(lo) > price || pv(hi) < price) return null;
  for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (pv(m) < price) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
export function ReverseDcf() {
  const s = useFeed('screen');
  const [sym, setSym] = useState('TCS');
  const [rate, setRate] = useState('12');
  const [yrs, setYrs] = useState('10');
  const [tg, setTg] = useState('5');
  const r = s.data?.rows.find((x) => x.sym === sym);
  const eps = r && has(r.pe) && r.pe > 0 && has(r.price) ? r.price / r.pe : null;
  const g = r && eps && r.price ? impliedGrowth(r.price, eps, Number(rate) / 100, Math.max(1, Math.min(30, Number(yrs) || 10)), Number(tg) / 100) : null;
  const rateN = Number(rate), yrsN = Number(yrs), tgN = Number(tg);
  const valid = rateN > tgN && rateN > 0 && rateN <= 50 && yrsN >= 1 && yrsN <= 30 && tgN >= 0 && tgN <= 10;
  return (
    <Rv className="panel spot">
      <div className="eyebrow">Reverse DCF · an earnings-based teaching model</div>
      <p className="muted" style={{ margin: '8px 0 12px' }}>Instead of guessing the future and getting a value, start from today&apos;s price and solve for the earnings growth it needs.</p>
      <div className="filters"><SymbolPicker placeholder={`Company (now ${sym})`} onPick={setSym} />
        {([['Required return %', rate, setRate], ['Years of growth', yrs, setYrs], ['Terminal growth %', tg, setTg]] as const).map(([l, v, f]) => <label key={l} className="muted" style={{ fontSize: 14 }}>{l} <input className="field" style={{ width: 80, height: 36 }} inputMode="decimal" value={v} onChange={(e) => f(e.target.value.replace(/[^\d.]/g, ''))} /></label>)}</div>
      {!r ? <p className="dim">Pick a company.</p> : !valid ? <p className="notice">Needs a required return above 0 and up to 50%, terminal growth from 0 to 10% and below the required return, and between 1 and 30 years of growth.</p> : eps === null ? <p className="notice">{r.sym} has no positive P/E, so there are no earnings to discount.</p> : (
        <>
        <div className="grid g3" style={{ marginTop: 12 }}>
          <div className="panel tight"><div className="eyebrow">{r.sym} at ₹{num(r.price, 2)} (screen close)</div><p className="num" style={{ margin: '8px 0 0' }}>EPS ≈ ₹{eps.toFixed(2)} · P/E {r.pe?.toFixed(1)}×</p></div>
          <div className="panel tight"><div className="eyebrow">Growth the price needs</div><div className="disp" style={{ fontSize: 34, margin: '6px 0 0', color: 'var(--accent-2)' }}>{g === null ? 'outside −30% to 80%' : `${(g * 100).toFixed(1)}% a year`}</div><div className="dim" style={{ fontSize: 13 }}>for {yrs} years, then {tg}% forever</div></div>
          <div className="panel tight"><div className="eyebrow">What it actually did</div><p className="num" style={{ margin: '8px 0 0' }}>EPS CAGR {has(r.eps_cagr) ? `${r.eps_cagr.toFixed(1)}%` : dash}<br />Revenue CAGR {has(r.rev_cagr) ? `${r.rev_cagr.toFixed(1)}%` : dash}</p>
            {g !== null && has(r.eps_cagr) && <p className={r.eps_cagr * 1 >= g * 100 ? 'up' : 'down'} style={{ fontSize: 13.5, margin: '8px 0 0' }}>{r.eps_cagr >= g * 100 ? 'Historical EPS growth exceeds this scenario’s implied rate. Future growth may differ.' : `This scenario implies ${(g * 100 - r.eps_cagr).toFixed(1)} points more growth than EPS has delivered historically.`}</p>}</div>
        </div>
        {eps !== null && r.price && (
          <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways on small screens)" style={{ maxHeight: 'none', marginTop: 14 }}>
            <table className="tbl" style={{ minWidth: 420 }}>
              <caption className="dim" style={{ textAlign: 'left', fontSize: 13.5, padding: '0 0 6px' }}>Growth the price needs (% a year for {yrsN} years), by required return and terminal growth. A dash means outside −30% to 80%.</caption>
              <thead><tr><th scope="col">Required return ↓ · terminal growth →</th>{[3, 5, 7].map((t) => <th key={t} scope="col" className="num">{t}%</th>)}</tr></thead>
              <tbody>{[10, 12, 14, 16].map((rr) => (
                <tr key={rr} style={{ cursor: 'default', background: rr === rateN ? 'var(--panel-2)' : undefined }}><th scope="row">{rr}%</th>{[3, 5, 7].map((t) => { const x = rr > t ? impliedGrowth(r.price as number, eps, rr / 100, Math.max(1, Math.min(30, yrsN || 10)), t / 100) : null; return <td key={t} className="num">{x === null ? dash : `${(x * 100).toFixed(1)}%`}</td>; })}</tr>
              ))}</tbody>
            </table>
          </div>
        )}
        </>
      )}
    </Rv>
  );
}

// ── Confluence board ──────────────────────────────────────────────────
export function Confluence({ limit = 8 }: { limit?: number }) {
  const s = useFeed('screen');
  const eng = useSignals();
  const MIN_CHECKS = 6;                      // a name needs at least six of the nine checks to apply before it can be ranked at all
  const { rows, skipped } = useMemo(() => {
    if (!s.data) return { rows: [], skipped: 0 };
    const sigs = (eng.data?.signals ?? []).filter((x) => x.status === 'open' || x.status === 'pending');
    const full = !!eng.data?.alertable;      // full weight only once the rule book's holdout clears the alert bar
    let skipped = 0;
    const out = s.data.rows.filter((r) => has(r.turnover_cr) && r.turnover_cr >= 5).map((r) => {
      const mine = sigs.filter((x) => x.sym === r.sym);
      const d = decide(r, mine);
      const passed = d.checks.filter((c) => c.pass === true).length, known = d.checks.filter((c) => c.pass !== null).length;
      const engines = mine.length * (full ? 1 : 0.5);
      const score = (known ? passed / known : 0) * 6 + engines * 2 + (r.mf?.rank && r.mf.rank <= 100 ? 1 : 0) + (r.vd?.c === 'BUY' ? 1 : 0) - (r.risk?.level === 'HIGH' ? 3 : 0);
      return { r, mine, d, passed, known, total: d.checks.length, score };
    }).filter((x) => { if (x.known < MIN_CHECKS) { skipped++; return false; } return true; });
    return { rows: out.sort((a, b) => b.score - a.score).slice(0, limit), skipped };
  }, [s.data, eng.data, limit]);
  return (
    <Async loading={s.loading} error={s.error} rows={3}>
      <ul className="picks">
        {rows.map(({ r, mine, d, passed, known, total }) => {
          const sc = screenClass(r.vd);
          return (
            <li key={r.sym}>
              <Link className="pick" href={companyHref(r.sym)}>
                <span className="pick-id"><b>{r.sym}</b><span>{r.name}</span></span>
                <span className="pick-score" title={`${passed} passed of ${known} that apply; ${total - known} of ${total} not applicable or unavailable`}>
                  <b className="num">{passed} of {known}</b><span>checks passed{known < total ? ` · ${total - known} n/a` : ''}</span>
                </span>
                <span className="pick-chg"><Chg v={r.r1y} dp={0} /><span>1 year</span></span>
                <span className="pick-tags">
                  <span className={`tag ${sc.tone}`} title={sc.title}>{sc.text}</span>
                  {mine.map((m) => <span key={m.id} className="tag acc">Swing {m.setup.toLowerCase()} signal</span>)}
                </span>
                <span className="pick-fac"><FactorStrip row={r} /></span>
                <span className="pick-why">{d.bull[0]?.text ?? d.headline}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {skipped > 0 && <p className="dim" style={{ fontSize: 13, margin: '8px 0 0' }}>{num(skipped)} liquid names left out for having fewer than {MIN_CHECKS} applicable checks. <Link href="/about/#confluence" style={{ textDecoration: 'underline' }}>How it is ranked</Link>.</p>}
    </Async>
  );
}

// ── Market stance ─────────────────────────────────────────────────────
export function MarketStance() {
  const s = useFeed('screen');
  const b = useFeed('barometer');
  const bd = s.data?.breadth, t = b.data?.today;
  const b2 = useMemo(() => (s.data ? breadth200(s.data.rows) : null), [s.data]);
  return (
    <Async loading={s.loading || b.loading} error={s.error} rows={1}>
      {bd && (
        <Rv className="panel spot">
          <div className="eyebrow">Market stance · calculated from the barometer</div>
          {(() => {
            const conds: [string, boolean, string][] = [
              ['More than half of stocks above their 200-day', (b2?.pct ?? 0) > 50, b2 && b2.pct !== null ? `${b2.above} of ${b2.withHistory} with a 200-day history (${b2.pct.toFixed(0)}%)` : 'not available'],
              ['More than half above their 50-day', bd.above50 > 50, `${bd.above50.toFixed(0)}% are`],
              ['More stocks up than down over the past week', bd.advancing > bd.declining, `${bd.advancing} up, ${bd.declining} down over 5 sessions`],
              ['Typical stock is up over the month', bd.median_1m > 0, `median ${bd.median_1m.toFixed(1)}%`],
              ['New 52-week highs are broad (over 3% of names)', bd.at_52w_high / bd.counted > 0.03, `${bd.at_52w_high} of ${bd.counted}`],
              ['Nifty positive over the year', bd.nifty_1y > 0, `${bd.nifty_1y.toFixed(1)}%`],
            ];
            const n = conds.filter((c) => c[1]).length;
            const stance = n >= 5 ? 'Broad strength' : n >= 3 ? 'Mixed' : n >= 1 ? 'Weak' : 'Broad weakness';
            const advice = n >= 5 ? 'Most stocks are above their averages. In past data, breakouts have tended to follow such conditions; that is not a forecast.' : n >= 3 ? 'The market is split: about half the tests pass, so stock-level differences are larger than the market-wide direction.' : 'Most stocks are in downtrends. Historically such conditions have carried higher risk for new long positions; this describes the market, not what to do.';
            return (
              <>
                <p className="disp" style={{ fontSize: 30, margin: '10px 0 4px' }}>{stance}: {n} of {conds.length} conditions hold{t ? `, barometer ${Math.round(t.score)} (${t.band.t.toLowerCase()})` : ''}.</p>
                <p className="muted" style={{ margin: '0 0 14px' }}>{advice}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 8 }}>
                  {conds.map(([l, ok, d]) => (
                    <div key={l} style={{ display: 'flex', gap: 10, fontSize: 14.5 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 10, flex: 'none', display: 'grid', placeItems: 'center', fontSize: 13, background: ok ? 'var(--up-soft)' : 'var(--down-soft)', color: ok ? 'var(--up)' : 'var(--down)' }}>{ok ? '✓' : '✕'}</span>
                      <span>{l}<small className="dim" style={{ display: 'block', fontFamily: 'var(--f-mono)', fontSize: 12 }}>{d}</small></span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
          <p className="dim" style={{ fontSize: 13, margin: '14px 0 0' }}>Six breadth tests on the screen&apos;s {num(bd.counted)} stocks, as of {bd.as_of}. Breadth describes the market&apos;s state; it does not time it.</p>
        </Rv>
      )}
    </Async>
  );
}
