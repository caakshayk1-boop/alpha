'use client';

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Rv } from '@/components/ui';
import { num } from '@/lib/format';
import { canAnimate, gsap } from '@/lib/motion';
import { cagr, evBand, expectancy, positionSize, recoveryGain, streakProb } from './math';

/* Decision calculators. Each one: inputs with a stepper and a message beside the field, one result, then the working that
   produced it, so a reader can redo the sum by hand. Arithmetic only: no input is a forecast, and nothing here says what to do. */

export const toNum = (s: string) => { const n = Number(s.replace(/,/g, '')); return s.trim() === '' || !Number.isFinite(n) ? NaN : n; };
const ok = (n: number) => Number.isFinite(n);
export const money = (v: number, dp = 0) => `${v < 0 ? '−' : ''}₹${num(Math.abs(v), dp)}`;
export const lakh = (v: number) => { const a = Math.abs(v), s = v < 0 ? '−' : ''; return a >= 1e7 ? `${s}₹${(a / 1e7).toFixed(2)} cr` : a >= 1e5 ? `${s}₹${(a / 1e5).toFixed(2)} L` : `${s}₹${num(a, 0)}`; };
const signed = (v: number, dp = 2, unit = '') => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(dp)}${unit}`;

/** A number field with − / + buttons, its unit inside the box and its message right under it (error or hint). */
export function Stepper({ label, value, set, step = 1, min, max, prefix, suffix, hint, error }: {
  label: string; value: string; set: (v: string) => void; step?: number; min?: number; max?: number; prefix?: string; suffix?: string; hint?: string; error?: string | null;
}) {
  const id = useId();
  const dp = (String(step).split('.')[1] ?? '').length;
  const bump = (dir: 1 | -1) => {
    const cur = toNum(value);
    let n = (ok(cur) ? cur : (min ?? 0)) + dir * step;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    set(n.toFixed(dp));
  };
  const msg = error ?? hint;
  return (
    <div className={`fld${error ? ' bad' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="fld-box">
        <button type="button" className="fld-step" onClick={() => bump(-1)} aria-label={`Decrease ${label} by ${step}`} tabIndex={-1}>−</button>
        {prefix && <span className="fld-unit" aria-hidden>{prefix}</span>}
        <input id={id} inputMode="decimal" autoComplete="off" value={value} aria-invalid={error ? true : undefined} aria-describedby={msg ? `${id}-m` : undefined}
          onChange={(e) => set(e.target.value.replace(/[^\d.,-]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); bump(1); } else if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1); } }} />
        {suffix && <span className="fld-unit" aria-hidden>{suffix}</span>}
        <button type="button" className="fld-step" onClick={() => bump(1)} aria-label={`Increase ${label} by ${step}`} tabIndex={-1}>+</button>
      </div>
      {msg && <span id={`${id}-m`} className={error ? 'fld-err' : 'fld-hint'}>{msg}</span>}
    </div>
  );
}

/** The working: one line per step, "what = how = result". */
export function Working({ lines, note }: { lines: [string, string, string][]; note?: ReactNode }) {
  return (
    <details className="working" open>
      <summary>Working</summary>
      <ol>
        {lines.map(([what, how, res]) => <li key={what}><span className="w-what">{what}</span><span className="w-how num">{how}</span><b className="num">{res}</b></li>)}
      </ol>
      {note && <p className="w-note">{note}</p>}
    </details>
  );
}

