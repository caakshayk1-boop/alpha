'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DataStamp } from '@/components/DataStamp';
import { Async, Bar, Chg, PageHead, Rv, SectionHead, Segmented, Switch } from '@/components/ui';
import { useFeed, useRotation } from '@/lib/data';
import { dash, num } from '@/lib/format';
import type { Row } from '@/lib/types';

type Quad = 'Leading' | 'Weakening' | 'Lagging' | 'Improving';
const QC: Record<Quad, string> = { Leading: 'var(--up)', Improving: 'var(--accent-2)', Weakening: 'var(--warn)', Lagging: 'var(--down)' };
const QNOTE: Record<Quad, string> = { Leading: 'Strong and still gaining', Improving: 'Weak but turning up', Weakening: 'Strong but fading', Lagging: 'Weak and still falling' };
const short = (n: string) => n.replace(' (alpha group index)', '').replace('Fast Moving Consumer Goods', 'FMCG').replace('Consumer ', 'Cons. ').replace('Communication Services', 'Comms').replace('Financial Services', 'Financials').replace('Automobile and Auto Components', 'Autos').replace('Media Entertainment & Publication', 'Media').replace('Oil Gas & Consumable Fuels', 'Oil & Gas').replace('Information Technology', 'IT');
const SECTORS = new Set(['Industrials', 'Consumer Cyclical', 'Basic Materials', 'Financial Services', 'Healthcare', 'Technology', 'Consumer Defensive', 'Utilities', 'Energy', 'Real Estate', 'Communication Services']);
const quad = (r: number, m: number): Quad => (r >= 100 ? (m >= 100 ? 'Leading' : 'Weakening') : m >= 100 ? 'Improving' : 'Lagging');
const sma = (a: number[], i: number, n: number) => { let s = 0; for (let k = i - n + 1; k <= i; k++) s += a[k]; return s / n; };

interface Series { name: string; ratio: (number | null)[]; mom: (number | null)[]; rs: (number | null)[]; ret4: number | null; ret13: number | null; close: (number | null)[]; members: string[]; real: boolean }

