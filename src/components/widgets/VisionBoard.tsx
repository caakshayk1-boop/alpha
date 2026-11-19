'use client';
/** VisionBoard: the Vision features folded into Today. Everything is computed from feeds Alpha already publishes (the screen and
 *  the Nifty's daily bars), so nothing here adds a feed. No chart library: plain SVG and CSS. Descriptions of the past, never calls. */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Chg, LazyMount, Skel } from '@/components/ui';
import { BASE, useFeedWhen } from '@/lib/data';
import { dateLabel, num } from '@/lib/format';
import { companyHref } from '@/lib/slug';
import type { Row } from '@/lib/types';

type R = Row & { rank_move?: number | null; liquid?: boolean; vol_spike?: number | null; brk52w?: boolean };
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);

function useRows(): { rows: R[] | null; built: string | null; error: boolean } {
  const s = useFeedWhen('screen', true);
  return { rows: (s.data?.rows as R[] | undefined) ?? null, built: s.data?.built_on ?? null, error: !!s.error };
}

const Sym = ({ r }: { r: R }) => <Link className="row" href={companyHref(r.sym)}><span style={{ minWidth: 0 }}><span className="row-t">{r.sym}</span><div className="row-s">{r.name}</div></span></Link>;

/** Unusual today: three counts, then the names behind the heaviest volume and the nearest results. */
export function UnusualToday() {
  const { rows, error } = useRows();
  const v = useMemo(() => {
    if (!rows) return null;
    const liq = rows.filter((r) => r.liquid);
    const vol = liq.filter((r) => (r.vol_spike ?? 0) >= 3).sort((a, b) => (b.vol_spike ?? 0) - (a.vol_spike ?? 0));
    const hi = liq.filter((r) => r.brk52w);
    const t = istToday(), end = addDays(t, 7);
    const res = rows.filter((r) => r.next_earnings && r.next_earnings >= t && r.next_earnings <= end).sort((a, b) => (a.next_earnings! < b.next_earnings! ? -1 : 1));
    return { vol, hi, res };
  }, [rows]);
  return (
    <section className="card" aria-labelledby="unusual-h">
      <div className="card-h"><h2 id="unusual-h">Unusual today</h2><Link className="more" href="/screen/">The screen →</Link></div>
      {!v ? (error ? <p className="dim" style={{ margin: 0 }}>The screen did not load.</p> : <Skel h={140} />) : (
        <>
          <ul className="rows">
            <li className="row kvrow"><span className="row-s">Volume 3× or more of average</span><b className="num">{v.vol.length}</b></li>
            <li className="row kvrow"><span className="row-s">Closed at a 52-week high</span><b className="num">{v.hi.length}</b></li>
            <li className="row kvrow"><span className="row-s">Results due in 7 days</span><b className="num">{v.res.length}</b></li>
          </ul>
          <div className="chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {v.vol.slice(0, 8).map((r) => <Link key={r.sym} className="pill nodot" href={companyHref(r.sym)} title={`${r.name}: ${num(r.vol_spike ?? 0, 1)}× average volume`}>{r.sym}</Link>)}
          </div>
          <p className="card-foot">Liquid names only, from the screen&apos;s last close. Results dates are the screen&apos;s estimates; confirm on the exchange.</p>
        </>
      )}
    </section>
  );
}

/** What changed across the screen: names whose rank moved most against the previous build. */
export function RankMovers() {
  const { rows, built, error } = useRows();
  const m = useMemo(() => {
    if (!rows) return null;
    const a = rows.filter((r) => r.liquid && typeof r.rank_move === 'number' && r.rank_move !== 0).sort((x, y) => y.rank_move! - x.rank_move!);
    return { up: a.slice(0, 6), down: a.slice(-6).reverse() };
  }, [rows]);
  const list = (t: string, a: R[]) => (
    <div><h3 className="eyebrow" style={{ margin: '0 0 6px' }}>{t}</h3>
      <ul className="rows">{a.map((r) => <li key={r.sym}><Link className="row" href={companyHref(r.sym)}><span style={{ minWidth: 0 }}><span className="row-t">{r.sym}</span><div className="row-s">{r.name}</div></span><span className="row-r"><Chg v={r.rank_move} dp={0} suffix=" places" /></span></Link></li>)}</ul></div>
  );
  return (
    <section className="card" aria-labelledby="rank-h">
      <div className="card-h"><h2 id="rank-h">What changed across the screen</h2><Link className="more" href="/screen/">Rank on the screen →</Link></div>
      {!m ? (error ? <p className="dim" style={{ margin: 0 }}>The screen did not load.</p> : <Skel h={200} />) : (
        <>
          <div className="grid-2">{list('Climbing', m.up)}{list('Slipping', m.down)}</div>
          <p className="card-foot">Places gained or lost in the screen&apos;s composite rank since its previous build{built ? ` (this build ${dateLabel(built)})` : ''}; liquid names. A description, not a call.</p>
        </>
      )}
    </section>
  );
}

