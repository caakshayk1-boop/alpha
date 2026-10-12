'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Async, PageHead, Rv } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { num, pct } from '@/lib/format';
import type { Row } from '@/lib/types';

const q = (xs: number[], f: number) => { const a = [...xs].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.max(0, Math.round(f * (a.length - 1))))]; };

/** Return on capital against earnings yield for every ranked company: the two things the formula adds. Axes run from the 2nd to the 98th percentile so a few extreme values do not flatten the rest; points beyond sit on the edge. */
function Scatter({ rows, sel, onSel }: { rows: Row[]; sel: Row | null; onSel: (r: Row) => void }) {
  const pts = rows.filter((r) => typeof r.mf?.roc === 'number' && typeof r.mf?.ey === 'number');
  if (pts.length < 10) return null;
  const xs = pts.map((r) => r.mf!.ey as number), ys = pts.map((r) => r.mf!.roc as number);
  const x0 = q(xs, 0.02), x1 = q(xs, 0.98), y0 = q(ys, 0.02), y1 = q(ys, 0.98);
  const W = 640, H = 340, L = 44, B = 30, T = 8, R = 10;
  const px = (v: number) => L + ((Math.min(x1, Math.max(x0, v)) - x0) / (x1 - x0 || 1)) * (W - L - R);
  const py = (v: number) => H - B - ((Math.min(y1, Math.max(y0, v)) - y0) / (y1 - y0 || 1)) * (H - B - T);
  const top = (r: Row) => (r.mf!.rank as number) <= 50;
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="eyebrow">The trade-off the ranking adds up · {num(pts.length)} ranked companies</div>
      <div className="grid g-7-5" style={{ alignItems: 'start', marginTop: 8 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label={`Scatter of return on capital against earnings yield for ${pts.length} ranked companies. The same data is in the table below.`}>
          <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke="var(--line-2)" /><line x1={L} y1={T} x2={L} y2={H - B} stroke="var(--line-2)" />
          <text x={W - R} y={H - 8} textAnchor="end" fontSize="11" fill="var(--dim)">Earnings yield % → ({x0.toFixed(0)} to {x1.toFixed(0)})</text>
          <text x={L + 6} y={T + 10} fontSize="11" fill="var(--dim)">↑ Return on capital % ({y0.toFixed(0)} to {y1.toFixed(0)})</text>
          {pts.filter((r) => !top(r)).map((r) => <circle key={r.sym} cx={px(r.mf!.ey as number)} cy={py(r.mf!.roc as number)} r={2.6} fill="var(--dim)" opacity={0.45} onClick={() => onSel(r)} style={{ cursor: 'pointer' }} />)}
          {pts.filter(top).map((r) => <circle key={r.sym} cx={px(r.mf!.ey as number)} cy={py(r.mf!.roc as number)} r={4} fill="var(--accent)" stroke="var(--bg)" tabIndex={0} aria-label={`${r.sym}, rank ${r.mf!.rank}`} onClick={() => onSel(r)} onFocus={() => onSel(r)} style={{ cursor: 'pointer' }} />)}
          {sel && typeof sel.mf?.roc === 'number' && typeof sel.mf?.ey === 'number' && <circle cx={px(sel.mf.ey)} cy={py(sel.mf.roc)} r={7} fill="none" stroke="var(--text)" strokeWidth={2} />}
        </svg>
        <div>
          {sel ? (
            <>
              <div className="disp" style={{ fontSize: 26 }}><Link href={`/company/?s=${encodeURIComponent(sel.sym)}`}>{sel.sym}</Link></div>
              <div className="dim" style={{ fontSize: 14 }}>{sel.name}</div>
              <p className="muted" style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.6 }}>Rank <b>{sel.mf?.rank}</b> of {sel.mf?.of ?? pts.length}: return on capital ranks {sel.mf?.roc_rank}, earnings yield ranks {sel.mf?.ey_rank}, and the two add to {sel.mf?.score ?? '—'}. A low total needs both to be good, not either one.</p>
              <p className="dim" style={{ margin: '8px 0 0', fontSize: 13.5 }}>Limit that may apply: enterprise value here has no minority-interest adjustment, and the feed does not flag which companies have one. Where a company has material minority interests, its earnings yield can read too high.</p>
            </>
          ) : <p className="muted" style={{ margin: 0 }}>Select a point to see why it ranks where it does. Highlighted points are the top 50; grey points are the rest. The table below holds the same numbers.</p>}
        </div>
      </div>
    </div>
  );
}

