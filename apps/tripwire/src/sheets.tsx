import { useEffect, useMemo, useState } from 'react';
import { go, setState, useAppState } from './app.tsx';
import { Sheet, Icon, useUi } from './ui.tsx';
import { useScreen, useSignals } from './data.ts';
import { sizePlan } from './planner.ts';
import { useEngines } from './useEngines.ts';
import { DEFAULT_COST, SLIPPAGE_PCT } from './tracker.ts';
import { addEntry, current, editEntry, savePlan, istDay } from './store.ts';
import { METRICS, glossarySearch, metric } from './metrics.ts';
import { inr, inr0, isNum, dayWord } from './fmt.ts';

const addDays = (d: string, n: number) => new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);

export function PlannerSheet({ onClose, sym: s0, entry: e0, stop: sl0 }: { onClose: () => void; sym?: string; entry?: number; stop?: number }) {
  const st = useAppState(); const scr = useScreen(); const sig = useSignals(); const { toast, tick } = useUi();
  const [sym, setSym] = useState(s0 ?? '');
  const row = scr.data?.rows.find((r) => r.sym === sym.toUpperCase());
  const eng = useEngines(); const pickNow = eng.out?.picks.find((p) => p.sym === sym.toUpperCase()) ?? null;
  const [entry, setEntry] = useState(e0 ? String(e0) : row?.price ? String(row.price) : '');
  const [stop, setStop] = useState(sl0 ? String(sl0) : '');
  const [touched, setTouched] = useState(!!e0);
  useEffect(() => { if (!touched && row?.price) setEntry(String(row.price)); }, [row?.price, touched]);   // the screen can arrive after the sheet opens
  const [risk, setRisk] = useState(String(st.prefs.riskPct)); const [maxp, setMaxp] = useState(String(st.prefs.maxPositionPct));
  const [expiry, setExpiry] = useState(''); const [note, setNote] = useState('');
  const cost = sig.data?.cost_round_trip_pct ?? DEFAULT_COST;
  const out = useMemo(() => sizePlan({ equity: st.prefs.equity, cash: st.prefs.cash, riskPct: Number(risk), entry: Number(entry), stop: Number(stop), maxPositionPct: Number(maxp), costRoundTripPct: cost, tradedValue: isNum(row?.turnover_cr) ? row!.turnover_cr! * 1e7 : null }), [st.prefs.equity, st.prefs.cash, risk, entry, stop, maxp, cost, row]);
  const have = entry !== '' && stop !== '';
  const BIND = { risk: 'your risk budget', cash: 'your cash', position: 'your position limit', liquidity: 'how thinly it trades' } as const;
  return <Sheet title="Paper plan" onClose={onClose}>
    {pickNow && <div className="note" style={{ marginBottom: 8 }}><b>Experimental engine.</b> {sym.toUpperCase()} is tonight's {pickNow.engine === 'MOM' ? 'Momentum' : 'Quality'} pick, from an engine that has not passed its tests. A plan sizes your risk; it does not make the idea sound.</div>}
    <label className="l" htmlFor="pl-s">Symbol</label>
    <input id="pl-s" className="field" value={sym} onChange={(e) => { setSym(e.target.value.toUpperCase()); setTouched(false); }} placeholder="e.g. TCS" autoCapitalize="characters" />
    <div className="row"><div className="grow"><label className="l" htmlFor="pl-e">Entry, ₹ (the price you assume you pay)</label><input id="pl-e" className="field num" inputMode="decimal" value={entry} onChange={(e) => { setTouched(true); setEntry(e.target.value); }} /></div>
      <div className="grow"><label className="l" htmlFor="pl-x">Stop, ₹ (invalidation)</label><input id="pl-x" className="field num" inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} /></div></div>
    <p className="small dim" style={{ margin: '6px 0 0' }}>It starts at the last close{row?.price ? ` (${inr(row.price)}, ${dayWord(row.last_date)})` : ''}. Nobody buys at a past close: the paper tracker fills at the NEXT open plus {SLIPPAGE_PCT}% slippage, and skips the trade if that open is more than 2% above the signal close. Type the price you expect to pay if it differs.</p>
    {row && isNum(row.sma50) && <button className="chip" style={{ marginTop: 8 }} onClick={() => setStop(String(Math.round(row.sma50! * 100) / 100))}>Use the 50-day average ({inr(row.sma50)}) as my stop</button>}
    <div className="row"><div className="grow"><label className="l" htmlFor="pl-r">Risk, % of equity</label><input id="pl-r" className="field num" inputMode="decimal" value={risk} onChange={(e) => setRisk(e.target.value)} /></div>
      <div className="grow"><label className="l" htmlFor="pl-m">Largest position, %</label><input id="pl-m" className="field num" inputMode="decimal" value={maxp} onChange={(e) => setMaxp(e.target.value)} /></div></div>
    <div className="small dim" style={{ marginTop: 8 }}>Hypothetical equity {inr0(st.prefs.equity)}, cash {inr0(st.prefs.cash)}. Costs assumed at {cost}% a round trip. Change defaults in Profile.</div>
    {have && !out.ok && <div className="note" style={{ marginTop: 12 }} role="alert">{out.error}</div>}
    {have && out.ok && <div className="card glass" style={{ marginTop: 12 }}>
      <div className="row between"><div><div className="k">Quantity</div><div className="num" style={{ font: '600 1.75rem/1.1 var(--sans)' }}>{out.qty}</div></div><div style={{ textAlign: 'right' }}><div className="k">Capital</div><div className="num" style={{ fontSize: '1.25rem', fontWeight: 650 }}>{inr0(out.capital)}</div></div></div>
      <p className="small dim" style={{ margin: '8px 0' }}>Sized by {BIND[out.binding]}. Caps: risk {out.caps.risk} · cash {out.caps.cash} · position {out.caps.position} · liquidity {out.caps.liquidity ?? 'unknown'}.</p>
      <div className="num small">Planned risk <b>{inr0(out.risk)}</b> ({inr(out.riskPerShare)} a share) · costs about <b>{inr0(out.costs)}</b></div>
      <table className="tbl" style={{ marginTop: 8 }}><thead><tr><th>If it reaches</th><th>Price</th><th>After costs</th></tr></thead><tbody>{out.targets.map((t) => <tr key={t.r}><td>+{t.r}R</td><td className="num">{inr(t.price)}</td><td className="num up">{inr0(t.net)}</td></tr>)}</tbody></table>
      {(() => { const hi = sizePlan({ equity: st.prefs.equity, cash: st.prefs.cash, riskPct: Number(risk), entry: Number(entry) * 1.02, stop: Number(stop), maxPositionPct: Number(maxp), costRoundTripPct: cost }); return hi.ok ? <p className="small dim" style={{ margin: '8px 0 0' }}>If it opens 2% higher (the most the tracker will accept), the same {out.qty} shares risk about <b>{inr0(out.qty * (Number(entry) * 1.02 - Number(stop)))}</b> to the stop, not {inr0(out.risk)}.</p> : null; })()}
      <p className="small down" style={{ margin: '10px 0 0' }}>{out.limits.join(' ')} Targets are conditional outcomes on the engine’s plan, not predictions.</p>
    </div>}
    <label className="l" htmlFor="pl-d">Expires (optional)</label><input id="pl-d" className="field" type="date" min={istDay()} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
    <label className="l" htmlFor="pl-n">Note</label><textarea id="pl-n" className="field" maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} />
    <div className="row" style={{ marginTop: 14 }}>
      <button className="btn pri grow" disabled={!sym || !out.ok} onClick={() => { if (!out.ok) return; setState((x) => savePlan(x, { sym, entry: Number(entry), stop: Number(stop), qty: out.qty, riskPct: Number(risk), expiry: expiry || null, note })); tick(); toast('Plan saved. It is not a fill.'); onClose(); go('/desk?v=plans'); }}>Save plan</button></div>
    <p className="mute small">A saved plan is a calculation. It is not an order, a paper fill or a holding.</p>
  </Sheet>;
}