export default function RotationPage() {
  const rot = useRotation();
  const scr = useFeed('screen');
  const [end, setEnd] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [allTails, setAllTails] = useState(false);
  const [play, setPlay] = useState(false);
  const [scope, setScope] = useState<'all' | 'index' | 'ind' | 'sec'>('all');
  const [tail, setTail] = useState(8);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const m = window.matchMedia('(max-width: 760px)'); const f = () => setNarrow(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);

  const S = useMemo<Series[]>(() => {
    const d = rot.data;
    if (!d) return [];
    const nf = d.nifty, n = nf.length;
    return Object.entries(d.groups).map(([name, g]) => {
      const rs: (number | null)[] = g.close.map((v, i) => (v === null ? null : v / nf[i]));
      const rsv = rs.map((v) => v ?? 0);
      const ratio: (number | null)[] = Array(n).fill(null), mom: (number | null)[] = Array(n).fill(null);
      for (let i = 12; i < n; i++) if (rs.slice(i - 12, i + 1).every((v) => v !== null)) ratio[i] = (100 * rsv[i]) / sma(rsv, i, 13);
      const sm3 = (i: number) => { const v = [ratio[i], ratio[i - 1], ratio[i - 2]]; return v.every((x) => x !== null) ? (v as number[]).reduce((q, x) => q + x, 0) / 3 : null; };
      for (let i = 18; i < n; i++) { const a = sm3(i), b = sm3(i - 4); if (a !== null && b !== null) mom[i] = 100 + (a - b); }
      const c = g.close, last = c[n - 1], r = (k: number) => (last !== null && c[n - 1 - k] ? (last / (c[n - 1 - k] as number) - 1) * 100 - (nf[n - 1] / nf[n - 1 - k] - 1) * 100 : null);
      return { name, ratio, mom, rs, ret4: r(4), ret13: r(13), close: g.close, members: g.members, real: g.real_index };
    }).filter((s) => s.ratio[n - 1] !== null && s.mom[n - 1] !== null && (s.real || s.members.length >= 6));
  }, [rot.data]);

  const n = rot.data?.nifty.length ?? 0;
  const t = end ?? n - 1;
  const minT = 22;

  useEffect(() => {
    if (!play) return;
    const id = window.setInterval(() => setEnd((e) => { const cur = e ?? n - 1; if (cur >= n - 1) { setPlay(false); return n - 1; } return cur + 1; }), 450);
    return () => window.clearInterval(id);
  }, [play, n]);
  useEffect(() => { if (sel) setPlay(false); }, [sel]);   // choosing a group to inspect stops the playback

  const rows = useMemo(() => {
    const bySym = new Map<string, Row>((scr.data?.rows ?? []).map((r) => [r.sym, r]));
    return S.map((s) => {
      const r = s.ratio[t] as number | null, m = s.mom[t] as number | null;
      if (r === null || m === null) return null;
      const mem = s.members.map((x) => bySym.get(x)).filter((x): x is Row => !!x);
      const with200 = mem.filter((x) => typeof x.price === 'number' && typeof x.sma200 === 'number');
      const breadth = with200.length ? (with200.filter((x) => (x.price as number) > (x.sma200 as number)).length / with200.length) * 100 : null;
      // transitions: quadrant 4 weeks ago vs now
      const pr = s.ratio[t - 4], pm = s.mom[t - 4];
      const was = pr !== null && pm !== null && pr !== undefined && pm !== undefined ? quad(pr, pm) : null;
      // relative return over k weeks AS OF the selected week, not the latest one
      const nf = rot.data?.nifty ?? [];
      const rel = (k: number) => { const a = s.close[t], b = s.close[t - k]; return a != null && b ? ((a / b - 1) - (nf[t] / nf[t - k] - 1)) * 100 : null; };
      return { s, r, m, q: quad(r, m), breadth, mem, was, ret4t: rel(4), ret13t: rel(13) };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [S, t, scr.data, rot.data]);

  const shown = useMemo(() => rows.filter((x) => scope === 'all' || (scope === 'index' ? x.s.real : scope === 'ind' ? !x.s.real && x.s.name.includes('(alpha group index)') && !SECTORS.has(x.s.name.replace(' (alpha group index)', '')) : !x.s.real && SECTORS.has(x.s.name.replace(' (alpha group index)', '')))), [rows, scope]);
  const hist = useMemo(() => {
    const out: Record<Quad, number>[] = [];
    for (let i = 0; i < n; i++) {
      const c: Record<Quad, number> = { Leading: 0, Improving: 0, Weakening: 0, Lagging: 0 };
      for (const x of S) { const r = x.ratio[i], m2 = x.mom[i]; if (r !== null && m2 !== null && r !== undefined && m2 !== undefined) c[quad(r, m2)]++; }
      out.push(c);
    }
    return out;
  }, [S, n]);
  const order: Quad[] = ['Improving', 'Leading', 'Weakening', 'Lagging'];
  const table = useMemo(() => [...rows].sort((a, b) => order.indexOf(a.q) - order.indexOf(b.q) || b.r - a.r), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = rows.find((x) => x.s.name === sel) ?? null;

  // chart geometry
  const W = narrow ? 400 : 760, H = narrow ? 470 : 520, pad = narrow ? 30 : 46;
  const ext = useMemo(() => {
    const d: number[] = [];
    for (const x of rows) for (let k = Math.max(0, t - tail); k <= t; k++) { const r = x.s.ratio[k], m = x.s.mom[k]; if (r !== null && m !== null) d.push(Math.abs(r - 100), Math.abs(m - 100)); }
    d.sort((a, b) => a - b);
    const q = d.length ? d[Math.floor(d.length * 0.92)] : 4;
    return Math.max(4, Math.ceil(q * 1.2));
  }, [rows, t, tail]);
  const cl = (v: number) => Math.max(-ext * 0.97, Math.min(ext * 0.97, v - 100));
  const X = (v: number) => pad + ((cl(v) + ext) / (2 * ext)) * (W - 2 * pad), Y = (v: number) => H - pad - ((cl(v) + ext) / (2 * ext)) * (H - 2 * pad);
  const labels = useMemo(() => {
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const out = new Map<string, { x: number; y: number; anchor: 'start' | 'end' } | null>();
    const order = [...shown].sort((a, b) => (sel === a.s.name ? -1 : sel === b.s.name ? 1 : 0) || Math.hypot(b.r - 100, b.m - 100) - Math.hypot(a.r - 100, a.m - 100));
    for (const x of order) {
      const px = X(x.r), py = Y(x.m), w = short(x.s.name).length * 6.3 + 6, h = 13;
      const spots: [number, number, 'start' | 'end'][] = [[px + 11, py + 4, 'start'], [px - 11, py + 4, 'end'], [px + 11, py - 11, 'start'], [px - 11, py - 11, 'end'], [px + 11, py + 18, 'start'], [px - 11, py + 18, 'end']];
      let hit: { x: number; y: number; anchor: 'start' | 'end' } | null = null;
      for (const [lx, ly, anchor] of spots) {
        const box = { x: anchor === 'start' ? lx : lx - w, y: ly - 10, w, h };
        const clash = placed.some((b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y) || box.x < 2 || box.x + box.w > W - 2;
        if (!clash) { placed.push(box); hit = { x: lx, y: ly, anchor }; break; }
      }
      out.set(x.s.name, hit);
    }
    return out;
  }, [shown, ext, sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const read = useMemo(() => {
    if (!rows.length) return null;
    const by = (q: Quad) => rows.filter((x) => x.q === q);
    const moved = rows.filter((x) => x.was && x.was !== x.q).sort((a, b) => Math.hypot(b.r - 100, b.m - 100) - Math.hypot(a.r - 100, a.m - 100));
    const best = [...by('Improving')].sort((a, b) => b.m - a.m)[0];
    const lead = [...by('Leading')].sort((a, b) => b.r - a.r)[0];
    const fade = [...by('Weakening')].sort((a, b) => a.m - b.m)[0];
    return { by, moved, best, lead, fade };
  }, [rows]);

  const date = rot.data?.dates[t];
  const past = n > 0 && t < n - 1;     // a historical week is selected
  return (
    <>
      <PageHead eyebrow="Rotation" title="How sector strength" em="is changing." lede="A Relative Rotation Graph for every benchmark group: how strong each is against the Nifty, and whether that strength is rising or fading. It measures relative prices, not money flows. Groups often pass through Improving, Leading, Weakening and Lagging, but not in a fixed order or at a fixed speed. Drag the time machine back to see past weeks." />
      <section className="wrap" style={{ paddingTop: 0 }}><DataStamp ids={['rotation', 'screen']} /><p className="notice" style={{ marginTop: 10 }}><b>Index identity:</b> only Nifty IT, Pharma and Bank are NSE indices; every other group is an Alpha equal-weighted index. <details style={{ display: 'inline' }}><summary style={{ display: 'inline', cursor: 'pointer', color: 'var(--accent-2)' }}>Why</summary> Yahoo holds no history for the other NSE sector indices, so Alpha builds each group from its own screened stocks. Each is labelled &ldquo;NSE index&rdquo; or &ldquo;Alpha group index&rdquo; below.</details></p></section>
      <section className="wrap">
        <Async loading={rot.loading || scr.loading} error={rot.error ?? scr.error} rows={3}>
          {read && rot.data && (
            <>
              <Rv className="panel spot" style={{ marginBottom: 14 }}>
                <div className="eyebrow">Rotation read · calculated from the group indices · week ending {date}</div>
                <p className="disp" style={{ fontSize: 26, lineHeight: 1.25, margin: '10px 0 8px' }}>
                  {read.by('Leading').length} groups leading, {read.by('Improving').length} improving, {read.by('Weakening').length} weakening, {read.by('Lagging').length} lagging.
                </p>
                <ul className="muted" style={{ paddingLeft: 18, lineHeight: 1.7, margin: 0 }}>
                  {read.lead && <li><b style={{ color: 'var(--up)' }}>{short(read.lead.s.name)}</b> is the strongest leader (RS-Ratio {read.lead.r.toFixed(1)}); {read.lead.breadth !== null ? `${read.lead.breadth.toFixed(0)}% of its stocks are above their 200-day.` : ''}</li>}
                  {read.best && <li><b style={{ color: 'var(--accent-2)' }}>{short(read.best.s.name)}</b> has the fastest-rising momentum among groups still below the market line ({read.best.m.toFixed(1)}): a relative-momentum observation only: moving toward the market line is not a confirmed reversal.</li>}
                  {read.fade && <li><b style={{ color: 'var(--warn)' }}>{short(read.fade.s.name)}</b> is still ahead of the market but losing momentum fastest ({read.fade.m.toFixed(1)}): the one to watch for a handover.</li>}
                  {read.moved.length > 0 && <li>Changed phase in the last 4 weeks: {read.moved.slice(0, 5).map((x) => `${short(x.s.name)} (${x.was} → ${x.q})`).join(', ')}{read.moved.length > 5 ? ` and ${read.moved.length - 5} more` : ''}.</li>}
                </ul>
              </Rv>

              <div className="grid g-7-5" style={{ alignItems: 'start' }}>
                <div style={{ display: 'grid', gap: 14 }}>
                  <Rv className="panel">
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <Segmented role="group" label="Scope" value={scope} onChange={setScope} options={[['all', 'All groups'], ['index', 'NSE indices'], ['ind', 'Industries'], ['sec', 'Sectors']] as const} />
                      <Segmented role="group" label="Tail length" value={String(tail)} onChange={(v) => setTail(Number(v))} options={[['4', '4w tail'], ['8', '8w'], ['12', '12w']] as const} />
                    </div>
                    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Relative rotation graph" style={{ width: '100%', height: 'auto', display: 'block' }}>
                      <defs>
                        <radialGradient id="gL" cx="100%" cy="0%" r="110%"><stop offset="0" stopColor="var(--up)" stopOpacity=".32" /><stop offset="1" stopColor="var(--up)" stopOpacity=".03" /></radialGradient>
                        <radialGradient id="gI" cx="0%" cy="0%" r="110%"><stop offset="0" stopColor="var(--accent)" stopOpacity=".3" /><stop offset="1" stopColor="var(--accent)" stopOpacity=".03" /></radialGradient>
                        <radialGradient id="gG" cx="0%" cy="100%" r="110%"><stop offset="0" stopColor="var(--down)" stopOpacity=".3" /><stop offset="1" stopColor="var(--down)" stopOpacity=".03" /></radialGradient>
                        <radialGradient id="gW" cx="100%" cy="100%" r="110%"><stop offset="0" stopColor="var(--warn)" stopOpacity=".3" /><stop offset="1" stopColor="var(--warn)" stopOpacity=".03" /></radialGradient>
                        <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="var(--accent-2)" stopOpacity="0" /><stop offset="1" stopColor="var(--accent-2)" stopOpacity=".45" /></linearGradient>
                      </defs>
                      <rect x={X(100)} y={pad} width={W - pad - X(100)} height={Y(100) - pad} fill="url(#gL)" rx="6" />
                      <rect x={pad} y={pad} width={X(100) - pad} height={Y(100) - pad} fill="url(#gI)" rx="6" />
                      <rect x={pad} y={Y(100)} width={X(100) - pad} height={H - pad - Y(100)} fill="url(#gG)" rx="6" />
                      <rect x={X(100)} y={Y(100)} width={W - pad - X(100)} height={H - pad - Y(100)} fill="url(#gW)" rx="6" />
                      {[0.25, 0.5, 0.75].map((f) => <g key={f} stroke="var(--line)" strokeDasharray="2 6"><line x1={pad + f * (W - 2 * pad)} x2={pad + f * (W - 2 * pad)} y1={pad} y2={H - pad} /><line x1={pad} x2={W - pad} y1={pad + f * (H - 2 * pad)} y2={pad + f * (H - 2 * pad)} /></g>)}
                      <g className="radar" style={{ transformOrigin: `${X(100)}px ${Y(100)}px` }} aria-hidden><path d={`M${X(100)},${Y(100)} L${X(100) + (W - 2 * pad) / 2},${Y(100)} A${(W - 2 * pad) / 2},${(W - 2 * pad) / 2} 0 0 1 ${X(100) + Math.cos(0.5) * (W - 2 * pad) / 2},${Y(100) + Math.sin(0.5) * (W - 2 * pad) / 2} Z`} fill="url(#sweep)" opacity=".5" /></g>
                      <line x1={X(100)} x2={X(100)} y1={pad} y2={H - pad} stroke="var(--line-2)" /><line x1={pad} x2={W - pad} y1={Y(100)} y2={Y(100)} stroke="var(--line-2)" />
                      {([['Improving', pad + 12, pad + 22, 'start'], ['Leading', W - pad - 12, pad + 22, 'end'], ['Lagging', pad + 12, H - pad - 12, 'start'], ['Weakening', W - pad - 12, H - pad - 12, 'end']] as const).map(([q, x, y, a]) => <text key={q} x={x} y={y} textAnchor={a} fill={QC[q]} opacity=".9" fontSize="12" fontFamily="var(--f-mono)" letterSpacing="2">{q.toUpperCase()}</text>)}
                      <text x={W / 2} y={H - 12} textAnchor="middle" fill="var(--dim)" fontSize="11" fontFamily="var(--f-mono)">RS-RATIO: STRENGTH VS THE NIFTY →</text>
                      <text x={14} y={H / 2} textAnchor="middle" fill="var(--dim)" fontSize="11" fontFamily="var(--f-mono)" transform={`rotate(-90 14 ${H / 2})`}>RS-MOMENTUM: IS IT RISING →</text>
                      {shown.map((x) => {
                        const show = allTails || sel === x.s.name;
                        const pts: [number, number][] = [];
                        for (let k = Math.max(0, t - tail); k <= t; k++) { const r = x.s.ratio[k], m = x.s.mom[k]; if (r !== null && m !== null) pts.push([X(r), Y(m)]); }
                        const c = QC[x.q], active = sel === null || sel === x.s.name, hot = sel === x.s.name;
                        const l = labels.get(x.s.name);
                        return (
                          <g key={x.s.name} className={`rrg-dot${hot ? ' hot' : ''}`} opacity={active ? 1 : 0.25} style={{ cursor: 'pointer', transform: `translate(${X(x.r)}px, ${Y(x.m)}px)` }} onClick={() => setSel(sel === x.s.name ? null : x.s.name)}>
                            <title>{`${short(x.s.name)}: ${x.q}, RS-Ratio ${x.r.toFixed(1)}, momentum ${x.m.toFixed(1)}`}</title>
                            {show && pts.length > 1 && <g style={{ transform: `translate(${-X(x.r)}px, ${-Y(x.m)}px)` }}><path key={`${x.s.name}${hot}${tail}`} className="rrg-tail" pathLength={1} d={pts.map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)},${q[1].toFixed(1)}`).join('')} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".8" />{pts.slice(0, -1).map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r={1.6 + (i / pts.length) * 2.4} fill={c} opacity={0.25 + (i / pts.length) * 0.6} />)}</g>}
                            {(x.q === 'Leading' || hot) && <circle className="pulse" r={hot ? 15 : 12} fill="none" stroke={c} strokeWidth="1.5" />}
                            <circle r={hot ? 9 : 7} fill={c} stroke="var(--bg)" strokeWidth="2" style={{ filter: `drop-shadow(0 0 ${hot ? 9 : 5}px ${c})` }} />
                            {l && <text x={l.x - X(x.r)} y={l.y - Y(x.m)} textAnchor={l.anchor} fontSize="11.5" fill="var(--text)" fontWeight={hot ? 700 : 500} style={{ paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 3 }}>{short(x.s.name)}</text>}
                          </g>
                        );
                      })}
                    </svg>
                    <div className="tm">
                      <div className="tm-top">
                        <div className="tm-btns" role="group" aria-label="Time machine">
                          <button className="chip" aria-label="Back one week" onClick={() => { setPlay(false); setEnd(Math.max(minT, t - 1)); }}>◀</button>
                          <button className="chip" onClick={() => { if (t >= n - 1) setEnd(minT); setPlay((p) => !p); }}>{play ? '❚❚ Pause' : '▶ Play'}</button>
                          <button className="chip" aria-label="Forward one week" onClick={() => { setPlay(false); setEnd(Math.min(n - 1, t + 1)); }}>▶</button>
                        </div>
                        <div className="tm-jumps" role="group" aria-label="Jump to">
                          {([['1 month ago', 4], ['3 months ago', 13], ['6 months ago', 26], ['Now', 0]] as const).map(([l, w]) => <button key={l} className="chip" aria-pressed={t === n - 1 - w} onClick={() => { setPlay(false); setEnd(w === 0 ? null : Math.max(minT, n - 1 - w)); }}>{l}</button>)}
                        </div>
                        <span className="num tm-date">{date}{t < n - 1 ? ` · ${n - 1 - t}w ago` : ' · now'}</span>
                        <Switch label="All tails" checked={allTails} onChange={setAllTails} />
                      </div>
                      <PhaseTimeline hist={hist} cur={cur} minT={minT} n={n} t={t} dates={rot.data.dates} onScrub={(i) => { setPlay(false); setEnd(i >= n - 1 ? null : i); }} />
                    </div>
                  </Rv>
                  <div className="phase-cards">
                    {order.map((q) => (
                      <Rv key={q} className="panel tight spot tilt">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span className="eyebrow" style={{ color: QC[q] }}>{q}</span><span className="num dim">{read.by(q).length}</span></div>
                        <div className="dim" style={{ fontSize: 12, margin: '4px 0 10px' }}>{QNOTE[q]}</div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{[...read.by(q)].sort((a, b) => b.r - a.r).map((x) => <button key={x.s.name} className="chip" aria-pressed={sel === x.s.name} onClick={() => setSel(sel === x.s.name ? null : x.s.name)}>{short(x.s.name)}</button>)}</div>
                      </Rv>
                    ))}
                  </div>
                </div>

                <Rv className="panel" style={{ position: 'sticky', top: 84 }}>
                  <div className="eyebrow">{cur ? short(cur.s.name) : 'Click a group'}</div>
                  {cur ? (
                    <>
                      <p className="dim num" style={{ margin: '4px 0 0', fontSize: 12 }}>Week ending {date}{past ? ` · phase and relative returns are as of this week; breadth and members below are today's, from the latest screen (${rot.data.dates[n - 1]}), not reconstructed for this week` : ''}</p>
                      <p style={{ margin: '8px 0' }}><span className="tag" style={{ color: QC[cur.q] }}>{cur.q}</span> <span className="muted" style={{ fontSize: 13 }}>{QNOTE[cur.q]}</span></p>
                      <RsLine s={cur.s} t={t} dates={rot.data.dates} />
                      <div className="kv" style={{ gridTemplateColumns: '1fr 1fr', margin: '12px 0' }}>
                        <div><div className="k">4-week vs Nifty</div><div className="v"><Chg v={cur.ret4t} dp={1} /></div></div>
                        <div><div className="k">13-week vs Nifty</div><div className="v"><Chg v={cur.ret13t} dp={1} /></div></div>
                        <div><div className="k">Above 200-day{past ? ' (today)' : ''}</div><div className="v">{cur.breadth !== null ? `${cur.breadth.toFixed(0)}%` : dash}</div></div>
                        <div><div className="k">Stocks</div><div className="v">{cur.mem.length}</div></div>
                      </div>
                      <div className="eyebrow" style={{ marginBottom: 6 }}>Strongest members (3-month strength{past ? ', as of today' : ''})</div>
                      <div className="list">{[...cur.mem].filter((x) => typeof x.rs3m === 'number').sort((a, b) => (b.rs3m as number) - (a.rs3m as number)).slice(0, 6).map((x) => (
                        <Link key={x.sym} href={`/company/?s=${encodeURIComponent(x.sym)}`} className="li"><div><div className="t">{x.sym}</div><div className="s">{x.name}</div></div><span className="num" style={{ fontSize: 13 }}>RS {Math.round(x.rs3m as number)} · <Chg v={x.r3m} dp={0} /></span></Link>
                      ))}</div>
                    </>
                  ) : <p className="muted" style={{ marginTop: 10 }}>Select any dot, phase chip or table row to see its tail, its strength line against the Nifty, its breadth and its strongest stocks. The current week is shown unless you move the time machine.</p>}
                </Rv>
              </div>

              <SectionHead title="Every group, by phase" />
              <div className="tbl-wrap" style={{ maxHeight: 'none' }}><table className="tbl" style={{ minWidth: 760 }}>
                <thead><tr><th>Group</th><th>Phase</th><th>RS-Ratio</th><th>RS-Momentum</th><th>4w vs Nifty</th><th>13w vs Nifty</th><th>Above 200-day{past ? ' (today)' : ''}</th><th>Stocks</th></tr></thead>
                <tbody>{table.map((x) => (
                  <tr key={x.s.name} onClick={() => setSel(x.s.name)} style={{ cursor: 'pointer', background: sel === x.s.name ? 'var(--accent-soft)' : undefined }}>
                    <td><b>{short(x.s.name)}</b>{x.s.real ? <span className="tag acc" style={{ marginLeft: 8 }}>NSE index</span> : <span className="tag" style={{ marginLeft: 8 }}>Alpha group index</span>}</td>
                    <td><span className="tag" style={{ color: QC[x.q] }}>{x.q}</span></td>
                    <td className="num">{x.r.toFixed(1)}</td><td className="num">{x.m.toFixed(1)}</td>
                    <td><Chg v={x.ret4t} dp={1} /></td><td><Chg v={x.ret13t} dp={1} /></td>
                    <td className="num">{x.breadth !== null ? <><Bar pct={x.breadth} kind={x.breadth >= 50 ? 'up' : 'down'} /> {x.breadth.toFixed(0)}%</> : dash}</td>
                    <td className="num">{num(x.mem.length)}</td>
                  </tr>))}</tbody>
              </table></div>
              <p className="dim" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
                Method: each group&apos;s weekly index level is divided by the Nifty to get relative strength. RS-Ratio is that strength against its own 13-week average (100 = in line); RS-Momentum is 100 plus the 4-week change in a 3-week average of RS-Ratio. Nifty IT, Nifty Pharma and Nifty Bank are the real NSE indices; every other group is an equal-weighted index of its industry (or sector) built from the screened stocks, because Yahoo holds no history for the other NSE sector indices. A close cousin of the RRG popularised by Julius de Kempenaer, not the licensed JdK formula. Rotation describes what has happened; a group can stay in a quadrant for months, and the tails turn late. It describes how prices moved relative to the Nifty, not where money went.
              </p>
            </>
          )}
        </Async>
      </section>
    </>
  );
}

function RsLine({ s, t, dates }: { s: Series; t: number; dates: string[] }) {
  const v = s.rs.slice(0, t + 1);
  const vals = v.filter((x): x is number => x !== null);
  if (vals.length < 10) return null;
  const base = vals[0], z = v.map((x) => (x === null ? null : (x / base) * 100));
  const lo = Math.min(...(z.filter((x) => x !== null) as number[])), hi = Math.max(...(z.filter((x) => x !== null) as number[]));
  const W = 320, H = 90, X = (i: number) => (i / (v.length - 1)) * (W - 6) + 3, Y = (x: number) => H - 6 - ((x - lo) / (hi - lo || 1)) * (H - 12);
  const d = z.map((x, i) => (x === null ? '' : `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(x).toFixed(1)}`)).join('');
  const up = (z[z.length - 1] ?? 100) >= 100;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Strength against the Nifty over time">
        <line x1="0" x2={W} y1={Y(100)} y2={Y(100)} stroke="var(--line-2)" strokeDasharray="3 4" />
        <path d={d} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="2" />
      </svg>
      <div className="dim num" style={{ fontSize: 11.5, display: 'flex', justifyContent: 'space-between' }}><span>{dates[0]}</span><span>strength vs Nifty, start = 100</span><span>{dates[t]}</span></div>
    </div>
  );
}

/** A scrubbable strip of every week: how many groups sat in each phase (stacked), with the selected group's own phase beneath. Drag it, click it, or use the arrow keys. */
function PhaseTimeline({ hist, cur, minT, n, t, dates, onScrub }: { hist: Record<Quad, number>[]; cur: { s: Series } | null; minT: number; n: number; t: number; dates: string[]; onScrub: (i: number) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef(false);
  const W = 720, H = 74, L = 4, R = 4, barH = 46;
  const span = n - minT;
  const X = (i: number) => L + ((i - minT) / (span - 1)) * (W - L - R);
  const bw = (W - L - R) / span;
  const at = (clientX: number) => { const r = ref.current!.getBoundingClientRect(); return Math.max(minT, Math.min(n - 1, Math.round(minT + ((clientX - r.left) / r.width * W - L) / (W - L - R) * (span - 1)))); };
  const months: number[] = [];
  for (let i = minT; i < n; i++) if (i === minT || dates[i].slice(5, 7) !== dates[i - 1].slice(5, 7)) months.push(i);
  return (
    <div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="tm-strip" tabIndex={0} role="slider" aria-label="Week" aria-valuemin={minT} aria-valuemax={n - 1} aria-valuenow={t} aria-valuetext={dates[t]}
        onPointerDown={(e) => { drag.current = true; (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId); onScrub(at(e.clientX)); }}
        onPointerMove={(e) => { if (drag.current) onScrub(at(e.clientX)); }}
        onPointerUp={() => { drag.current = false; }}
        onKeyDown={(e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); onScrub(Math.max(minT, t - 1)); } else if (e.key === 'ArrowRight') { e.preventDefault(); onScrub(Math.min(n - 1, t + 1)); } else if (e.key === 'Home') onScrub(minT); else if (e.key === 'End') onScrub(n - 1); }}>
        {hist.slice(minT).map((c, k) => {
          const i = minT + k, tot = (c.Leading + c.Improving + c.Weakening + c.Lagging) || 1;
          let y = 0;
          return <g key={i} opacity={i === t ? 1 : 0.72}>{(['Leading', 'Improving', 'Weakening', 'Lagging'] as Quad[]).map((q) => { const h = (c[q] / tot) * barH; const r = <rect key={q} x={X(i) - bw / 2 + 0.5} y={2 + y} width={Math.max(1, bw - 1)} height={h} fill={QC[q]} />; y += h; return r; })}</g>;
        })}
        {cur && Array.from({ length: span }, (_, k) => { const i = minT + k, r = cur.s.ratio[i], m = cur.s.mom[i]; return r !== null && m !== null && r !== undefined && m !== undefined ? <rect key={i} x={X(i) - bw / 2 + 0.5} y={52} width={Math.max(1, bw - 1)} height={9} rx="2" fill={QC[quad(r, m)]} /> : null; })}
        <line x1={X(t)} x2={X(t)} y1={0} y2={64} stroke="var(--text)" strokeWidth="1.5" />
        <circle cx={X(t)} cy={64} r="5" fill="var(--text)" stroke="var(--bg)" strokeWidth="2" />
        {months.map((i) => <text key={i} x={X(i)} y={H - 2} fontSize="9.5" fill="var(--dim)" fontFamily="var(--f-mono)">{new Date(dates[i]).toLocaleDateString('en-GB', { month: 'short' })}</text>)}
      </svg>
      <p className="dim" style={{ fontSize: 11.5, margin: '4px 0 0' }}>Each column is a week: how many groups were Leading (green), Improving, Weakening and Lagging. {cur ? `The strip under it is ${short(cur.s.name)}'s own phase.` : 'Select a group to see its own phase underneath.'} Drag across it, or focus it and use ← →.</p>
    </div>
  );
}
