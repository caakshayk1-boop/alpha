'use client';
/** One instrument in depth (Nifty, Sensex, gold, USD/INR ...): today's range, the 52-week range, the levels a desk watches
 *  (floor pivots, 20/50/200-day averages, the 52-week extremes) on one ladder with the price on it, returns, and a few plain
 *  facts. A year of daily bars from /api/instrument; standard definitions only (lib/levels.ts), nothing forecast. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Chg, Skel, Spark } from '@/components/ui';
import { BASE } from '@/lib/data';
import { num, quoteState } from '@/lib/format';
import { highlights, levels, type Bars } from '@/lib/levels';
import { istDate } from '@/lib/live';
import { useModal } from '@/lib/useModal';
import { chartSummary } from '@/lib/chartText';
import type { Quote } from '@/lib/types';

// A12: a year of bars is kept for 15 minutes (the Worker's own cache); a failed request is evicted at once, so Retry retries
const memo = new Map<string, { at: number; p: Promise<Bars | null> }>();
const fetchBars = (id: string, fresh = false) => {
  const hit = memo.get(id);
  if (hit && !fresh && Date.now() - hit.at < 15 * 60_000) return hit.p;
  const p = fetch(`${BASE}/api/instrument?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(15_000) }).then((r) => r.json()).then((j) => (j?.ok ? (j as Bars) : null), () => null);
  memo.set(id, { at: Date.now(), p });
  void p.then((b) => { if (!b && memo.get(id)?.p === p) memo.delete(id); });
  return p;
};
const dateOf = (t: number) => new Date(t * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** A bar from low to high with the price marked; `label` names the two ends. */
function RangeRail({ lo, hi, at, label }: { lo: number; hi: number; at: number; label: string }) {
  const p = hi > lo ? Math.max(0, Math.min(100, ((at - lo) / (hi - lo)) * 100)) : 50;
  return (
    <div className="irail" role="img" aria-label={`${label}: low ${num(lo, 2)}, high ${num(hi, 2)}, price ${num(at, 2)} at ${Math.round(p)}% of the range`}>
      <div className="irail-k"><span>{label}</span><span className="dim num">{Math.round(p)}% of the way up</span></div>
      <div className="irail-track"><i style={{ width: `${p}%` }} /><b style={{ left: `${p}%` }} /></div>
      <div className="irail-ends num"><span>{num(lo, 2)}</span><span>{num(hi, 2)}</span></div>
    </div>
  );
}