export function ThesisSheet({ onClose, sym, id }: { onClose: () => void; sym: string; id?: string }) {
  const st = useAppState(); const { toast, tick } = useUi();
  const e = id ? st.entries.find((x) => x.id === id) : undefined; const c = e ? current(e) : undefined;
  const [f, setF] = useState({ thesis: c?.thesis ?? '', support: c?.support ?? '', counter: c?.counter ?? '', decision: c?.decision ?? '', invalidation: c?.invalidation ?? '', trigger: c?.trigger ?? '', reviewOn: c?.reviewOn ?? addDays(istDay(), 30) });
  const [hist, setHist] = useState(false);
  const F = (k: keyof typeof f, label: string, rows = 2) => <><label className="l" htmlFor={`t-${k}`}>{label}</label><textarea id={`t-${k}`} className="field" rows={rows} maxLength={600} value={f[k] as string} onChange={(ev) => setF({ ...f, [k]: ev.target.value })} /></>;
  const save = () => { const v = { ...f, reviewOn: f.reviewOn || null }; setState((x) => (e ? editEntry(x, e.id, v) : addEntry(x, sym, v).s)); tick(); toast(e ? 'New version saved. The earlier one is kept.' : 'Thesis saved on this device'); onClose(); };
  return <Sheet title={`${sym}: thesis`} onClose={onClose}>
    {F('thesis', 'Thesis: why this, in one or two lines')}{F('support', 'Evidence that supports it')}{F('counter', 'Strongest argument against it')}{F('decision', 'Decision (watch, plan, pass…)', 1)}{F('invalidation', 'Wrong if… (a price or an event)', 1)}{!f.invalidation.trim() && <p className="small" style={{ margin: '4px 0 0', color: 'var(--a4)' }}>Without this you cannot tell a bad day from being wrong. It is the line that protects you.</p>}{F('trigger', 'Review trigger', 1)}
    <label className="l" htmlFor="t-date">Review date</label><input id="t-date" className="field" type="date" value={f.reviewOn} onChange={(ev) => setF({ ...f, reviewOn: ev.target.value })} />
    <div className="row" style={{ marginTop: 14 }}><button className="btn pri grow" disabled={!f.thesis.trim()} onClick={save}>{e ? 'Save as new version' : 'Save thesis'}</button>{e && e.versions.length > 1 && <button className="btn" onClick={() => setHist(!hist)}>History</button>}</div>
    {hist && e && <div style={{ marginTop: 12 }}>{[...e.versions].reverse().map((v, i) => <div key={v.at} className="card"><div className="k">{i === 0 ? 'Current' : 'Earlier'} · {dayWord(v.at)}</div><p style={{ margin: '6px 0 0' }}>{v.thesis}</p><p className="small dim" style={{ margin: '4px 0 0' }}>Wrong if: {v.invalidation || 'not written'}</p></div>)}</div>}
    <p className="mute small">Saved on this device only. Edits add a version; they never overwrite the earlier one.</p>
  </Sheet>;
}