function Head({ n, q, a }: { n: string; q: string; a: string }) {
  return (
    <div className="tool-h">
      <span className="tool-n" aria-hidden>{n}</span>
      <div><h3>{q}</h3><p>{a}</p></div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="tool-empty" role="status"><span aria-hidden>?</span><p>{children}</p></div>;
}

// ── 1. Position size from a stop ─────────────────────────────────────────
export function Position() {
  const [capital, setCapital] = useState('1000000');
  const [riskPct, setRiskPct] = useState('1');
  const [entry, setEntry] = useState('500');
  const [stop, setStop] = useState('470');
  const cap = toNum(capital), rp = toNum(riskPct), e = toNum(entry), s = toNum(stop);
  const err = {
    cap: !ok(cap) || cap <= 0 ? 'Enter capital above ₹0.' : null,
    rp: !ok(rp) || rp <= 0 ? 'Enter a risk above 0%.' : rp > 100 ? 'Cannot exceed 100% of capital.' : null,
    e: !ok(e) || e <= 0 ? 'Enter an entry price above ₹0.' : null,
    s: !ok(s) || s <= 0 ? 'Enter a stop price above ₹0.' : ok(e) && s >= e ? 'For a long position the stop sits below the entry.' : null,
  };
  const size = positionSize(cap, rp, e, s);
  const valid = !Object.values(err).some(Boolean) && size !== null;
  const budget = size?.budget ?? 0, risk = e - s;
  const qty = size?.qty ?? 0;
  const value = qty * e, loss = qty * risk;
  return (
    <Rv className="panel tool" as="article">
      <Head n="01" q="How many shares does my stop allow?" a="Fix the most you will lose if the stop is hit, then let the distance to the stop set the size." />
      <div className="tool-grid">
        <div className="tool-in">
          <Stepper label="Capital" value={capital} set={setCapital} step={50000} min={0} prefix="₹" error={err.cap} />
          <Stepper label="Risk per trade" value={riskPct} set={setRiskPct} step={0.25} min={0} max={100} suffix="%" error={err.rp} hint={!err.rp && rp > 2 ? `Above the 1–2% many rule sets use: ten stops in a row would cost about ${(100 - 100 * (1 - rp / 100) ** 10).toFixed(0)}% of capital.` : 'Share of capital you accept losing on this trade.'} />
          <Stepper label="Entry price" value={entry} set={setEntry} step={1} min={0} prefix="₹" error={err.e} />
          <Stepper label="Stop price" value={stop} set={setStop} step={1} min={0} prefix="₹" error={err.s} hint={!err.s && ok(e) && e > 0 ? `${((risk / e) * 100).toFixed(1)}% below the entry.` : undefined} />
        </div>
        <div className="tool-out" aria-live="polite">
          {!valid ? <Empty>Fill the four fields; the size appears here with every step of the sum.</Empty> : (
            <>
              <div className="res">
                <div className="res-main"><span className="k">Shares</span><span className="v num">{num(qty)}</span></div>
                <div><span className="k">Position value</span><span className="v2 num">{lakh(value)}</span><span className="s num">{((value / cap) * 100).toFixed(1)}% of capital</span></div>
                <div><span className="k">Loss if the stop fills</span><span className="v2 num down">{money(-loss)}</span><span className="s num">{((loss / cap) * 100).toFixed(2)}% of capital</span></div>
              </div>
              <Ladder entry={e} stop={s} />
              <Working lines={[
                ['Risk budget', `${money(cap)} × ${rp}%`, money(budget)],
                ['Risk per share', `${money(e, 2)} − ${money(s, 2)}`, money(risk, 2)],
                ['Shares', `⌊${num(budget, 0)} ÷ ${num(risk, 2)}⌋`, num(qty)],
                ['Position value', `${num(qty)} × ${money(e, 2)}`, money(value)],
                ['Planned loss if filled at the stop', `${num(qty)} × ${money(risk, 2)}`, money(loss)],
              ]} note={<>Rounded down to whole shares, so the planned loss if filled at the stop is at or under the budget. Not modelled: brokerage, taxes, and a gap that fills you below the stop.</>} />
              {qty === 0 && <p className="tool-warn">The budget ({money(budget)}) is smaller than the risk on one share ({money(risk, 2)}), so the size rounds to zero.</p>}
              {value > cap && <p className="tool-warn">This size needs {lakh(value)}, more than the capital of {lakh(cap)}: a wider stop or a smaller risk brings it inside.</p>}
            </>
          )}
        </div>
      </div>
    </Rv>
  );
}

/** Stop, entry and 1R to 3R on one scale: where the plan's prices sit relative to each other. */
function Ladder({ entry, stop }: { entry: number; stop: number }) {
  const r = entry - stop;
  const pts: [string, number, string][] = [['Stop', stop, 'down'], ['Entry', entry, ''], ['1R', entry + r, 'up'], ['2R', entry + 2 * r, 'up'], ['3R', entry + 3 * r, 'up']];
  const lo = stop, hi = entry + 3 * r;
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;
  return (
    <figure className="ladder" aria-label={`Price ladder: ${pts.map(([l, v]) => `${l} ₹${num(v, 2)}`).join(', ')}`} role="img">
      <div className="ladder-track"><i className="ladder-risk" style={{ width: `${x(entry)}%` }} /><i className="ladder-gain" style={{ left: `${x(entry)}%`, right: 0 }} /></div>
      {pts.map(([l, v, t]) => (
        <span key={l} className={`ladder-pt ${t}`} style={{ left: `${x(v)}%` }}><b>{l}</b><span className="num">₹{num(v, v >= 1000 ? 0 : 2)}</span></span>
      ))}
    </figure>
  );
}

// ── 2. Expected value of a plan ──────────────────────────────────────────

export function ExpectedValue() {
  const [win, setWin] = useState('40');
  const [gain, setGain] = useState('2');
  const [lossR, setLossR] = useState('1');
  const [cost, setCost] = useState('0.05');
  const [rupee, setRupee] = useState('10000');
  const [trades, setTrades] = useState('50');
  const p = toNum(win) / 100, W = toNum(gain), L = toNum(lossR), c = toNum(cost), R = toNum(rupee), N = Math.round(toNum(trades));
  const err = {
    win: !ok(p) || p < 0 || p > 1 ? 'Enter a win rate from 0 to 100%.' : null,
    gain: !ok(W) || W <= 0 ? 'Enter an average win above 0R.' : W > 50 ? 'Above 50R is outside what this tool handles.' : null,
    loss: !ok(L) || L <= 0 ? 'Enter an average loss above 0R.' : L > 10 ? 'Above 10R is outside what this tool handles.' : null,
    cost: !ok(c) || c < 0 ? 'Enter costs of 0R or more.' : c > 2 ? 'Above 2R a trade is outside what this tool handles.' : null,
    rupee: !ok(R) || R <= 0 ? 'Enter the rupees one R stands for, above ₹0.' : null,
    trades: !ok(N) || N < 1 || N > 500 ? 'Enter between 1 and 500 trades.' : null,
  };
  const valid = !Object.values(err).some(Boolean);
  const out = useMemo(() => {
    if (!valid) return null;
    const { ev, breakEven: be } = expectancy(p, W, L, c);
    const band = evBand(N, p, W, L, c);
    const streak = Math.min(N, 5);
    return { ev, be, band, streak, pStreak: streakProb(N, 1 - p, streak) };
  }, [valid, p, W, L, c, N]);
  return (
    <Rv className="panel tool" as="article">
      <Head n="02" q="Is this plan worth taking, on its own numbers?" a="Expected value per trade from a win rate and the sizes of wins and losses, in R (1R = what the stop risks)." />
      <div className="tool-grid">
        <div className="tool-in">
          <Stepper label="Win rate" value={win} set={setWin} step={1} min={0} max={100} suffix="%" error={err.win} hint="Your estimate. The Engines page shows measured hit rates, each with its sample size." />
          <Stepper label="Average win" value={gain} set={setGain} step={0.1} min={0} suffix="R" error={err.gain} />
          <Stepper label="Average loss" value={lossR} set={setLossR} step={0.1} min={0} suffix="R" error={err.loss} hint="1R if every loss is a clean stop; more if stops gap." />
          <Stepper label="Costs per trade" value={cost} set={setCost} step={0.01} min={0} suffix="R" error={err.cost} hint="Brokerage, taxes and slippage, as a share of 1R." />
          <Stepper label="One R in rupees" value={rupee} set={setRupee} step={1000} min={0} prefix="₹" error={err.rupee} />
          <Stepper label="Number of trades" value={trades} set={setTrades} step={10} min={1} max={500} error={err.trades} />
        </div>
        <div className="tool-out" aria-live="polite">
          {!out ? <Empty>Fix the highlighted field; the expected value and its spread appear here.</Empty> : (
            <>
              <div className="res">
                <div className="res-main"><span className="k">Expected per trade</span><span className={`v num ${out.ev > 0 ? 'up' : out.ev < 0 ? 'down' : ''}`}>{out.ev > 0 ? '▲ ' : out.ev < 0 ? '▼ ' : ''}{signed(out.ev, 2, 'R')}</span><span className="s num">{out.ev > 0 ? "+" : ""}{money(out.ev * R)} a trade, at {money(R)} for each R</span></div>
                <div><span className="k">Break-even win rate</span><span className="v2 num">{(out.be * 100).toFixed(1)}%</span><span className="s">you entered {(p * 100).toFixed(0)}%</span></div>
                <div><span className="k">{N} trades, middle 95%</span><span className="v2 num">{signed(out.band.lo, 1, 'R')} to {signed(out.band.hi, 1, 'R')}</span><span className="s num">{money(out.band.lo * R)} to {money(out.band.hi * R)}</span></div>
              </div>
              <EvBar p={p} be={out.be} />
              <Working lines={[
                ['Wins add', `${(p * 100).toFixed(1)}% × ${W}R`, signed(p * W, 3, 'R')],
                ['Losses take', `${((1 - p) * 100).toFixed(1)}% × ${L}R`, signed(-(1 - p) * L, 3, 'R')],
                ['Costs take', `${c}R every trade`, signed(-c, 3, 'R')],
                ['Expected per trade', 'sum of the three', signed(out.ev, 3, 'R')],
                ['Break-even win rate', `(${L} + ${c}) ÷ (${W} + ${L})`, `${(out.be * 100).toFixed(1)}%`],
                [`${out.streak}+ losses in a row`, `at some point in ${N} trades`, `${(out.pStreak * 100).toFixed(0)}% chance`],
              ]} note={<>The range and the streak odds are exact for independent trades with exactly these inputs. Real trades are not independent and a win rate measured on a few dozen trades is itself uncertain, so the spread is wider in practice. A positive number here is arithmetic on your inputs, not evidence that the plan works.</>} />
            </>
          )}
        </div>
      </div>
    </Rv>
  );
}

/** Win rate against break-even on one 0 to 100% scale. */
function EvBar({ p, be }: { p: number; be: number }) {
  const ahead = p > be;
  return (
    <div className="evbar" role="img" aria-label={`Win rate ${(p * 100).toFixed(0)}% against a break-even of ${(be * 100).toFixed(1)}%: ${ahead ? 'above' : p < be ? 'below' : 'equal'}`}>
      <div className="evbar-track"><i style={{ width: `${Math.min(100, p * 100)}%` }} className={ahead ? 'up' : 'down'} /><u style={{ left: `${Math.min(100, be * 100)}%` }} /></div>
      <div className="evbar-key"><span>0%</span><span>break-even {(be * 100).toFixed(1)}% (line)</span><span>100%</span></div>
    </div>
  );
}

// ── 3. Annual return ────────────────────────────────────────────────────
export function Cagr() {
  const [from, setFrom] = useState('100000');
  const [to, setTo] = useState('250000');
  const [years, setYears] = useState('5');
  const f = toNum(from), t = toNum(to), y = toNum(years);
  const err = {
    f: !ok(f) || f <= 0 ? 'A start above ₹0: from zero there is no rate.' : null,
    t: !ok(t) || t <= 0 ? 'An end above ₹0: a total loss has no meaningful rate.' : null,
    y: !ok(y) || y <= 0 ? 'Enter years above 0.' : y > 60 ? 'Over 60 years a single rate says little.' : null,
  };
  const valid = !err.f && !err.t && !err.y;
  const c = valid ? cagr(f, t, y) : null;
  return (
    <Rv className="panel tool" as="article">
      <Head n="05" q="What was the annual return?" a="The one steady yearly rate that turns the start value into the end value." />
      <div className="tool-grid">
        <div className="tool-in">
          <Stepper label="Started with" value={from} set={setFrom} step={10000} min={0} prefix="₹" error={err.f} />
          <Stepper label="Ended with" value={to} set={setTo} step={10000} min={0} prefix="₹" error={err.t} />
          <Stepper label="Years" value={years} set={setYears} step={1} min={0} error={err.y} hint="Fractions work: 2.5 for two and a half years." />
        </div>
        <div className="tool-out" aria-live="polite">
          {c === null ? <Empty>Fix the highlighted field to see the rate.</Empty> : (
            <>
              <div className="res"><div className="res-main"><span className="k">A year, compounded</span><span className={`v num ${c > 0 ? 'up' : c < 0 ? 'down' : ''}`}>{c > 0 ? '▲ ' : c < 0 ? '▼ ' : ''}{signed(c, 1, '%')}</span>{c > 0 && <span className="s">at that rate money doubles in about {(Math.log(2) / Math.log(1 + c / 100)).toFixed(1)} years</span>}</div></div>
              <Working lines={[
                ['Growth multiple', `${money(t)} ÷ ${money(f)}`, `${(t / f).toFixed(3)}×`],
                ['Per year', `${(t / f).toFixed(3)} ^ (1 ÷ ${y})`, `${Math.pow(t / f, 1 / y).toFixed(4)}×`],
                ['Rate', `${Math.pow(t / f, 1 / y).toFixed(4)} − 1`, signed(c, 2, '%')],
              ]} note="A steady rate that ends in the same place: the real path went up and down. Money added or taken out along the way needs an XIRR instead." />
            </>
          )}
        </div>
      </div>
    </Rv>
  );
}

// ── 4. Loss recovery ────────────────────────────────────────────────────
export function Recovery() {
  const [loss, setLoss] = useState('30');
  const l = toNum(loss);
  const err = !ok(l) || l <= 0 ? 'Enter a fall above 0%.' : l >= 100 ? 'A 100% fall leaves nothing to recover.' : null;
  const need = err ? null : recoveryGain(l);
  return (
    <Rv className="panel tool" as="article">
      <Head n="06" q="How deep is this hole?" a="The gain needed to get back to where a fall started. Losses and gains are not symmetrical." />
      <div className="tool-grid">
        <div className="tool-in">
          <Stepper label="After a fall of" value={loss} set={setLoss} step={5} min={0} max={99} suffix="%" error={err} />
          <table className="mini">
            <caption>The same sum for common falls</caption>
            <thead><tr><th scope="col">Fall</th><th scope="col">Gain to recover</th></tr></thead>
            <tbody>{[10, 20, 33, 50, 75, 90].map((x) => <tr key={x} className={ok(l) && Math.abs(l - x) < 0.5 ? 'on' : undefined}><td className="num">−{x}%</td><td className="num">+{recoveryGain(x).toFixed(0)}%</td></tr>)}</tbody>
          </table>
        </div>
        <div className="tool-out" aria-live="polite">
          {need === null ? <Empty>Enter a fall between 0 and 100%.</Empty> : (
            <>
              <div className="res"><div className="res-main"><span className="k">Gain needed to get back to even</span><span className="v num warn">+{need.toFixed(1)}%</span></div></div>
              <Working lines={[
                ['Left after the fall', `100 − ${l}`, `${(100 - l).toFixed(1)} of every 100`],
                ['Gain needed', `${l} ÷ ${(100 - l).toFixed(1)}`, `+${need.toFixed(1)}%`],
              ]} note="This is why every plan on this site starts from the stop: a small loss is cheap to recover, a large one is not." />
            </>
          )}
        </div>
      </div>
    </Rv>
  );
}

// ── 5. SIP planner ──────────────────────────────────────────────────────
export function Sip() {
  const [monthly, setMonthly] = useState('25000');
  const [step, setStep] = useState('10');
  const [ret, setRet] = useState('12');
  const [years, setYears] = useState('15');
  const path = useRef<SVGPathElement>(null);
  const m0 = toNum(monthly), st = toNum(step), rt = toNum(ret), yr = toNum(years);
  const err = {
    m: !ok(m0) || m0 <= 0 ? 'Enter a monthly amount above ₹0.' : null,
    s: !ok(st) || st < 0 ? 'Enter a step-up of 0% or more.' : st > 50 ? 'Up to 50% a year.' : null,
    r: !ok(rt) || rt < -20 || rt > 40 ? 'Enter a return from −20% to 40%.' : null,
    y: !ok(yr) || yr < 1 || yr > 50 ? 'Enter 1 to 50 years.' : null,
  };
  const valid = !Object.values(err).some(Boolean);
  const data = useMemo(() => {
    if (!valid) return null;
    const Y = Math.round(yr);
    const series = (rate: number) => {
      const out: { y: number; value: number; invested: number }[] = [{ y: 0, value: 0, invested: 0 }];
      let value = 0, invested = 0, m = m0;
      const r = Math.pow(1 + rate / 100, 1 / 12) - 1;
      for (let k = 1; k <= Y; k++) {
        for (let j = 0; j < 12; j++) { value = (value + m) * (1 + r); invested += m; }
        out.push({ y: k, value, invested });
        m *= 1 + st / 100;
      }
      return out;
    };
    return { Y, base: series(rt), low: series(rt - 3), high: series(rt + 3), r: Math.pow(1 + rt / 100, 1 / 12) - 1 };
  }, [valid, m0, st, rt, yr]);
  useEffect(() => {
    const p = path.current;
    if (!p || !canAnimate()) return;
    const len = p.getTotalLength();
    gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.4, ease: 'power2.out', immediateRender: false, clearProps: 'strokeDasharray,strokeDashoffset' });
  }, [data?.Y]);
  const last = data?.base[data.base.length - 1];
  const W = 560, H = 190, pad = 8;
  const max = data ? Math.max(...data.high.map((q) => q.value), 1) : 1;
  const X = (y: number) => pad + (y / (data?.Y ?? 1)) * (W - 2 * pad);
  const Yv = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const line = (s: { y: number; value: number }[]) => s.map((q, i) => `${i ? 'L' : 'M'}${X(q.y).toFixed(1)},${Yv(q.value).toFixed(1)}`).join(' ');
  return (
    <Rv className="panel tool" as="article">
      <Head n="07" q="What could a monthly SIP become?" a="Contributions growing at a return you choose, with a band 3 points either side. An illustration, not a forecast." />
      <div className="tool-grid">
        <div className="tool-in">
          <Stepper label="Monthly amount" value={monthly} set={setMonthly} step={1000} min={0} prefix="₹" error={err.m} />
          <Stepper label="Yearly step-up" value={step} set={setStep} step={1} min={0} max={50} suffix="%" error={err.s} hint="How much the monthly amount rises each year." />
          <Stepper label="Return a year" value={ret} set={setRet} step={0.5} min={-20} max={40} suffix="%" error={err.r} hint="An assumption you type, not a forecast." />
          <Stepper label="Years" value={years} set={setYears} step={1} min={1} max={50} error={err.y} />
        </div>
        <div className="tool-out" aria-live="polite">
          {!data || !last ? <Empty>Fix the highlighted field to see the projection.</Empty> : (
            <>
              <div className="res">
                <div className="res-main"><span className="k">It grows to</span><span className="v num">{lakh(last.value)}</span><span className="s num">{lakh(data.low[data.low.length - 1].value)} to {lakh(data.high[data.high.length - 1].value)} at {rt - 3}% to {rt + 3}%</span></div>
                <div><span className="k">You put in</span><span className="v2 num">{lakh(last.invested)}</span></div>
                <div><span className="k">Multiple of money in</span><span className="v2 num">{(last.value / last.invested).toFixed(2)}×</span></div>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} className="sipchart" role="img" aria-label={`SIP value over ${data.Y} years: ${lakh(last.value)} at ${rt}%, against ${lakh(last.invested)} put in`}>
                <path d={`${line(data.high)} L${X(data.Y)},${Yv(0)} L${X(0)},${Yv(0)} Z`} fill="var(--accent-soft)" />
                <path d={`${line(data.low)} L${X(data.Y)},${Yv(0)} L${X(0)},${Yv(0)} Z`} fill="var(--panel)" opacity=".75" />
                <path d={line(data.base.map((q) => ({ y: q.y, value: q.invested })))} fill="none" stroke="var(--dim)" strokeWidth="1.6" strokeDasharray="5 4" />
                <path ref={path} d={line(data.base)} fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" />
              </svg>
              <p className="sipkey"><span><i className="k-line" />at {rt}% a year</span><span><i className="k-band" />{rt - 3}% to {rt + 3}%</span><span><i className="k-dash" />what you put in</span></p>
              <Working lines={[
                ['Monthly rate', `(1 + ${rt}%) ^ (1 ÷ 12) − 1`, `${(data.r * 100).toFixed(3)}%`],
                ['Each month', 'add the instalment, then grow by the monthly rate', ''],
                ['Each year', `instalment × (1 + ${st}%)`, `year ${data.Y}: ${money(m0 * (1 + st / 100) ** (data.Y - 1))}`],
                ['Total put in', `${data.Y * 12} instalments`, lakh(last.invested)],
              ]} note="No tax, costs or inflation are modelled, and real returns arrive unevenly: the same average with a bad last few years ends far lower." />
            </>
          )}
        </div>
      </div>
    </Rv>
  );
}
