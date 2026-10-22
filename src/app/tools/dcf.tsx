'use client';
/* Reverse DCF (T05): a teaching model. Start from today's price and solve for the earnings growth it needs. The inputs are
   checked in words (dcfCheck: terminal growth must sit below the required return), and the model's material limitations sit
   beside the answer, not under the table. Arithmetic lives in ./math (impliedGrowth, tested). */
import { useState } from 'react';
import SymbolPicker from '@/components/SymbolPicker';
import { Rv, StatusChip } from '@/components/ui';
import { useFeed } from '@/lib/data';
import { dash, dateLabel, num, pct, ratio } from '@/lib/format';
import { isLender } from '@/lib/sector';
import { dcfCheck, impliedGrowth } from './math';
import { Stepper, toNum } from './calc';

const has = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n);

export function ReverseDcf() {
  const s = useFeed('screen');
  const [sym, setSym] = useState('TCS');
  const [rate, setRate] = useState('12');
  const [yrs, setYrs] = useState('10');
  const [tg, setTg] = useState('5');
  const r = s.data?.rows.find((x) => x.sym === sym);
  const rateN = toNum(rate), yrsN = toNum(yrs), tgN = toNum(tg);
  const err = dcfCheck(rateN, tgN, yrsN);
  const valid = Object.keys(err).length === 0;
  const eps = r && has(r.pe) && r.pe > 0 && has(r.price) && r.price > 0 ? r.price / r.pe : null;
  const g = valid && r && eps !== null ? impliedGrowth(r.price as number, eps, rateN / 100, yrsN, tgN / 100) : null;
  const lender = r ? isLender(r) : false;
  return (
    <Rv className="panel tool" as="article">
      <div className="tool-h">
        <span className="tool-n" aria-hidden>04</span>
        <div><h3>What growth does today&apos;s price assume?</h3><p>Reverse DCF, <b>a teaching model</b>: instead of guessing the future to get a value, start from the price and solve for the earnings growth it needs.</p></div>
      </div>
      <div className="presets" role="group" aria-label="Scenario">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusChip kind="assumption">Your assumption</StatusChip>
          {([['Conservative', '14', '8', '4'], ['Base', '12', '10', '5'], ['Optimistic', '11', '12', '6']] as const).map(([n, a, b, c]) => <button key={n} type="button" className="chip" aria-pressed={rate === a && yrs === b && tg === c} onClick={() => { setRate(a); setYrs(b); setTg(c); }}>{n}</button>)}
        </div>
        <p className="dim" style={{ fontSize: 12.5, margin: '4px 0 0' }}>Required return, years of growth and terminal growth are your assumptions; the price and EPS are observed.</p>
      </div>
      <div className="tool-grid">
        <div className="tool-in">
          <div className="fld"><span className="fld-l">Company</span><SymbolPicker placeholder={`Company (now ${sym})`} onPick={setSym} /></div>
          <Stepper label="Required return" value={rate} set={setRate} step={0.5} min={0} max={50} suffix="%" error={err.rate ?? null} hint="The yearly return you want for the risk." />
          <Stepper label="Years of growth" value={yrs} set={setYrs} step={1} min={1} max={30} error={err.years ?? null} />
          <Stepper label="Terminal growth" value={tg} set={setTg} step={0.5} min={0} max={10} suffix="%" error={err.terminal ?? null} hint="Growth forever after; it must be below the required return." />
        </div>
        <div className="tool-out" aria-live="polite">
          {s.loading ? <div className="tool-empty" role="status"><span aria-hidden>…</span><p>Loading the screen for prices and earnings.</p></div>
            : !r ? <div className="tool-empty" role="status"><span aria-hidden>?</span><p>{s.error ? 'The screen did not load, so there is no price to work from.' : `${sym} is not in the screen. Pick another company.`}</p></div>
              : !valid ? <div className="tool-empty" role="status"><span aria-hidden>?</span><p>Fix the highlighted field. {err.terminal ?? err.rate ?? err.years}</p></div>
                : eps === null ? <div className="tool-empty" role="status"><span aria-hidden>?</span><p>{r.sym} has no positive trailing P/E, so there are no earnings to discount: a loss or a missing figure, not a zero.</p></div>
                  : (
                    <>
                      <div className="res">
                        <div className="res-main"><span className="k">Growth the price needs</span><span className="v num">{g === null ? 'outside −30% to 80%' : `${pct(g * 100, 1, false)} a year`}</span><span className="s">for {yrsN} years, then {tgN}% forever, at a {rateN}% required return</span></div>
                        <div><span className="k">{r.sym} price · EPS</span><span className="v2 num">₹{num(r.price, 2)} · ₹{num(eps, 2)}</span><span className="s"><StatusChip kind="observed">Observed</StatusChip> screen close {r.last_date ? dateLabel(r.last_date) : 'date not stated'}, P/E {ratio(r.pe, 1)}</span></div>
                        <div><span className="k">What EPS actually did</span><span className="v2 num">{has(r.eps_cagr) ? `${pct(r.eps_cagr, 1, false)} a year` : dash}</span><span className="s">{has(r.eps_cagr) ? (g !== null ? (r.eps_cagr >= g * 100 ? 'Past growth exceeds the implied rate. The future may differ.' : `The price needs ${num(g * 100 - r.eps_cagr, 1)} points more than EPS delivered.`) : '3-year compound') : 'EPS history not in the screen'}</span></div>
                      </div>
                      <div className="tool-limits" role="note">
                        <b>What this model leaves out</b>
                        <ul>
                          <li>EPS is price ÷ trailing P/E: one year, so a one-off gain or loss flows straight into the answer.</li>
                          <li>It discounts earnings, not cash: reinvestment, debt and cash on the balance sheet are not in it.</li>
                          <li>The answer swings with the required return and terminal growth you choose; the table below shows how far.</li>
                          {lender && <li><b>{r.sym} is a lender.</b> Its earnings depend on credit costs and capital, which this model does not see; read it with extra caution.</li>}
                        </ul>
                      </div>
                      <div className="tbl-wrap" tabIndex={0} role="region" aria-label="Sensitivity of the implied growth" style={{ maxHeight: 'none', marginTop: 12 }}>
                        <table className="tbl sens" style={{ minWidth: 380 }}>
                          <caption className="eyebrow" style={{ textAlign: 'left', paddingBottom: 6 }}>Growth the price needs, {yrsN} years, by required return and terminal growth</caption>
                          <thead><tr><th scope="col">Required return ↓ · terminal →</th>{[3, 5, 7].map((t) => <th key={t} scope="col" className="num">{t}%</th>)}</tr></thead>
                          <tbody>{[10, 12, 14, 16].map((rr) => (
                            <tr key={rr} style={{ cursor: 'default', background: rr === rateN ? 'var(--panel-2)' : undefined }}><th scope="row" className="num">{rr}%</th>{[3, 5, 7].map((t) => { const x = impliedGrowth(r.price as number, eps, rr / 100, yrsN, t / 100); return <td key={t} className="num">{x === null ? dash : pct(x * 100, 1, false)}</td>; })}</tr>
                          ))}</tbody>
                        </table>
                      </div>
                      <p className="dim" style={{ fontSize: 13, margin: '8px 0 0' }}>A dash means the answer is outside −30% to 80% a year. Arithmetic on your assumptions, not a forecast or a valuation.</p>
                    </>
                  )}
        </div>
      </div>
    </Rv>
  );
}