export function ExplainSheet({ onClose, id }: { onClose: () => void; id?: string }) {
  const [sel, setSel] = useState(id ?? '');
  const m = metric(sel);
  return <Sheet title={m ? m.label : 'Explain a figure'} onClose={onClose}>
    {m ? <>
      <p style={{ fontSize: '0.9375rem' }}>{m.what}</p>
      <p className="small dim">Period: {m.period}<br />Source: {m.source}</p>
      {m.caution && <div className="note">{m.caution}</div>}
      <p className="mute small">A written definition from fixed text. Not generated by an AI model, and not specific to this company.</p>
      <button className="btn" style={{ marginTop: 10 }} onClick={() => setSel('')}>All figures</button>
    </> : <div className="list">{METRICS.map((x) => <button key={x.id} className="li" style={{ textAlign: 'left' }} onClick={() => setSel(x.id)}><span className="grow">{x.label}</span><Icon n="chev" /></button>)}</div>}
  </Sheet>;
}

export function SearchSheet({ onClose }: { onClose: () => void }) {
  const scr = useScreen(); const st = useAppState(); const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();
  const co = useMemo(() => (t.length < 1 ? [] : (scr.data?.rows ?? []).filter((r) => r.sym.toLowerCase().startsWith(t) || r.name.toLowerCase().includes(t)).slice(0, 8)), [t, scr.data]);
  const notes = t.length < 2 ? [] : st.entries.filter((e) => (e.sym + JSON.stringify(current(e))).toLowerCase().includes(t)).slice(0, 4);
  const PAGES = [{ l: 'Today', h: '/today' }, { l: 'Discover', h: '/discover' }, { l: 'Signals: engine picks', h: '/signals' }, { l: 'Signals: paper tracker', h: '/signals?v=tracker' }, { l: 'My Desk: journal', h: '/desk?v=journal' }, { l: 'My Desk: plans', h: '/desk?v=plans' }, { l: 'Profile and data', h: '/profile' }].filter((p) => t && p.l.toLowerCase().includes(t));
  const TOOLS = [{ l: 'Position size planner', f: 'plan' }, { l: 'Explain a figure', f: 'explain' }].filter((p) => t && p.l.toLowerCase().includes(t));
  const terms = glossarySearch(q).slice(0, 4);
  const to = (h: string) => { onClose(); go(h); };
  const none = t && !co.length && !notes.length && !PAGES.length && !terms.length && !TOOLS.length;
  return <Sheet title="Search" onClose={onClose}>
    <div className="search"><Icon n="search" /><input className="field" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Company, note, tool or term" aria-label="Search" autoComplete="off" /></div>
    {!t && <p className="dim small">Try a symbol, a company name, “thesis”, “planner” or “ROCE”.</p>}
    {co.length > 0 && <><h2 className="h">Companies<span className="rule" /></h2><div className="list">{co.map((r) => <button key={r.sym} className="li" style={{ textAlign: 'left' }} onClick={() => to(`/c/${r.sym}`)}><span className="avatar">{r.sym.slice(0, 2)}</span><span className="grow"><b>{r.sym}</b><span className="dim small trunc" style={{ display: 'block' }}>{r.name}</span></span></button>)}</div></>}
    {notes.length > 0 && <><h2 className="h">Your notes<span className="rule" /></h2><div className="list">{notes.map((e) => <button key={e.id} className="li" style={{ textAlign: 'left' }} onClick={() => to(`/desk?v=journal`)}><span className="sym">{e.sym}</span><span className="grow dim trunc">{current(e).thesis}</span></button>)}</div></>}
    {TOOLS.length > 0 && <><h2 className="h">Tools<span className="rule" /></h2><div className="list">{TOOLS.map((p) => <button key={p.l} className="li" style={{ textAlign: 'left' }} onClick={() => { onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent('tw-sheet', { detail: p.f })), 0); }}>{p.l}</button>)}</div></>}
    {PAGES.length > 0 && <><h2 className="h">Pages<span className="rule" /></h2><div className="list">{PAGES.map((p) => <button key={p.l} className="li" style={{ textAlign: 'left' }} onClick={() => to(p.h)}>{p.l}</button>)}</div></>}
    {terms.length > 0 && <><h2 className="h">Terms<span className="rule" /></h2><div className="list">{terms.map((m) => <div key={m.id} className="li" style={{ display: 'block' }}><b>{m.label}</b><div className="dim small">{m.what}</div></div>)}</div></>}
    {none && <p className="dim">Nothing matches “{q}”. Company search covers the Nifty 500 screen only.</p>}
  </Sheet>;
}