/** Sectors this week: the median 1-week move of each sector's screened names, and how many rose. */
export function SectorWeek() {
  const { rows, error } = useRows();
  const s = useMemo(() => {
    if (!rows) return null;
    const by = new Map<string, number[]>();
    for (const r of rows) if (r.sector && typeof r.r1w === 'number') (by.get(r.sector) ?? by.set(r.sector, []).get(r.sector)!).push(r.r1w);
    const list = [...by].map(([name, a]) => ({ name, med: median(a)!, up: a.filter((x) => x > 0).length, n: a.length })).filter((x) => x.n >= 5).sort((a, b) => b.med - a.med);
    const all = rows.filter((r) => typeof r.r1w === 'number');
    return { list, typical: median(all.map((r) => r.r1w as number)), rose: all.filter((r) => (r.r1w as number) > 0).length, n: all.length };
  }, [rows]);
  const max = Math.max(1, ...(s?.list.map((x) => Math.abs(x.med)) ?? [1]));
  return (
    <section className="card" aria-labelledby="sw-h">
      <div className="card-h"><h2 id="sw-h">Which sectors are moving this week?</h2><Link className="more" href="/map/">Heat lab →</Link></div>
      {!s ? (error ? <p className="dim" style={{ margin: 0 }}>The screen did not load.</p> : <Skel h={260} />) : (
        <>
          <p className="dim" style={{ margin: "0 0 10px" }}>{num(s.rose)} of {num(s.n)} screened names rose; the typical stock moved <Chg v={s.typical} dp={1} />.</p>
          <ul className="rows">
            {s.list.map((x) => (
              <li key={x.name} className="row kvrow" style={{ gap: 10 }}>
                <span style={{ flex: '0 0 9.5em', minWidth: 0 }}>{x.name}<div className="row-s">{x.up} of {x.n} rose</div></span>
                <span aria-hidden style={{ flex: 1, height: 8, position: 'relative', background: 'var(--bg-2)', borderRadius: 4 }}>
                  <i style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: 4, background: x.med >= 0 ? 'var(--up)' : 'var(--down)', width: `${(Math.abs(x.med) / max) * 50}%`, [x.med >= 0 ? 'left' : 'right']: '50%' }} />
                </span>
                <Chg v={x.med} dp={1} />
              </li>
            ))}
          </ul>
          <p className="card-foot">Each bar is the middle stock of its sector, not a cap-weighted index, so one large name cannot carry it. A description, not a recommendation.</p>
        </>
      )}
    </section>
  );
}

/** Biggest 1-week movers among liquid names, with turnover so thin trading is visible. */
export function WeekMovers() {
  const { rows, error } = useRows();
  const m = useMemo(() => {
    if (!rows) return null;
    const a = rows.filter((r) => r.liquid && typeof r.r1w === 'number').sort((x, y) => (y.r1w as number) - (x.r1w as number));
    return { up: a.slice(0, 5), down: a.slice(-5).reverse() };
  }, [rows]);
  const col = (t: string, a: R[]) => (
    <div><h3 className="eyebrow" style={{ margin: '0 0 6px' }}>{t}</h3>
      <ul className="rows">{a.map((r) => <li key={r.sym}><Link className="row" href={companyHref(r.sym)}><span style={{ minWidth: 0 }}><span className="row-t">{r.sym}</span><div className="row-s">{r.sector} · ₹{num(r.turnover_cr ?? 0)} cr a day</div></span><span className="row-r"><Chg v={r.r1w} dp={1} /></span></Link></li>)}</ul></div>
  );
  return (
    <section className="card" aria-labelledby="wm-h">
      <div className="card-h"><h2 id="wm-h">What moved most this week?</h2></div>
      {!m ? (error ? <p className="dim" style={{ margin: 0 }}>The screen did not load.</p> : <Skel h={220} />) : (
        <>
          <div className="grid-2">{col('Rose most', m.up)}{col('Fell most', m.down)}</div>
          <p className="card-foot">Turnover is the average traded value a day; a big move on thin trading is a different thing from one on heavy trading. A description, not a recommendation.</p>
        </>
      )}
    </section>
  );
}

