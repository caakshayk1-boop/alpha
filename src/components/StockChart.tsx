'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { chartFeed } from '@/lib/data';
import { atr, levels, rsi, sma, type Bars } from '@/lib/ta';
import type { ChartFeed } from '@/lib/types';
import { num } from '@/lib/format';

export interface Plan { sl: number; entry: number; targets: number[]; label: string }
const RANGES = ['3mo', '6mo', '1y', '2y', '5y'] as const;
const RLABEL: Record<string, string> = { '3mo': '3M', '6mo': '6M', '1y': '1Y', '2y': '2Y', '5y': '5Y' };
type Mode = 'candles' | 'line' | 'rel';

const css = (n: string, fb: string) => (typeof document === 'undefined' ? fb : getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb);
const fmtDate = (t: number) => new Date(t * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });

export default function StockChart({ sym, plans = [] }: { sym: string; plans?: Plan[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>('1y');
  const [mode, setMode] = useState<Mode>('candles');
  const [on, setOn] = useState({ s20: true, s50: true, s200: true, vol: true, rsi: false, sr: true, plan: true });
  const [data, setData] = useState<ChartFeed | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let live = true;
    setData(null); setErr(null);
    chartFeed(sym, range).then((d) => { if (live) setData(d); }, (e: Error) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [sym, range]);

  useEffect(() => {
    const re = () => setTick((n) => n + 1);
    window.addEventListener('resize', re);
    const mo = new MutationObserver(re);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const t = window.setTimeout(re, 60);
    return () => { window.removeEventListener('resize', re); mo.disconnect(); window.clearTimeout(t); };
  }, []);

  const bars: Bars | null = data?.ok ? data : null;
  const ind = useMemo(() => bars && ({ s20: sma(bars.c, 20), s50: sma(bars.c, 50), s200: sma(bars.c, 200), rsi: rsi(bars.c), lv: levels(bars), atr: atr(bars) }), [bars]);

  useEffect(() => {
    const c = cv.current, box = wrap.current;
    if (!c || !box || !bars || !ind) return;
    const W = box.clientWidth || 800;
    const showRsi = on.rsi, showVol = on.vol;
    const H = 330 + (showVol ? 70 : 0) + (showRsi ? 90 : 0);
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr; c.height = H * dpr; c.style.width = `${W}px`; c.style.height = `${H}px`;
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const up = css('--up', '#3ddc97'), down = css('--down', '#ff6b7a'), text = css('--muted', '#9aa5b5'), line = css('--line', 'rgba(255,255,255,.08)'), acc = css('--accent', '#8e9bff'), warn = css('--warn', '#f5b84a'), acc2 = css('--accent-2', '#b5beff');
    const n = bars.c.length, padL = 8, padR = 62, top = 10;
    const pw = W - padL - padR, ph = 300;
    const step = pw / n, X = (i: number) => padL + (i + 0.5) * step;
    // price scale
    let lo = Infinity, hi = -Infinity;
    const rel = mode === 'rel';
    const base = bars.c[0], nb = bars.nifty.find((v) => v !== null) ?? null;
    const series = rel ? bars.c.map((v) => (v / base) * 100) : bars.c;
    const nser = rel && nb ? bars.nifty.map((v) => (v === null ? null : (v / nb) * 100)) : null;
    if (rel) {
      for (const v of series) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      if (nser) for (const v of nser) if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    } else {
      for (let i = 0; i < n; i++) { lo = Math.min(lo, bars.l[i]); hi = Math.max(hi, bars.h[i]); }
      if (on.plan) for (const p of plans) for (const v of [p.sl, ...p.targets]) { lo = Math.min(lo, v * 0.995); hi = Math.max(hi, v * 1.005); }
    }
    const m = (hi - lo) * 0.06; lo -= m; hi += m;
    const Y = (v: number) => top + ph - ((v - lo) / (hi - lo)) * ph;
    g.font = '11px ui-monospace, Menlo, monospace'; g.textBaseline = 'middle';
    for (let k = 0; k <= 5; k++) {
      const v = lo + ((hi - lo) * k) / 5, y = Y(v);
      g.strokeStyle = line; g.beginPath(); g.moveTo(padL, y); g.lineTo(W - padR, y); g.stroke();
      g.fillStyle = text; g.textAlign = 'left'; g.fillText(rel ? v.toFixed(0) : num(v, v < 100 ? 2 : 0), W - padR + 6, y);
    }
    // x labels
    g.textAlign = 'center'; g.fillStyle = text;
    for (let k = 0; k < 5; k++) { const i = Math.round(((n - 1) * k) / 4); g.fillText(fmtDate(bars.t[i]), Math.min(Math.max(X(i), 36), W - padR - 30), top + ph + 14); }
    // support/resistance
    if (on.sr && !rel) for (const l of ind.lv) {
      if (l.price < lo || l.price > hi) continue;
      g.setLineDash([2, 4]); g.strokeStyle = l.kind === 'support' ? up : down; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(padL, Y(l.price)); g.lineTo(W - padR, Y(l.price)); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1; g.fillStyle = l.kind === 'support' ? up : down; g.textAlign = 'right'; g.fillText(`${l.kind === 'support' ? 'S' : 'R'} ×${l.touches}`, W - padR - 4, Y(l.price) - 7);
    }
    const poly = (arr: (number | null)[], color: string, w = 1.4) => {
      g.strokeStyle = color; g.lineWidth = w; g.beginPath(); let started = false;
      arr.forEach((v, i) => { if (v === null) return; const x = X(i), y = Y(v); if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y); });
      g.stroke(); g.lineWidth = 1;
    };
    if (mode === 'candles') {
      const bw = Math.max(1, Math.min(10, step * 0.7));
      for (let i = 0; i < n; i++) {
        const col = bars.c[i] >= bars.o[i] ? up : down;
        g.strokeStyle = col; g.fillStyle = col;
        g.beginPath(); g.moveTo(X(i), Y(bars.h[i])); g.lineTo(X(i), Y(bars.l[i])); g.stroke();
        const y1 = Y(bars.o[i]), y2 = Y(bars.c[i]);
        g.fillRect(X(i) - bw / 2, Math.min(y1, y2), bw, Math.max(1, Math.abs(y2 - y1)));
      }
    } else {
      const grad = g.createLinearGradient(0, top, 0, top + ph); grad.addColorStop(0, `${acc}33`); grad.addColorStop(1, `${acc}00`);
      if (!rel) { g.beginPath(); series.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)))); g.lineTo(X(n - 1), top + ph); g.lineTo(X(0), top + ph); g.closePath(); g.fillStyle = grad; g.fill(); }
      poly(series, acc, 1.8);
      if (nser) poly(nser, warn, 1.4);
    }
    if (!rel) { if (on.s20) poly(ind.s20, acc2, 1.2); if (on.s50) poly(ind.s50, warn, 1.2); if (on.s200) poly(ind.s200, '#c084fc', 1.2); }
    // engine plan lines
    if (on.plan && !rel) for (const p of plans) {
      const marks: [number, string, string][] = [[p.sl, down, 'Stop'], [p.entry, text, 'Entry'], ...p.targets.map((t, i): [number, string, string] => [t, up, `T${i + 1}`])];
      for (const [v, col, lab] of marks) {
        g.setLineDash([6, 4]); g.strokeStyle = col; g.globalAlpha = 0.9; g.beginPath(); g.moveTo(padL, Y(v)); g.lineTo(W - padR, Y(v)); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
        g.fillStyle = col; g.textAlign = 'left'; g.fillText(`${lab} ${p.label}`, padL + 6, Y(v) - 7);
      }
    }
    // last price tag
    const last = bars.c[n - 1], lastY = Y(rel ? series[n - 1] : last);
    g.fillStyle = bars.c[n - 1] >= bars.c[Math.max(0, n - 2)] ? up : down; g.fillRect(W - padR, lastY - 9, padR - 2, 18);
    g.fillStyle = '#04110b'; g.textAlign = 'left'; g.fillText(rel ? series[n - 1].toFixed(0) : num(last, last < 100 ? 2 : 0), W - padR + 4, lastY);
    // volume
    let yOff = top + ph + 24;
    if (showVol) {
      const vh = 46, vmax = Math.max(...bars.v, 1);
      for (let i = 0; i < n; i++) { g.fillStyle = bars.c[i] >= bars.o[i] ? `${up}88` : `${down}88`; const h = (bars.v[i] / vmax) * vh; g.fillRect(X(i) - Math.max(0.5, step * 0.35), yOff + vh - h, Math.max(1, step * 0.7), h); }
      g.fillStyle = text; g.textAlign = 'left'; g.fillText('Volume', padL + 2, yOff + 6);
      yOff += vh + 14;
    }
    if (showRsi) {
      const rh = 60;
      g.strokeStyle = line; for (const lv of [30, 70]) { const y = yOff + rh - (lv / 100) * rh; g.beginPath(); g.moveTo(padL, y); g.lineTo(W - padR, y); g.stroke(); g.fillStyle = text; g.textAlign = 'left'; g.fillText(String(lv), W - padR + 6, y); }
      g.strokeStyle = acc; g.lineWidth = 1.4; g.beginPath(); let st = false;
      ind.rsi.forEach((v, i) => { if (v === null) return; const y = yOff + rh - (v / 100) * rh; if (!st) { g.moveTo(X(i), y); st = true; } else g.lineTo(X(i), y); });
      g.stroke(); g.lineWidth = 1; g.fillStyle = text; g.textAlign = 'left'; g.fillText('RSI 14', padL + 2, yOff + 6);
    }
    // crosshair
    if (hover !== null && hover >= 0 && hover < n) {
      g.strokeStyle = text; g.globalAlpha = 0.6; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(hover), top); g.lineTo(X(hover), H - 6); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
  }, [bars, ind, mode, on, plans, hover, tick]);

  const onMove = (e: React.PointerEvent) => {
    const c = cv.current;
    if (!c || !bars) return;
    const r = c.getBoundingClientRect();
    const n = bars.c.length, pw = r.width - 8 - 62;
    setHover(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left - 8) / pw) * n))));
  };
  const i = hover ?? (bars ? bars.c.length - 1 : 0);
  const chg = bars && i > 0 ? (bars.c[i] / bars.c[i - 1] - 1) * 100 : null;
  const overall = bars ? (bars.c[bars.c.length - 1] / bars.c[0] - 1) * 100 : null;
  const nOverall = bars ? (() => { const f = bars.nifty.find((v) => v !== null), l = [...bars.nifty].reverse().find((v) => v !== null); return f && l ? (l / f - 1) * 100 : null; })() : null;
  const trend = bars && ind ? (() => {
    const px = bars.c[bars.c.length - 1], s50 = ind.s50[bars.c.length - 1], s200 = ind.s200[bars.c.length - 1];
    if (s50 === null || s200 === null) return null;
    return px > s50 && s50 > s200 ? 'Uptrend: price above the 50-day, which is above the 200-day' : px < s50 && s50 < s200 ? 'Downtrend: price below the 50-day, which is below the 200-day' : px > s200 ? 'Mixed: above the 200-day but not in a clean uptrend' : 'Weak: below the 200-day average';
  })() : null;
  const toggles: [keyof typeof on, string][] = [['s20', 'SMA 20'], ['s50', 'SMA 50'], ['s200', 'SMA 200'], ['vol', 'Volume'], ['rsi', 'RSI'], ['sr', 'Support / resistance'], ['plan', 'Engine plan']];

  return (
    <div>
      <div className="filters" style={{ marginBottom: 10 }}>
        <div role="group" aria-label="Range" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{RANGES.map((r) => <button key={r} className="chip" aria-pressed={range === r} onClick={() => setRange(r)}>{RLABEL[r]}</button>)}</div>
        <div role="group" aria-label="Chart type" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{([['candles', 'Candles'], ['line', 'Line'], ['rel', 'vs Nifty']] as const).map(([k, l]) => <button key={k} className="chip" aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}</div>
      </div>
      <div className="num" style={{ fontSize: 13, minHeight: 22, marginBottom: 6 }}>
        {bars ? (<>
          <b>{fmtDate(bars.t[i])}</b> · O {num(bars.o[i], 2)} · H {num(bars.h[i], 2)} · L {num(bars.l[i], 2)} · C <b>{num(bars.c[i], 2)}</b>{chg !== null && <span className={chg >= 0 ? 'up' : 'down'}> {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</span>} · Vol {num(bars.v[i])}
        </>) : <span className="dim">{err ? 'Price history unavailable' : 'Loading prices…'}</span>}
      </div>
      <div ref={wrap} style={{ position: 'relative', minHeight: 330 }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <canvas ref={cv} role="img" aria-label={`Price chart for ${sym}`} style={{ display: 'block', touchAction: 'pan-y' }} />
        {!bars && <p className="dim" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', margin: 0 }}>{err ? `Could not load ${sym} history (${err}).` : ''}</p>}
        {data && !data.ok && <p className="dim" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', margin: 0 }}>{data.error ?? 'No price history for this symbol.'}</p>}
      </div>
      <div className="filters" style={{ marginTop: 10 }}>
        {toggles.map(([k, l]) => <button key={k} className="chip" aria-pressed={on[k]} onClick={() => setOn((o) => ({ ...o, [k]: !o[k] }))} disabled={(k === 'plan' && plans.length === 0) || (mode === 'rel' && !['vol', 'rsi'].includes(k))}>{l}</button>)}
      </div>
      {bars && ind && (
        <div className="grid g3" style={{ marginTop: 14 }}>
          <div className="panel tight"><div className="eyebrow">Over {RLABEL[range]}</div><p className="num" style={{ margin: '6px 0 0' }}><b className={(overall ?? 0) >= 0 ? 'up' : 'down'}>{overall !== null ? `${overall >= 0 ? '+' : ''}${overall.toFixed(1)}%` : '—'}</b> stock · <b>{nOverall !== null ? `${nOverall >= 0 ? '+' : ''}${nOverall.toFixed(1)}%` : '—'}</b> Nifty{overall !== null && nOverall !== null && <> · <span className={overall - nOverall >= 0 ? 'up' : 'down'}>{overall - nOverall >= 0 ? 'ahead' : 'behind'} by {Math.abs(overall - nOverall).toFixed(1)} pts</span></>}</p></div>
          <div className="panel tight"><div className="eyebrow">Trend read</div><p className="muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>{trend ?? 'Needs 200 sessions of history.'}</p></div>
          <div className="panel tight"><div className="eyebrow">Nearest levels</div><p className="num" style={{ margin: '6px 0 0', fontSize: 13 }}>{ind.lv.length ? ind.lv.slice(0, 4).sort((a, b) => b.price - a.price).map((l) => <span key={l.price} className={l.kind === 'support' ? 'up' : 'down'} style={{ marginRight: 10 }}>{l.kind === 'support' ? 'S' : 'R'} {num(l.price, 0)}</span>) : 'None repeated twice.'}{ind.atr && <span className="dim"> · ATR {num(ind.atr, 1)}</span>}</p></div>
        </div>
      )}
      <p className="dim" style={{ fontSize: 12, margin: '10px 0 0' }}>Daily bars from Yahoo Finance via NSE tickers, cached up to 15 minutes; 5Y uses weekly bars. Levels are swing highs and lows touched at least twice within 1.5%: where the price paused before, not where it must pause again.</p>
    </div>
  );
}
