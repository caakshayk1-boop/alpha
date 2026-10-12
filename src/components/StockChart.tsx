'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { chartFeed } from '@/lib/data';
import { keyLine, levels, rsi, sma, type Bars } from '@/lib/ta';
import type { ChartFeed } from '@/lib/types';
import { num } from '@/lib/format';
import { Segmented, Switch } from '@/components/ui';

export interface Plan { sl: number; entry: number; targets: number[]; label: string; odds?: { t: (number | undefined)[]; stopped?: number } }
const RANGES = ['3mo', '6mo', '1y', '2y', '5y'] as const;
const RLABEL: Record<string, string> = { '3mo': '3M', '6mo': '6M', '1y': '1Y', '2y': '2Y', '5y': '5Y' };
type Mode = 'candles' | 'line' | 'rel';
type On = { s50: boolean; s200: boolean; vol: boolean; rsi: boolean; sr: boolean; plan: boolean };
const INDICATORS: [keyof On, string][] = [['s50', '50-day'], ['s200', '200-day'], ['vol', 'Volume'], ['rsi', 'RSI'], ['sr', 'Support / resistance'], ['plan', 'Engine plan']];

const css = (n: string, fb: string) => (typeof document === 'undefined' ? fb : getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb);
const fmtDate = (t: number) => new Date(t * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
const px = (v: number) => num(v, v < 100 ? 2 : 0);

export default function StockChart({ sym, plans = [] }: { sym: string; plans?: Plan[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>('1y');
  const [mode, setMode] = useState<Mode>('candles');
  const [on, setOn] = useState<On>({ s50: false, s200: false, vol: false, rsi: false, sr: false, plan: true });
  const [menu, setMenu] = useState(false);
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
  const ind = useMemo(() => bars && ({ s50: sma(bars.c, 50), s200: sma(bars.c, 200), rsi: rsi(bars.c), lv: levels(bars), kl: keyLine(bars) }), [bars]);

  useEffect(() => {
    const c = cv.current, box = wrap.current;
    if (!c || !box || !bars || !ind) return;
    const W = box.clientWidth || 800;
    const rel = mode === 'rel';
    const H = 300 + (on.vol && !rel ? 52 : 0) + (on.rsi ? 76 : 0);
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr; c.height = H * dpr; c.style.width = `${W}px`; c.style.height = `${H}px`;
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const up = css('--up', '#3ddc97'), down = css('--down', '#ff6b7a'), text = css('--muted', '#9aa5b5'), grid = css('--line', 'rgba(255,255,255,.08)'), acc = css('--accent', '#8e9bff'), warn = css('--warn', '#f5b84a');
    const n = bars.c.length, padL = 6, padR = 58, top = 8, ph = 264;
    const pw = W - padL - padR, step = pw / n, X = (i: number) => padL + (i + 0.5) * step;
    const base = bars.c[0], nb = bars.nifty.find((v) => v !== null) ?? null;
    const series = rel ? bars.c.map((v) => (v / base) * 100) : bars.c;
    const nser = rel && nb ? bars.nifty.map((v) => (v === null ? null : (v / nb) * 100)) : null;
    let lo = Infinity, hi = -Infinity;
    if (rel) {
      for (const v of series) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      if (nser) for (const v of nser) if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    } else {
      for (let i = 0; i < n; i++) { lo = Math.min(lo, bars.l[i]); hi = Math.max(hi, bars.h[i]); const k = ind.kl.line[i]; if (k !== null) { lo = Math.min(lo, k); hi = Math.max(hi, k); } }
      if (on.plan) for (const p of plans) for (const v of [p.sl, ...p.targets]) { lo = Math.min(lo, v * 0.995); hi = Math.max(hi, v * 1.005); }
    }
    const m = (hi - lo) * 0.07; lo -= m; hi += m;
    const Y = (v: number) => top + ph - ((v - lo) / (hi - lo)) * ph;
    g.font = '11px ui-monospace, Menlo, monospace'; g.textBaseline = 'middle';
    for (let k = 0; k <= 3; k++) {
      const v = lo + ((hi - lo) * (k + 0.5)) / 4, y = Y(v);
      g.strokeStyle = grid; g.beginPath(); g.moveTo(padL, y); g.lineTo(W - padR, y); g.stroke();
      g.fillStyle = text; g.textAlign = 'left'; g.fillText(rel ? v.toFixed(0) : px(v), W - padR + 6, y);
    }
    g.textAlign = 'center'; g.fillStyle = text;
    const nl = W < 520 ? 3 : 4;
    for (let k = 0; k < nl; k++) { const i = Math.round(((n - 1) * (k + 0.1)) / (nl - 0.8)); g.fillText(fmtDate(bars.t[i]), Math.min(Math.max(X(i), 36), W - padR - 30), top + ph + 14); }

    if (on.sr && !rel) for (const l of ind.lv) {
      if (l.price < lo || l.price > hi) continue;
      g.setLineDash([2, 5]); g.strokeStyle = l.kind === 'support' ? up : down; g.globalAlpha = 0.45; g.beginPath(); g.moveTo(padL, Y(l.price)); g.lineTo(W - padR, Y(l.price)); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
    const poly = (arr: (number | null)[], color: string, w = 1.2, alpha = 1) => {
      g.strokeStyle = color; g.lineWidth = w; g.globalAlpha = alpha; g.beginPath(); let started = false;
      arr.forEach((v, i) => { if (v === null) return; const x = X(i), y = Y(v); if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y); });
      g.stroke(); g.lineWidth = 1; g.globalAlpha = 1;
    };
    if (!rel && on.s200) poly(ind.s200, '#c084fc', 1.1, 0.8);
    if (!rel && on.s50) poly(ind.s50, warn, 1.1, 0.8);

    if (mode === 'candles') {
      const bw = Math.max(1, Math.min(7, step * 0.62));
      for (let i = 0; i < n; i++) {
        const col = bars.c[i] >= bars.o[i] ? up : down;
        g.strokeStyle = col; g.fillStyle = col; g.globalAlpha = 0.9;
        g.beginPath(); g.moveTo(X(i), Y(bars.h[i])); g.lineTo(X(i), Y(bars.l[i])); g.stroke();
        const y1 = Y(bars.o[i]), y2 = Y(bars.c[i]);
        g.fillRect(X(i) - bw / 2, Math.min(y1, y2), bw, Math.max(1, Math.abs(y2 - y1)));
      }
      g.globalAlpha = 1;
    } else {
      poly(series, rel ? acc : text, 1.8);
      if (nser) poly(nser, warn, 1.4, 0.9);
    }

    // the key line: coloured by trend, with a faint wash between it and the close so the state reads at a glance
    if (!rel) {
      const kl = ind.kl;
      for (let i = 1; i < n; i++) {
        const a = kl.line[i - 1], b = kl.line[i];
        if (a === null || b === null) continue;
        const col = kl.dir[i] === 1 ? up : down;
        g.fillStyle = col; g.globalAlpha = 0.07;
        g.beginPath(); g.moveTo(X(i - 1), Y(a)); g.lineTo(X(i), Y(b)); g.lineTo(X(i), Y(bars.c[i])); g.lineTo(X(i - 1), Y(bars.c[i - 1])); g.closePath(); g.fill();
        g.globalAlpha = 1; g.strokeStyle = col; g.lineWidth = 2.2; g.beginPath();
        if (kl.dir[i] === kl.dir[i - 1]) { g.moveTo(X(i - 1), Y(a)); g.lineTo(X(i), Y(b)); }
        g.stroke(); g.lineWidth = 1;
      }
    }

    if (on.plan && !rel) for (const p of plans) {
      const o = (v?: number) => (typeof v === 'number' ? ` · ${v.toFixed(0)}% reached` : '');
      const marks: [number, string, string][] = [[p.sl, down, `Stop${o(p.odds?.stopped).replace('reached', 'stopped')}`], [p.entry, text, 'Entry'], ...p.targets.map((t, i): [number, string, string] => [t, up, `T${i + 1}${o(p.odds?.t[i])}`])];
      for (const [v, col, lab] of marks) {
        g.setLineDash([5, 4]); g.strokeStyle = col; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(padL, Y(v)); g.lineTo(W - padR, Y(v)); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
        g.fillStyle = col; g.textAlign = 'left'; g.fillText(`${lab} ${p.label}`, padL + 6, Y(v) - 7);
      }
    }

    const last = rel ? series[n - 1] : bars.c[n - 1], lastY = Y(last);
    const klDir = ind.kl.dir[n - 1];
    g.fillStyle = rel ? acc : klDir === 1 ? up : klDir === -1 ? down : text; g.fillRect(W - padR, lastY - 9, padR - 2, 18);
    g.fillStyle = '#04110b'; g.textAlign = 'left'; g.fillText(rel ? last.toFixed(0) : px(last), W - padR + 4, lastY);

    let yOff = top + ph + 24;
    if (on.vol && !rel) {
      const vh = 34, vmax = Math.max(...bars.v, 1);
      for (let i = 0; i < n; i++) { g.fillStyle = bars.c[i] >= bars.o[i] ? `${up}77` : `${down}77`; const h = (bars.v[i] / vmax) * vh; g.fillRect(X(i) - Math.max(0.5, step * 0.3), yOff + vh - h, Math.max(1, step * 0.6), h); }
      yOff += vh + 18;
    }
    if (on.rsi) {
      const rh = 52;
      g.strokeStyle = grid; for (const lv of [30, 70]) { const y = yOff + rh - (lv / 100) * rh; g.beginPath(); g.moveTo(padL, y); g.lineTo(W - padR, y); g.stroke(); g.fillStyle = text; g.textAlign = 'left'; g.fillText(String(lv), W - padR + 6, y); }
      g.strokeStyle = acc; g.lineWidth = 1.3; g.beginPath(); let st = false;
      ind.rsi.forEach((v, i) => { if (v === null) return; const y = yOff + rh - (v / 100) * rh; if (!st) { g.moveTo(X(i), y); st = true; } else g.lineTo(X(i), y); });
      g.stroke(); g.lineWidth = 1; g.fillStyle = text; g.textAlign = 'left'; g.fillText('RSI 14', padL + 2, yOff - 4);
    }
    if (hover !== null && hover >= 0 && hover < n) {
      g.strokeStyle = text; g.globalAlpha = 0.5; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(hover), top); g.lineTo(X(hover), top + ph); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    }
  }, [bars, ind, mode, on, plans, hover, tick]);

  const onMove = (e: React.PointerEvent) => {
    const c = cv.current;
    if (!c || !bars) return;
    const r = c.getBoundingClientRect();
    const n = bars.c.length, pw = r.width - 6 - 58;
    setHover(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left - 6) / pw) * n))));
  };

  const n = bars?.c.length ?? 0;
  const i = hover ?? (n ? n - 1 : 0);
  const kl = ind?.kl;
  const dirNow = kl && n ? kl.dir[n - 1] : 0;
  const klNow = kl && n ? kl.line[n - 1] : null;
  const state = bars && kl && klNow !== null && dirNow !== 0 ? (() => {
    const last = bars.c[n - 1], dist = (last / klNow - 1) * 100;
    const since = kl.since, days = n - since, from = bars.c[Math.max(0, since - 1)];
    return { up: dirNow === 1, klNow, dist, days, move: (last / from - 1) * 100, since: fmtDate(bars.t[since]) };
  })() : null;
  const chg = bars && i > 0 ? (bars.c[i] / bars.c[i - 1] - 1) * 100 : null;
  const overall = bars ? (bars.c[n - 1] / bars.c[0] - 1) * 100 : null;
  const nOverall = bars ? (() => { const f = bars.nifty.find((v) => v !== null), l = [...bars.nifty].reverse().find((v) => v !== null); return f && l ? (l / f - 1) * 100 : null; })() : null;
  const unit = data?.interval === '1wk' ? 'weeks' : 'sessions';
  // If the stock listed after the start of the chosen range, say so: "over 1Y" would be a claim about a year that did not exist.
  const spanDays = bars ? (bars.t[n - 1] - bars.t[0]) / 86400 : 0;
  const nominal = { '3mo': 91, '6mo': 182, '1y': 365, '2y': 730, '5y': 1826 }[range];
  const spanLabel = spanDays < nominal * 0.9 ? `since its first price on file (${spanDays >= 60 ? `${Math.round(spanDays / 30.4)} months` : `${Math.round(spanDays)} days`}, listed after the start of this range)` : `over ${RLABEL[range]}`;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ minHeight: 52 }}>
          {state ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className={`tag ${state.up ? 'up' : 'down'}`} style={{ fontSize: 14, padding: '5px 12px' }}>{state.up ? '▲ UPTREND' : '▼ DOWNTREND'}</span>
                <span className="muted" style={{ fontSize: 15 }}>{state.days} {unit} since {state.since}, <b className={state.move >= 0 ? 'up' : 'down'}>{state.move >= 0 ? '+' : ''}{state.move.toFixed(1)}%</b></span>
              </div>
              <div className="dim num" style={{ fontSize: 13.5, marginTop: 6 }}>
                Key line ₹{px(state.klNow)} · price is {Math.abs(state.dist).toFixed(1)}% {state.up ? 'above' : 'below'} it · a close {state.up ? 'below' : 'above'} flips the trend
              </div>
            </>
          ) : <span className="dim">{err ? 'Price history unavailable' : bars ? 'Not enough history for a trend read' : 'Loading prices…'}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', position: 'relative' }}>
          <Segmented role="group" label="Range" value={range} onChange={setRange} options={RANGES.map((r) => [r, RLABEL[r]] as const)} />
          <Segmented role="group" label="Chart type" value={mode} onChange={setMode} options={[['candles', 'Candles'], ['line', 'Line'], ['rel', 'vs Nifty']] as const} />
          <button className="chip" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>Indicators ▾</button>
          {menu && (
            <div role="menu" style={{ position: 'absolute', right: 0, top: 46, zIndex: 30, padding: 8, background: 'var(--panel)', border: '1px solid var(--line-2)', borderRadius: 14, boxShadow: 'var(--shadow)', minWidth: 190 }}>
              {INDICATORS.map(([k, l]) => (
                <div key={k} style={{ padding: '8px 10px' }}><Switch label={l} checked={on[k]} disabled={k === 'plan' && plans.length === 0} onChange={(v) => setOn((o) => ({ ...o, [k]: v }))} /></div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="num" style={{ fontSize: 13.5, minHeight: 20, marginBottom: 4, color: 'var(--muted)' }}>
        {bars && <><b style={{ color: 'var(--text)' }}>{fmtDate(bars.t[i])}</b> · O {px(bars.o[i])} H {px(bars.h[i])} L {px(bars.l[i])} C <b style={{ color: 'var(--text)' }}>{px(bars.c[i])}</b>{chg !== null && <span className={chg >= 0 ? 'up' : 'down'}> {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</span>}{kl && kl.dir[i] !== 0 && <span className={kl.dir[i] === 1 ? 'up' : 'down'}> · {kl.dir[i] === 1 ? 'uptrend' : 'downtrend'}</span>}</>}
      </div>
      <div ref={wrap} style={{ position: 'relative', minHeight: 300 }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <canvas ref={cv} role="img" aria-label={`Price chart for ${sym}`} style={{ display: 'block', touchAction: 'pan-y' }} />
        {err && <p className="dim" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', margin: 0 }}>Could not load {sym} history ({err}).</p>}
        {data && !data.ok && <p className="dim" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', margin: 0 }}>{data.error ?? 'No price history for this symbol.'}</p>}
      </div>
      <p className="dim" style={{ fontSize: 13, margin: '8px 0 0' }}>
        {overall !== null && nOverall !== null && <><b className={overall >= 0 ? 'up' : 'down'}>{overall >= 0 ? '+' : ''}{overall.toFixed(1)}%</b> {spanLabel} against the Nifty&apos;s {nOverall >= 0 ? '+' : ''}{nOverall.toFixed(1)}%. </>}
        The key line is a 3-ATR trailing line: it trails price and flips on a close through it. It reads the trend; it does not predict it. Yahoo prices, cached up to 15 minutes.
      </p>
    </div>
  );
}