interface Bars { t: number[]; c: number[] }
function useNifty(): { bars: Bars | null; error: boolean } {
  const [bars, setBars] = useState<Bars | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const ac = new AbortController();
    fetch(`${BASE}/api/instrument?id=nifty`, { signal: ac.signal }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then((j) => { if (j?.ok) setBars({ t: j.t, c: j.c }); else setError(true); }).catch((e) => { if (e?.name !== 'AbortError') setError(true); });
    return () => ac.abort();
  }, []);
  return { bars, error };
}
const day = (t: number) => new Date(t * 1000 + 5.5 * 3600e3).toISOString().slice(0, 10);

/** The Nifty over a year, with how far it stood below its running high. Daily closes from the exchange index, delayed. */
export function NiftyYear() {
  const { bars, error } = useNifty();
  const v = useMemo(() => {
    if (!bars) return null;
    const { c, t } = bars;
    let hi = -Infinity, worst = 0; const dd = c.map((x) => { hi = Math.max(hi, x); const d = x / hi - 1; worst = Math.min(worst, d); return d; });
    const lo = Math.min(...c), top = Math.max(...c), W = 640, H = 150, D = 46;
    const X = (i: number) => (i / (c.length - 1)) * W;
    const Y = (x: number) => 4 + (1 - (x - lo) / (top - lo || 1)) * (H - 8);
    const line = c.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(x).toFixed(1)}`).join('');
    const area = `M0 0 ${dd.map((d, i) => `L${X(i).toFixed(1)} ${(-d / (-worst || 1) * D).toFixed(1)}`).join('')} L${W} 0Z`;
    const last = c[c.length - 1];
    return { line, area, W, H, D, last, first: c[0], top, lo, worst, below: dd[dd.length - 1], from: day(t[0]), to: day(t[t.length - 1]) };
  }, [bars]);
  return (
    <section className="card" aria-labelledby="ny-h">
      <div className="card-h"><h2 id="ny-h">How has the market done this year?</h2><Link className="more" href="/markets/">Markets →</Link></div>
      {!v ? (error ? <p className="dim" style={{ margin: 0 }}>The Nifty history could not be loaded. Nothing is estimated in its place.</p> : <Skel h={220} />) : (
        <>
          <ul className="rows" style={{ marginBottom: 8 }}>
            <li className="row kvrow"><span className="row-s">Nifty 50 close</span><b className="num">{num(v.last, 0)}</b></li>
            <li className="row kvrow"><span className="row-s">Over the period</span><Chg v={(v.last / v.first - 1) * 100} dp={1} /></li>
            <li className="row kvrow"><span className="row-s">Below its high</span><Chg v={v.below * 100} dp={1} /></li>
            <li className="row kvrow"><span className="row-s">Worst fall from a high</span><Chg v={v.worst * 100} dp={1} /></li>
          </ul>
          <svg viewBox={`0 0 ${v.W} ${v.H}`} width="100%" role="img" aria-label={`Nifty 50 daily closes ${dateLabel(v.from)} to ${dateLabel(v.to)}, from ${num(v.lo, 0)} to ${num(v.top, 0)}`} style={{ display: 'block' }}>
            <path d={v.line} fill="none" stroke="var(--accent)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          </svg>
          <svg viewBox={`0 0 ${v.W} ${v.D}`} width="100%" role="img" aria-label="How far the Nifty stood below its highest close so far" style={{ display: 'block', marginTop: 4 }}>
            <path d={v.area} fill="var(--down-soft)" stroke="var(--down)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
          <p className="card-foot">Daily closes {dateLabel(v.from)} to {dateLabel(v.to)}, delayed. The lower chart is how far the index stood below its highest close so far. A price index: dividends are not included. A description of the past, not a forecast.</p>
        </>
      )}
    </section>
  );
}

/** One square per session, weeks across, weekdays down. Falls are hatched as well as red, so sign never rests on colour. */
export function DayGrid() {
  const { bars, error } = useNifty();
  const v = useMemo(() => {
    if (!bars) return null;
    const days = bars.t.map((t, i) => ({ d: day(t), p: i ? (bars.c[i] / bars.c[i - 1] - 1) * 100 : null })).slice(1).slice(-126);
    const start = new Date(`${days[0].d}T00:00:00Z`); const pad = (start.getUTCDay() + 6) % 7;          // Monday = 0
    const cells = days.map((x) => { const dt = new Date(`${x.d}T00:00:00Z`); const wd = (dt.getUTCDay() + 6) % 7; const wk = Math.floor((Math.round((dt.getTime() - start.getTime()) / 864e5) + pad) / 7); return { ...x, wd, wk }; }).filter((x) => x.wd < 5);
    const weeks = Math.max(...cells.map((c) => c.wk)) + 1;
    const up = days.filter((x) => (x.p ?? 0) > 0).length, down = days.filter((x) => (x.p ?? 0) < 0).length;
    const best = days.reduce((a, b) => ((b.p ?? -9) > (a.p ?? -9) ? b : a)), worst = days.reduce((a, b) => ((b.p ?? 9) < (a.p ?? 9) ? b : a));
    return { cells, weeks, up, down, best, worst, n: days.length, from: days[0].d, to: days[days.length - 1].d };
  }, [bars]);
  const fill = (p: number) => { const k = Math.min(1, Math.abs(p) / 1.5); return `color-mix(in srgb, var(${p >= 0 ? '--up' : '--down'}) ${Math.round(18 + k * 72)}%, var(--bg))`; };
  return (
    <section className="card" aria-labelledby="dg-h">
      <div className="card-h"><h2 id="dg-h">How did each trading day go?</h2></div>
      {!v ? (error ? <p className="dim" style={{ margin: 0 }}>The Nifty history could not be loaded.</p> : <Skel h={140} />) : (
        <>
          <p className="dim" style={{ margin: "0 0 10px" }}>{v.up} up days and {v.down} down days of {v.n} sessions. Best {v.best.p!.toFixed(2)}% ({dateLabel(v.best.d)}); worst {v.worst.p!.toFixed(2)}% ({dateLabel(v.worst.d)}).</p>
          <svg viewBox={`0 0 ${v.weeks * 14} 70`} width="100%" role="img" aria-label={`Nifty 50 daily change, one square per session, ${dateLabel(v.from)} to ${dateLabel(v.to)}`} style={{ display: 'block', maxHeight: 150 }}>
            <defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--bg)" strokeWidth="1.2" opacity=".55" /></pattern></defs>
            {v.cells.map((c) => (
              <g key={c.d}>
                <rect x={c.wk * 14} y={c.wd * 14} width="12" height="12" rx="2" fill={fill(c.p ?? 0)}><title>{`${dateLabel(c.d)}: ${(c.p ?? 0) >= 0 ? '+' : ''}${(c.p ?? 0).toFixed(2)}%`}</title></rect>
                {(c.p ?? 0) < 0 && <rect x={c.wk * 14} y={c.wd * 14} width="12" height="12" rx="2" fill="url(#hatch)" pointerEvents="none" />}
              </g>
            ))}
          </svg>
          <p className="card-foot">Each square is one session, Monday to Friday down and week by week across. Falls are hatched as well as red. Hover or focus a square for the day.</p>
        </>
      )}
    </section>
  );
}

/** The block placed on Today, lazy so it costs nothing until it nears the viewport. */
export function VisionBoard() {
  return (
    <section className="wrap section2" aria-label="Market context from Vision">
      <div className="grid-2" style={{ marginBottom: 'var(--sp-5, 24px)' }}>
        <LazyMount minHeight={300}><UnusualToday /></LazyMount>
        <LazyMount minHeight={300}><RankMovers /></LazyMount>
      </div>
      <div className="grid-2" style={{ marginBottom: 'var(--sp-5, 24px)' }}>
        <LazyMount minHeight={320}><NiftyYear /></LazyMount>
        <LazyMount minHeight={320}><DayGrid /></LazyMount>
      </div>
      <div className="grid-2">
        <LazyMount minHeight={360}><SectorWeek /></LazyMount>
        <LazyMount minHeight={360}><WeekMovers /></LazyMount>
      </div>
    </section>
  );
}
