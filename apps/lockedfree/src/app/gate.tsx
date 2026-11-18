import { useMemo, useRef, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Dialog } from '@base-ui/react/dialog';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import uPlot from 'uplot'; import 'uplot/dist/uPlot.min.css';
import { checkEntry, openTrade, closeTrade, reviewTrade, lockState, journal, canEditRules, processBadges, maxDrawdown, tradeResult, emptyBook, type EntryInput, type Rules, type Book, type GateTrade } from '../lib/gate.ts';
import { useBook, sessionToday, download, rupee, storageWorks } from './store.ts'; import { TextField, Toggle, num, SEBI } from './ui.tsx';

const today = sessionToday();
const SETUPS = ['Pullback to a moving average', 'Breakout from a base', 'Reversal at support', 'Earnings or event', 'Other (describe in the trigger)'];

function Lock({ book }: { book: Book }) {
  const l = lockState(book, today); if (!l.locked) return null;
  return (<div className="lock" role="alert" aria-live="assertive"><span className="label">Terminal locked until {l.until}</span><p className="quote">You wrote: “{l.quote}”</p><p className="small">You set this rule while calm. It is a limit you chose, not a judgement. {l.reason === 'daily-loss' ? 'Your daily loss limit was reached.' : 'Your maximum number of trades for the day was reached.'} The terminal opens again at the next session. Nothing needs doing until then.</p></div>);
}
function Entry({ book, set }: { book: Book; set: (b: Book) => void }) {
  const [f, setF] = useState({ symbol: '', setup: '', trigger: '', stop: '', target: '', risk: book.rules ? String(book.rules.riskPct) : '1', entry: '', over: false, qty: '', reason: '' });
  useEffect(() => { if (book.rules) setF((x) => ({ ...x, risk: x.risk || String(book.rules!.riskPct) })); }, [book.rules]);
  const input: EntryInput = { symbol: f.symbol, setup: f.setup, trigger: f.trigger, stop: num(f.stop), target: num(f.target), riskPct: num(f.risk), entryPrice: num(f.entry), qtyOverride: f.over ? num(f.qty) : null, overrideReason: f.reason };
  const c = checkEntry(input, book.rules); const locked = lockState(book, today).locked; const [err, setErr] = useState('');
  const seed = (document.getElementById('shortlist-data')?.textContent ?? '[]'); const names: string[] = useMemo(() => { try { return JSON.parse(seed); } catch { return []; } }, [seed]);
  const k = (key: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [key]: v }));
  if (!book.rules) return (<div className="card"><h2>Set your rules first</h2><p>The Gate needs your account size, risk per trade, daily loss limit and trade limit before it opens. Set them while calm.</p><a className="btn" href="/gate/rules/">Set my rules</a></div>);
  if (locked) return <Lock book={book} />;
  return (<form className="card" onSubmit={(e) => { e.preventDefault(); const r = openTrade(book, input, today); if (r.error) { setErr(r.error); return; } setErr(''); set(r.book); setF({ ...f, symbol: '', setup: '', trigger: '', stop: '', target: '', entry: '', over: false, qty: '', reason: '' }); }} aria-describedby="gate-missing" noValidate>
    <div className="card-head"><h2>New paper trade</h2><span className="stamp">Dated {today} · simulated</span></div>
    <p className="small muted">1 Choose a stock. 2 Fill all five checklist items. 3 The size is computed for you. 4 Stop and target attach when you enter.</p>
    <datalist id="names">{names.map((n) => <option key={n} value={n} />)}</datalist>
    <div className="field"><label className="lbl" htmlFor="sym">1 · Stock</label><input id="sym" list="names" value={f.symbol} onChange={(e) => k('symbol')(e.target.value)} placeholder="NSE symbol, for example TCS" autoComplete="off" /><span className="hint">{names.length ? 'The current screen lists are suggested. Any NSE symbol works.' : 'Any NSE symbol works.'}</span></div>
    <fieldset className="card"><legend className="label">2 · The five-item checklist</legend>
      <div className="field"><label className="lbl" htmlFor="setup">Setup</label><select id="setup" value={f.setup} onChange={(e) => k('setup')(e.target.value)}><option value="">Name your setup…</option>{SETUPS.map((s) => <option key={s}>{s}</option>)}</select></div>
      <TextField id="trigger" label="Entry trigger" hint="The event that makes this entry valid. In your words." value={f.trigger} onChange={k('trigger')} />
      <TextField id="stop" label="Stop price (₹)" inputMode="decimal" value={f.stop} onChange={k('stop')} /><TextField id="target" label="Target price (₹), yours" hint="Your own exit level for this paper trade. It is not a recommendation." inputMode="decimal" value={f.target} onChange={k('target')} />
      <TextField id="risk" label="Risk on this trade (% of account)" hint={`Your rule: ${book.rules.riskPct}%. Maximum accepted here: 5%.`} inputMode="decimal" value={f.risk} onChange={k('risk')} /></fieldset>
    <TextField id="entry" label="Entry price (₹)" hint="The price you see on screen for this paper fill." inputMode="decimal" value={f.entry} onChange={k('entry')} />
    <div className="field"><label className="lbl" htmlFor="qty">3 · Position size (computed)</label><input id="qty" readOnly value={c.computedQty != null ? String(c.computedQty) : '—'} aria-readonly="true" /><span className="hint">Account × risk % ÷ (entry − stop). You cannot type here. {c.computedQty != null && book.rules && `That is ${rupee(book.rules.accountSize * (num(f.risk) ?? 0) / 100)} at risk.`}</span>
      <Toggle label="Override the size (a reason is required and saved with the trade)" checked={f.over} onChange={(v) => setF((x) => ({ ...x, over: v }))} />
      {f.over && <><TextField id="oq" label="Override quantity (whole shares)" inputMode="numeric" value={f.qty} onChange={k('qty')} /><TextField id="or" label="Why are you overriding?" value={f.reason} onChange={k('reason')} /></>}</div>
    <p id="gate-missing" className="small" aria-live="polite">{c.ok ? `Ready: ${c.qty} shares, stop ₹${f.stop} attached.` : `Needed before you can enter: ${c.missing.join(', ')}.`}{c.error ? ' ' + c.error : ''}</p>
    {err && <p className="err" role="alert">{err}</p>}
    <button className="btn" type="submit" disabled={!c.ok} aria-disabled={!c.ok}>4 · Enter paper trade with stop attached</button></form>);
}
function Review({ trade, onDone }: { trade: GateTrade; onDone: (r: 'skip' | { setupQuality: number; emotion: number; followedPlan: boolean }) => void }) {
  const [q, setQ] = useState(0), [e, setE] = useState(0), [p, setP] = useState<boolean | null>(null);
  const Scale = ({ v, set, label }: { v: number; set: (n: number) => void; label: string }) => (<div className="field" role="group" aria-label={label}><span className="lbl">{label}</span><div className="row">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className="chip" aria-pressed={v === n} onClick={() => set(n)}>{n}</button>)}</div></div>);
  return (<Dialog.Root open onOpenChange={(o) => { if (!o) onDone('skip'); }}><Dialog.Portal><Dialog.Backdrop className="backdrop" /><Dialog.Popup className="dlg popup"><Dialog.Title render={<h3 />}>Review {trade.symbol}</Dialog.Title><Dialog.Description className="small muted">Three quick fields. Skipping is allowed; skips are counted and shown in your journal.</Dialog.Description>
    <Scale v={q} set={setQ} label="Setup quality (1 poor – 5 excellent)" /><Scale v={e} set={setE} label="Emotion while holding (1 calm – 5 stressed)" />
    <div className="field" role="group" aria-label="Followed the plan"><span className="lbl">Did you follow your plan?</span><div className="row"><button type="button" className="chip" aria-pressed={p === true} onClick={() => setP(true)}>Yes</button><button type="button" className="chip" aria-pressed={p === false} onClick={() => setP(false)}>No</button></div></div>
    <div className="row"><button className="btn" disabled={!q || !e || p === null} onClick={() => onDone({ setupQuality: q, emotion: e, followedPlan: p! })}>Save review</button><button className="btn ghost" onClick={() => onDone('skip')}>Skip (counted)</button></div></Dialog.Popup></Dialog.Portal></Dialog.Root>);
}
function Positions({ book, set }: { book: Book; set: (b: Book) => void }) {
  const [px, setPx] = useState<Record<string, string>>({}); const [reviewing, setReviewing] = useState<string | null>(null); const [parent] = useAutoAnimate(); const [parent2] = useAutoAnimate(); const [err, setErr] = useState('');
  const open = book.trades.filter((t) => !t.exit), closed = book.trades.filter((t) => t.exit).slice().reverse();
  return (<>
    <div className="card"><div className="card-head"><h2>Open positions</h2><span className="stamp">n = {open.length} · simulated</span></div>{open.length === 0 && <p className="muted">Nothing open. Sitting out is a position.</p>}
      <ul ref={parent} className="rules">{open.map((t) => (<li className="rule" key={t.id}><span /><div><strong>{t.symbol}</strong> · {t.qty} sh @ ₹{t.entry.price}<div className="small muted">Stop ₹{t.stop} attached · target ₹{t.target} · {t.setup}{t.qtyOverrideReason ? ` · size override: ${t.qtyOverrideReason}` : ''}</div></div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); const v = num(px[t.id] ?? ''); if (v == null) { setErr('Enter a real exit price.'); return; } const r = closeTrade(book, t.id, v, today); setErr(r.error ?? ''); set(r.book); if (!r.error) setReviewing(t.id); }}><input aria-label={`Exit price for ${t.symbol}`} inputMode="decimal" placeholder="Exit ₹" value={px[t.id] ?? ''} onChange={(e) => setPx({ ...px, [t.id]: e.target.value })} /><button className="btn ghost">Close</button></form></li>))}</ul>{err && <p className="err" role="alert">{err}</p>}</div>
    <div className="card"><div className="card-head"><h2>Closed trades</h2><span className="stamp">n = {closed.length} · nothing here can be deleted</span></div>{closed.length === 0 && <p className="muted">No closed trades yet.</p>}
      <ul ref={parent2} className="rules">{closed.map((t) => { const r = tradeResult(t, null); return (<li className="rule" key={t.id}><span className={r.total >= 0 ? 'up' : 'down'}>{r.total >= 0 ? '+' : '−'}</span><div><strong>{t.symbol}</strong> · exit ₹{t.exit!.price} on {t.exit!.date}{t.ruleBreak && <> · <span className="pill fail">rule break: exited below the stop</span></>}<div className="small muted">{t.review ? `Review: setup ${t.review.setupQuality}/5, emotion ${t.review.emotion}/5, followed plan: ${t.review.followedPlan ? 'yes' : 'no'}` : t.reviewSkipped ? 'Review skipped (counted)' : <button className="btn ghost" onClick={() => setReviewing(t.id)}>Add review</button>}</div></div><span className="val">{rupee(r.total)}<br />{r.r != null ? `${r.r > 0 ? '+' : r.r < 0 ? '−' : ''}${Math.abs(r.r)} R` : ''}</span></li>); })}</ul></div>
    {reviewing && book.trades.find((t) => t.id === reviewing) && !book.trades.find((t) => t.id === reviewing)!.review && !book.trades.find((t) => t.id === reviewing)!.reviewSkipped && <Review trade={book.trades.find((t) => t.id === reviewing)!} onDone={(r) => { set(reviewTrade(book, reviewing, r)); setReviewing(null); }} />}</>);
}
function Curve({ title, pts }: { title: string; pts: { date: string; v: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!ref.current || pts.length < 2) return; const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    const u = new uPlot({ width: ref.current.clientWidth || 300, height: 180, cursor: { show: false }, legend: { show: false }, scales: { x: { time: false } }, axes: [{ stroke: css('--ink-muted'), grid: { stroke: css('--hairline') } }, { stroke: css('--ink-muted'), grid: { stroke: css('--hairline') } }], series: [{}, { stroke: css('--ink'), width: 2 }] }, [pts.map((_, i) => i), pts.map((p) => p.v)], ref.current);
    return () => u.destroy(); }, [pts]);
  const dd = maxDrawdown(pts);
  return (<div className="card"><div className="card-head"><h3>{title}</h3><span className="stamp">n = {pts.length} · as of {pts.at(-1)?.date ?? today}</span></div>{pts.length < 2 ? <div className="chart-empty"><p>{pts.length === 0 ? 'No trades in this group yet.' : 'One trade is not a curve yet.'}</p></div> : <div ref={ref} className="chart sm" role="img" aria-label={`${title}: cumulative paper P&L over ${pts.length} trades`} />}
    <p className="small">Cumulative result {rupee(pts.at(-1)?.v ?? 0)} · deepest drawdown {rupee(dd)}</p><p className="sim">Simulated — not real returns</p></div>);
}
function Journal({ book }: { book: Book }) {
  const j = journal(book); const badges = processBadges(book, today);
  return (<><div className="card"><span className="label">Followed the plan</span><div className="stat"><span className="v" data-track="plan-pct">{j.planPct == null ? '—' : j.planPct + '%'}</span><span className="n">of {j.assessed} assessed trades (n = {j.assessed})</span>{j.assessed < 30 && <span className="honest">n = {j.assessed} — too few to conclude anything</span>}<span className="stamp">as of {today} · {j.skipped} {j.skipped === 1 ? 'review' : 'reviews'} skipped (counted) · {j.closed - j.assessed - j.skipped > 0 ? `${j.closed - j.assessed - j.skipped} not yet reviewed` : 'all reviewed or skipped'}</span></div>
      <p className="small muted">Plan adherence sits above profit and loss on purpose. A trade counts as following the plan only if you said so in the review and did not exit below your own stop.</p></div>
    <div className="grid g3"><div className="card stat"><span className="label">Mistake cost</span><span className="v down">{rupee(-j.mistakeCost)}</span><span className="n">lost on trades tagged as rule breaks · n = {j.closed - j.followed}</span><span className="sim">Simulated — not real returns</span></div>
      <div className="card stat"><span className="label">Profit and loss, after charges</span><span className="v">{rupee(j.pnl)}</span><span className="n">n = {j.closed} closed</span><span className="sim">Simulated — not real returns</span></div>
      <div className="card stat"><span className="label">Process</span>{badges.length ? <ul>{badges.map((b) => <li key={b}>{b}</li>)}</ul> : <span className="small muted">Nothing earned yet. Process behaviours only: reviews done, rules followed, a locked day sat out.</span>}</div></div>
    <div className="grid g2"><Curve title="Trades that followed the plan" pts={j.planCurve} /><Curve title="Trades that broke the plan" pts={j.breakCurve} /></div>
    <p className="stamp">Both curves are drawn from your own paper book, stored only in this browser.</p></>);
}
function RulesView({ book, set }: { book: Book; set: (b: Book) => void }) {
  const r = book.rules; const [f, setF] = useState({ acct: String(r?.accountSize ?? 500000), risk: String(r?.riskPct ?? 1), loss: String(r?.dailyLossLimit ?? 3000), max: String(r?.maxTradesPerDay ?? 3), text: r?.ruleText ?? '', strict: !!r?.strictUntil, until: r?.strictUntil ?? '' });
  const [msg, setMsg] = useState(''); const k = (key: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [key]: v }));
  const next: Rules | null = (num(f.acct) && num(f.risk) != null && num(f.loss) != null && num(f.max)) ? { accountSize: num(f.acct)!, riskPct: num(f.risk)!, dailyLossLimit: num(f.loss)!, maxTradesPerDay: Math.floor(num(f.max)!), ruleText: f.text.trim(), strictUntil: f.strict && f.until ? f.until : null, setOn: r?.setOn ?? today } : null;
  const ok = !!next && next.ruleText.length >= 10 && next.riskPct > 0 && next.riskPct <= 5 && next.dailyLossLimit > 0 && next.maxTradesPerDay >= 1;
  return (<form className="card" onSubmit={(e) => { e.preventDefault(); if (!ok || !next) return; const can = canEditRules(book, today, next); if (!can.ok) { setMsg(can.why!); return; } set({ ...book, rules: next }); setMsg('Saved. These are your rules.'); }}>
    <h2>Your account rules</h2><p className="muted">Set these while calm. When a limit is hit, the terminal locks until the next session and shows your own words back to you.</p>
    <TextField id="acct" label="Paper account size (₹)" inputMode="numeric" value={f.acct} onChange={k('acct')} /><TextField id="rrisk" label="Risk per trade (% of account, 0–5)" inputMode="decimal" value={f.risk} onChange={k('risk')} />
    <TextField id="loss" label="Daily loss limit (₹)" hint="When realised losses today reach this, the terminal locks." inputMode="numeric" value={f.loss} onChange={k('loss')} /><TextField id="max" label="Maximum new trades per day" inputMode="numeric" value={f.max} onChange={k('max')} />
    <div className="field"><label className="lbl" htmlFor="rt">Your rule, in your own words</label><textarea id="rt" value={f.text} onChange={(e) => k('text')(e.target.value)} placeholder="For example: Two losses in a day and I close the laptop." /><span className="hint">At least 10 characters. This is quoted back to you on the lock screen.</span></div>
    <Toggle label="Strict mode" checked={f.strict} onChange={(v) => setF((x) => ({ ...x, strict: v }))} hint="While strict mode is on, these rules can be tightened but not loosened. It is a self-commitment device in your browser. Clearing site data or using another device bypasses it." />
    {f.strict && <TextField id="until" type="date" label="Strict until" value={f.until} onChange={k('until')} />}
    {msg && <p role="status" className="small">{msg}</p>}<button className="btn" disabled={!ok}>Save rules</button></form>);
}
function Backup({ book, set }: { book: Book; set: (b: Book) => void }) {
  return (<div className="card"><h3>Your book is stored only in this browser</h3><p className="small muted">{storageWorks() ? 'Clearing site data removes it. Download a copy now and then.' : 'This browser blocked storage: nothing you enter will be kept. Download a copy before leaving.'}</p><div className="row"><button className="btn ghost" onClick={() => download(`rulebook-book-${today}.json`, book)}>Download my book</button>
    <label className="btn ghost">Load a saved book<input type="file" accept="application/json" hidden onChange={async (e) => { const t = await e.target.files?.[0]?.text(); try { const b = JSON.parse(t ?? ''); if (b?.schema === 'rulebook-book/1' && Array.isArray(b.trades)) set(b); } catch { /* ignore a bad file */ } }} /></label></div></div>);
}
function App({ view }: { view: string }) {
  const [book, set] = useBook();
  return (<div className="grid">{SEBI}{view === 'entry' && <><Entry book={book} set={set} /><Positions book={book} set={set} /></>}{view === 'journal' && <Journal book={book} />}{view === 'rules' && <RulesView book={book} set={set} />}<Backup book={book} set={set} /></div>);
}
const el = document.getElementById('gate-root'); if (el) createRoot(el).render(<App view={el.dataset.view ?? 'entry'} />);
export { emptyBook };