export default function Magic() {
  const s = useFeed('screen');
  const [limit, setLimit] = useState(50);
  const ranked = useMemo(() => (s.data?.rows ?? []).filter((r) => typeof r.mf?.rank === 'number').sort((a, b) => (a.mf!.rank as number) - (b.mf!.rank as number)), [s.data]);
  const mf = s.data?.magic_formula;
  const [sel, setSel] = useState<Row | null>(null);
  return (
    <>
      <PageHead eyebrow="Magic Formula" title="A Greenblatt-inspired ranking" em="of eligible companies." lede="Eligible companies are ranked on return on capital and on earnings yield, the two ranks are added, and the lowest total comes first. Lenders, insurers, utilities and several other groups are excluded, so not every company is ranked. Shown with the rules, the exclusions and where this implementation differs from the book." />
      <section className="wrap">
        <Async loading={s.loading} error={s.error}>
          {mf && (
            <Rv className="panel" >
              <div className="grid g3">
                <div><div className="eyebrow">Ranked</div><div className="disp" style={{ fontSize: 56 }}>{num(mf.ranked)}</div><div className="dim">eligible companies, out of {num(mf.universe)} screened ({num(mf.universe - mf.ranked)} excluded or unrankable, listed below). Every figure on Alpha that says &ldquo;rank of N&rdquo; uses this same {num(mf.ranked)}.</div></div>
                <div><div className="eyebrow">How it works</div><p className="muted" style={{ margin: '12px 0 0' }}>{mf.rules.roc}. {mf.rules.ey}. {mf.rules.combine}.</p></div>
                <div><div className="eyebrow">Source</div><p className="muted" style={{ margin: '12px 0 0' }}>{mf.rules.source}</p></div>
              </div>
            </Rv>
          )}
          {mf && <p className="notice" style={{ marginTop: 14 }}><b>Read this before the table:</b> {mf.rules.deviation}</p>}
          <div style={{ height: 24 }} />
          <Scatter rows={ranked} sel={sel} onSel={setSel} />
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Company</th><th>Rank</th><th>ROCE</th><th>ROC rank</th><th>Earnings yield</th><th>EY rank</th><th>Price</th><th>1Y</th></tr></thead><tbody>
            {ranked.slice(0, limit).map((r) => (
              <tr key={r.sym} onClick={() => { window.location.href = `/company/?s=${r.sym}`; }}>
                <td><div className="co"><b>{r.sym}</b><span>{r.name}</span></div></td>
                <td className="num"><b>{r.mf!.rank}</b></td>
                <td className="num">{pct(r.mf!.roc ?? null, 1, false)}</td><td className="num dim">{r.mf!.roc_rank}</td>
                <td className="num">{pct(r.mf!.ey ?? null, 1, false)}</td><td className="num dim">{r.mf!.ey_rank}</td>
                <td className="num">₹{num(r.price, 2)}</td>
                <td className={`num ${(r.r1y ?? 0) >= 0 ? 'up' : 'down'}`}>{pct(r.r1y, 1)}</td>
              </tr>
            ))}
          </tbody></table></div>
          {limit < ranked.length && <div style={{ textAlign: 'center', marginTop: 20 }}><button className="btn ghost" onClick={() => setLimit((n) => n + 100)}>Show 100 more</button></div>}
          {mf && (
            <div className="grid g2" style={{ marginTop: 32 }}>
              <div className="panel"><div className="eyebrow">Excluded, and why</div><ul className="muted" style={{ paddingLeft: 18 }}>{Object.entries(mf.excluded).sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k}><b className="num" style={{ color: 'var(--text)' }}>{v}</b> · {k}</li>)}</ul></div>
              <div className="panel"><div className="eyebrow">Where this differs from the book</div><p className="muted">Return on capital uses the screen’s ROCE on invested capital, not net working capital plus net fixed assets. EBIT is the last fiscal year, not trailing twelve months. A year whose EBIT margin moved 15+ points is left unranked as a likely one-off. Enterprise value carries no minority-interest line, so a holding company that consolidates a listed subsidiary can look cheaper than it is.</p><p className="dim" style={{ fontSize: 14 }}>A ranking is a way to read the market, not a list to buy from. <Link href="/about/" style={{ color: 'var(--accent-2)' }}>Method →</Link></p></div>
            </div>
          )}
        </Async>
      </section>
    </>
  );
}
