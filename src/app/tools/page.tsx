'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PageHead, Rv, SectionHead } from '@/components/ui';
import { num } from '@/lib/format';
import { canAnimate, gsap } from '@/lib/motion';

const toNum = (s: string) => { const n = Number(s.replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const lakh = (v: number) => (v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(2)} L` : `₹${num(v, 0)}`);

function Field({ label, value, set, suffix, prefix }: { label: string; value: string; set: (v: string) => void; suffix?: string; prefix?: string }) {
  return (
    <label style={{ display: 'grid', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
      {label}
      <span style={{ position: 'relative', display: 'block' }}>
        {prefix && <span className="dim" style={{ position: 'absolute', left: 14, top: 10 }}>{prefix}</span>}
        <input className="field" style={{ width: '100%', paddingLeft: prefix ? 30 : 14, paddingRight: suffix ? 38 : 14 }} inputMode="decimal" value={value} onChange={(e) => set(e.target.value.replace(/[^\d.,]/g, ''))} />
        {suffix && <span className="dim" style={{ position: 'absolute', right: 14, top: 10 }}>{suffix}</span>}
      </span>
    </label>
  );
}

function Sip() {
  const [monthly, setMonthly] = useState('25000');
  const [step, setStep] = useState('10');
  const [ret, setRet] = useState('12');
  const [years, setYears] = useState('15');
  const path = useRef<SVGPathElement>(null);
  const data = useMemo(() => {
    const Y = Math.min(50, Math.max(1, Math.round(toNum(years))));
    const series = (rate: number) => {
      const out: { y: number; value: number; invested: number }[] = [{ y: 0, value: 0, invested: 0 }];
      let value = 0, invested = 0, m = toNum(monthly);
      const r = Math.pow(1 + rate / 100, 1 / 12) - 1;
      for (let yr = 1; yr <= Y; yr++) {
        for (let k = 0; k < 12; k++) { value = (value + m) * (1 + r); invested += m; }
        out.push({ y: yr, value, invested });
        m *= 1 + toNum(step) / 100;
      }
      return out;
    };
    const base = series(toNum(ret));
    return { Y, base, low: series(Math.max(0, toNum(ret) - 3)), high: series(toNum(ret) + 3) };
  }, [monthly, step, ret, years]);
  const last = data.base[data.base.length - 1];
  const W = 560, H = 200, pad = 8;
  const max = Math.max(...data.high.map((p) => p.value), 1);
  const X = (y: number) => pad + (y / data.Y) * (W - 2 * pad);
  const Yv = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const line = (s: { y: number; value: number }[]) => s.map((p, i) => `${i ? 'L' : 'M'}${X(p.y).toFixed(1)},${Yv(p.value).toFixed(1)}`).join(' ');
  useEffect(() => {
    const p = path.current;
    if (!p || !canAnimate()) return;
    const len = p.getTotalLength();
    gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1, ease: 'power2.out', immediateRender: false, clearProps: 'strokeDasharray,strokeDashoffset' });
  }, [data.base.length, ret, monthly]);
  return (
    <Rv className="panel">
      <div className="eyebrow">SIP planner</div>
      <div className="grid g4" style={{ marginTop: 14 }}>
        <Field label="Monthly amount" value={monthly} set={setMonthly} prefix="₹" />
        <Field label="Yearly step-up" value={step} set={setStep} suffix="%" />
        <Field label="Return a year" value={ret} set={setRet} suffix="%" />
        <Field label="Years" value={years} set={setYears} />
      </div>
      <div className="grid g3" style={{ margin: '18px 0' }}>
        <div><div className="eyebrow">You put in</div><div className="disp" style={{ fontSize: 36 }}>{lakh(last.invested)}</div></div>
        <div><div className="eyebrow">It grows to</div><div className="disp" style={{ fontSize: 36, color: 'var(--accent-2)' }}>{lakh(last.value)}</div></div>
        <div><div className="eyebrow">Growth is</div><div className="disp" style={{ fontSize: 36 }}>{last.invested ? `${(last.value / last.invested).toFixed(1)}×` : '—'}</div></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label={`SIP growth over ${data.Y} years`}>
        <path d={`${line(data.high)} L${X(data.Y)},${Yv(0)} L${X(0)},${Yv(0)} Z`} fill="var(--accent-soft)" opacity=".5" />
        <path d={`${line(data.low)} L${X(data.Y)},${Yv(0)} L${X(0)},${Yv(0)} Z`} fill="var(--bg)" opacity=".7" />
        <path d={line(data.base.map((p) => ({ y: p.y, value: p.invested })))} fill="none" stroke="var(--dim)" strokeWidth="1.6" strokeDasharray="5 4" />
        <path ref={path} d={line(data.base)} fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      <p className="dim" style={{ fontSize: 12.5, margin: '10px 0 0' }}>Solid line: grows at {ret}% a year. Shaded band: 3 points either side ({lakh(data.low[data.low.length - 1].value)} to {lakh(data.high[data.high.length - 1].value)}). Dashed: what you put in. Returns are an assumption you type, not a forecast, and real returns arrive unevenly. No tax or inflation is modelled.</p>
    </Rv>
  );
}

function Cagr() {
  const [from, setFrom] = useState('100000');
  const [to, setTo] = useState('250000');
  const [years, setYears] = useState('5');
  const f = toNum(from), t = toNum(to), y = toNum(years);
  const c = f > 0 && t > 0 && y > 0 ? (Math.pow(t / f, 1 / y) - 1) * 100 : null;
  return (
    <Rv className="panel">
      <div className="eyebrow">What was the annual return?</div>
      <div className="grid g3" style={{ marginTop: 14 }}>
        <Field label="Started with" value={from} set={setFrom} prefix="₹" /><Field label="Ended with" value={to} set={setTo} prefix="₹" /><Field label="Years" value={years} set={setYears} />
      </div>
      <div className="disp" style={{ fontSize: 56, margin: '16px 0 4px', color: c !== null && c >= 0 ? 'var(--up)' : 'var(--down)' }}>{c === null ? '—' : `${c > 0 ? '+' : ''}${c.toFixed(1)}%`}</div>
      <p className="muted" style={{ margin: 0 }}>a year, compounded{c !== null && c > 0 ? `. At that rate money doubles in about ${(70 / c).toFixed(1)} years.` : '.'}</p>
    </Rv>
  );
}

function Position() {
  const [capital, setCapital] = useState('1000000');
  const [riskPct, setRiskPct] = useState('1');
  const [entry, setEntry] = useState('500');
  const [stop, setStop] = useState('470');
  const cap = toNum(capital), rp = toNum(riskPct), e = toNum(entry), s = toNum(stop);
  const risk = e - s;
  const qty = risk > 0 && cap > 0 ? Math.floor((cap * rp / 100) / risk) : 0;
  return (
    <Rv className="panel">
      <div className="eyebrow">Position size from your stop</div>
      <div className="grid g4" style={{ marginTop: 14 }}>
        <Field label="Capital" value={capital} set={setCapital} prefix="₹" /><Field label="Risk per trade" value={riskPct} set={setRiskPct} suffix="%" /><Field label="Entry price" value={entry} set={setEntry} prefix="₹" /><Field label="Stop price" value={stop} set={setStop} prefix="₹" />
      </div>
      {risk <= 0 ? <p className="notice" style={{ marginTop: 14 }}>The stop has to be below the entry for a long position.</p> : (
        <>
          <div className="grid g3" style={{ margin: '18px 0 12px' }}>
            <div><div className="eyebrow">Shares</div><div className="disp" style={{ fontSize: 40 }}>{num(qty)}</div></div>
            <div><div className="eyebrow">Position value</div><div className="disp" style={{ fontSize: 40 }}>{lakh(qty * e)}</div><div className="dim num" style={{ fontSize: 12.5 }}>{cap ? ((qty * e / cap) * 100).toFixed(0) : 0}% of capital</div></div>
            <div><div className="eyebrow">If the stop hits</div><div className="disp down" style={{ fontSize: 40 }}>−₹{num(qty * risk, 0)}</div><div className="dim num" style={{ fontSize: 12.5 }}>{((risk / e) * 100).toFixed(1)}% below entry</div></div>
          </div>
          <div className="kv" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>{[1, 2, 3, 4].map((m) => <div key={m}><div className="k">{m}R target</div><div className="v up" style={{ fontSize: 15 }}>₹{num(e + m * risk, 2)}</div><div className="dim num" style={{ fontSize: 12 }}>+₹{num(qty * risk * m, 0)}</div></div>)}</div>
          {qty * e > cap && <p className="notice" style={{ marginTop: 12 }}>This size needs more than your capital. Widen the stop, cut the risk, or take fewer shares.</p>}
        </>
      )}
      <p className="dim" style={{ fontSize: 12.5, margin: '12px 0 0' }}>Arithmetic only: a gap can fill you below the stop, and costs are not included. Position size is your decision.</p>
    </Rv>
  );
}

function Recovery() {
  const [loss, setLoss] = useState('30');
  const l = Math.min(99, toNum(loss));
  const need = l > 0 ? (l / (100 - l)) * 100 : 0;
  return (
    <Rv className="panel">
      <div className="eyebrow">Loss recovery</div>
      <div style={{ maxWidth: 220, marginTop: 14 }}><Field label="After a fall of" value={loss} set={setLoss} suffix="%" /></div>
      <div className="disp" style={{ fontSize: 56, margin: '16px 0 4px', color: 'var(--warn)' }}>+{need.toFixed(0)}%</div>
      <p className="muted" style={{ margin: 0 }}>is what it takes to get back to even. Losses are not symmetrical, which is why every plan here starts from the stop.</p>
    </Rv>
  );
}

export default function Tools() {
  return (
    <>
      <PageHead eyebrow="Tools" title="Small tools," em="honest arithmetic." lede="Calculators for the questions that come up around the research: what a SIP could become, what a return really was, how many shares a stop allows, how deep a hole is. Everything runs in your browser." />
      <section className="wrap">
        <div className="grid g3" style={{ marginBottom: 14 }}>
          {[['/compare/', 'Compare companies', 'Up to four, side by side, with the better value marked and a score profile.'], ['/calendar/', 'Results calendar', 'Who reports in the next 7 to 60 days, largest first.'], ['/watchlist/', 'Watchlist', 'Your names, kept privately in this browser, flagged for results and signals.']].map(([href, t, d]) => (
            <Link key={href} href={href}><Rv className="panel spot" style={{ height: '100%' }}><div className="disp" style={{ fontSize: 28 }}>{t}</div><p className="muted" style={{ margin: '8px 0 0' }}>{d}</p></Rv></Link>
          ))}
        </div>
        <SectionHead title="Calculators" />
        <div className="grid">
          <Sip />
          <div className="grid g2"><Cagr /><Recovery /></div>
          <Position />
        </div>
        <p className="dim" style={{ fontSize: 12.5, marginTop: 18 }}>Information and arithmetic only. Not investment, tax or legal advice.</p>
      </section>
    </>
  );
}