export function InstrumentSheet({ q, onClose }: { q: Quote; onClose: () => void }) {
  const [bars, setBars] = useState<Bars | null | undefined>(undefined);
  const panel = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { let live = true; setBars(undefined); void fetchBars(q.id, attempt > 0).then((b) => { if (live) setBars(b); }); return () => { live = false; }; }, [q.id, attempt]);
  useModal(panel, true, onClose);
  const sessionOpen = !!q.at && !!bars && bars.t.length > 0 && istDate(bars.t[bars.t.length - 1]) === istDate(q.at);
  const lv = useMemo(() => (bars ? levels(bars, q.price, sessionOpen) : null), [bars, q.price, sessionOpen]);
  const dp = q.dp;
  const f = (v: number | null | undefined) => (typeof v === 'number' ? `${q.prefix}${num(v, dp)}` : '—');
  const facts = lv ? highlights(lv) : [];
  const yearSeries = useMemo(() => (bars ? bars.c.filter((_, i) => i % 2 === 0 || i === bars.c.length - 1) : undefined), [bars]);
  // rendered at the document root: an ancestor with a transform (the page's entrance motion) would otherwise trap a fixed panel
  return createPortal(
    <div className="peek-back" onMouseDown={onClose} role="presentation">
      <div ref={panel} className="peek isheet" role="dialog" aria-modal="true" aria-label={`${q.name} in detail`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="peek-top"><span className="eyebrow">{q.group} · {quoteState(q.at).label}</span><button type="button" className="chip" data-close onClick={onClose} aria-label="Close">Close ✕</button></div>
        <h2 className="disp isheet-h">{q.name}</h2>
        <div className="isheet-px"><span className="num">{f(q.price)}{q.group === 'Rates' ? '%' : ''}</span> {q.group === 'Rates' && typeof q.prev === 'number' && typeof q.price === 'number' ? <Chg v={(q.price - q.prev) * 100} dp={0} suffix=" bp" /> : <Chg v={q.pct} />}{typeof q.prev === 'number' && <span className="dim num"> · previous close {f(q.prev)}</span>}</div>

        {typeof q.dayLo === 'number' && typeof q.dayHi === 'number' && typeof q.price === 'number' && <RangeRail lo={q.dayLo} hi={q.dayHi} at={q.price} label="Today's range" />}
        {lv?.lo52 && lv.hi52 && <RangeRail lo={lv.lo52.v} hi={lv.hi52.v} at={lv.last} label="52-week range" />}

        {bars === undefined && <><Skel h={120} /><Skel h={160} /></>}
        {bars === null && <p className="dim" style={{ margin: '8px 0 0' }}>The year of history did not load, so levels are not shown. Nothing is estimated in their place. <button type="button" className="chip" onClick={() => setAttempt((n) => n + 1)}>Retry</button></p>}
        {lv && (
          <>
            {facts.length > 0 && <ul className="isheet-facts">{facts.map((x) => <li key={x}>{x}</li>)}</ul>}
            <div className="isheet-chart" role="img" aria-label={bars ? chartSummary(bars.t, bars.c, bars.h, bars.l, (v) => `${q.prefix}${num(v, dp)}`) : undefined}><Spark series={yearSeries} up={(lv.ret.y1 ?? 0) >= 0} height={88} /><div className="dim num isheet-cap"><span>{bars ? dateOf(bars.t[0]) : ''}</span><span>one year, daily closes</span></div></div>
            <div className="isheet-rets">{([['1W', lv.ret.w1], ['1M', lv.ret.m1], ['3M', lv.ret.m3], ['YTD', lv.ret.ytd], ['1Y', lv.ret.y1]] as const).map(([k, v]) => <div key={k}><span className="k">{k}</span><Chg v={v} dp={1} /></div>)}</div>
            <h3 className="peek-h">Levels <span>high to low, with the price where it sits</span></h3>
            <ol className="lvl-ladder">
              {(() => {
                const rows = lv.ladder.map((x) => ({ ...x, here: false }));
                const i = rows.findIndex((x) => x.value < lv.last);
                rows.splice(i < 0 ? rows.length : i, 0, { label: 'Price now', value: lv.last, kind: 'range', here: true });
                return rows.map((x) => (
                  <li key={x.label} className={`k-${x.kind}${x.here ? ' here' : ''}`}>
                    <span>{x.label}</span>
                    <b className="num">{f(x.value)}</b>
                    <span className="dim num">{x.here ? '' : (() => { const d = (x.value / lv.last - 1) * 100; return Math.abs(d) < 0.05 ? '0.0%' : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}%`; })()}</span>
                  </li>
                ));
              })()}
            </ol>
            <div className="kv isheet-kv">
              <div><div className="k">Typical day</div><div className="v">{lv.rangePct === null ? '—' : `${lv.rangePct.toFixed(1)}%`}</div></div>
              <div><div className="k">Volatility (20d, yearly)</div><div className="v">{lv.vol20 === null ? '—' : `${lv.vol20.toFixed(0)}%`}</div></div>
              <div><div className="k">Best day, 1 year</div><div className="v up">{lv.best ? `+${lv.best.pct.toFixed(1)}%` : '—'}</div><div className="dim" style={{ fontSize: 12 }}>{lv.best ? dateOf(lv.best.t) : ''}</div></div>
              <div><div className="k">Worst day, 1 year</div><div className="v down">{lv.worst ? `${lv.worst.pct.toFixed(1)}%` : '—'}</div><div className="dim" style={{ fontSize: 12 }}>{lv.worst ? dateOf(lv.worst.t) : ''}</div></div>
            </div>
            <p className="dim" style={{ fontSize: 12.5, margin: '8px 0 0' }}>Pivots from the {lv.pivots ? dateOf(lv.pivots.from) : 'last'} session. 52-week high {lv.hi52 ? dateOf(lv.hi52.t) : '—'}, low {lv.lo52 ? dateOf(lv.lo52.t) : '—'}. Levels are standard formulas, not forecasts. <a href="/about/#markets" style={{ textDecoration: 'underline' }}>Method</a></p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
