import { useAppState } from '../app.tsx';
import { useChart, useCompany, useScreen } from '../data.ts';
import { PageBar, Failed, Loading } from './common.tsx';
import { PriceChart } from './PriceChart.tsx';
import { istDay } from '../store.ts';
import { dayWord, inr, pct, x1 } from '../fmt.ts';
import { Icon } from '../ui.tsx';
import { NO_FLAGS_SENTENCE, RISK_SCOPE, curateCase, eligibilityOf, meaningful, riskGradeOf, riskSentence } from '../eligibility.ts';
import { missingEvidence, reportFacts, thesisBlock } from '../reportview.ts';

/** The printable company report: the same page state on paper. "Print" opens the browser's own dialog, which can save a PDF; the print rules (print.css) swap the dark theme for white
 *  paper and ink, hide the app's navigation, and open every disclosure. It holds only this company's data and this device's own note on it; nothing is uploaded and no other person's data is here. */
export function Report({ sym }: { sym: string }) {
  const c = useCompany(sym); const s = useAppState(); const ch = useChart(sym); const scr = useScreen();
  if (c.loading) return <Loading what="the report" />;
  if (!c.data) return <Failed what="the report" err={c.err ?? 'no data'} retry={c.retry} />;
  const r = c.data.row; const years = c.data.years ?? []; const el = eligibilityOf(r, years); const flags = c.data.risk?.flags ?? [];
  const cur = curateCase({ strengths: c.data.swot?.s ?? [], flags, weaknesses: c.data.swot?.w ?? [] }, el); const grade = riskGradeOf(r, el);
  const th = thesisBlock(s.entries.filter((e) => e.sym === sym && !e.archived));
  const feed = ch.data; const through = feed && feed.t.length ? istDay(new Date(feed.t[feed.t.length - 1] * 1000)) : null;
  const miss = ch.loading ? [] : missingEvidence({ row: r, years, inst: c.data.inst, eligibility: el, chart: feed ? { points: feed.t.length, hasNifty: !!feed.n && feed.n.some((v) => v != null), hasVolume: !!feed.v && feed.v.some((v) => v != null) } : null, thesisCount: th.present ? 1 : 0 });
  const facts = reportFacts({ name: r.name, lastDate: r.last_date, price: r.price != null ? inr(r.price) : null, nextEarnings: r.next_earnings, fy: r.fy, builtOn: c.data.built_on, screenAsOf: scr.data?.as_of ?? null, chartThrough: through });
  const printed = dayWord(istDay());
  return <div className="rp" data-report={sym}>
    <PageBar title="Report" onBack right={<button className="icon-btn noprint" onClick={() => window.print()} aria-label="Print or save as PDF"><Icon n="print" /></button>} />
    <header className="rp-head" data-rp="head">
      <h2 className="rp-name">{r.name} <span className="rp-sym">({sym})</span></h2>
      <p className="dim rp-sub">NSE · {r.sector ?? 'sector not stated'}{r.tier ? ` · ${r.tier} cap` : ''}</p>
      <dl className="rp-dates">
        <div><dt>Printed</dt><dd>{printed}</dd></div>
        <div><dt>Data through</dt><dd>{dayWord(r.last_date)}{r.price != null ? ` · close ${inr(r.price)}` : ''}</dd></div>
        <div><dt>Screen built</dt><dd>{dayWord(c.data.built_on)}</dd></div>
      </dl>
      <p className="small rp-disc" data-rp="disclaimer">Paper research only. This is not investment advice and nothing here is an order, a target or a forecast. Figures can be wrong or late.</p>
    </header>

    <section className="rp-sec" data-rp="thesis" aria-label="Your thesis">
      <h3 className="rp-h">Your thesis</h3>
      {th.present ? <div className="card rp-card">
        <p className="mute small" style={{ margin: 0 }}>Recorded {dayWord(th.savedAt)} on this device{th.versions > 1 ? ` · version ${th.versions}; earlier versions are kept, not printed` : ''}{th.others > 0 ? ` · ${th.others} other ${th.others === 1 ? 'entry' : 'entries'} on this company not printed` : ''}</p>
        {th.lines.map((l) => <p key={l.label} className="rp-line" data-rp-field={l.label}><span className="mute">{l.label}: </span>{l.label === 'Review date' ? dayWord(l.text) : l.text}</p>)}
      </div> : <p className="dim small" data-rp-empty="thesis">{th.note} Nothing is shown here that you did not write.</p>}
    </section>

    <section className="rp-sec" data-rp="chart" aria-label="Price chart"><h3 className="rp-h">Price against the Nifty 50</h3><PriceChart sym={sym} name={r.name} report /></section>

    <section className="rp-sec" data-rp="figures" aria-label="Figures">
      <h3 className="rp-h">Figures</h3>
      <div className="card rp-card"><p className="num" style={{ margin: 0 }}>PE {x1(r.pe)}{meaningful(el, 'roce') ? ` · ROCE (median) ${pct(r.roce_med, 1, false)}` : ''}{meaningful(el, 'leverage') ? ` · Debt/equity ${x1(r.de, 2)}` : ''} · RSI {x1(r.rsi, 0)} · From 52-week high {pct(r.from_high)}</p>
        {el.notes.map((t) => <p key={t} className="small dim" style={{ margin: '6px 0 0' }}>{t}</p>)}</div>
    </section>

    <section className="rp-sec" data-rp="risks" aria-label="Material risks">
      <h3 className="rp-h">Material risks</h3>
      <div className="card rp-card">
        {grade.level ? <p style={{ margin: 0 }} data-rp-risk><b>{riskSentence(grade.level, flags.length)}</b>{grade.note ? ` ${grade.note}` : ''}</p> : <p className="dim" style={{ margin: 0 }}>The screen did not grade this company.</p>}
        {cur.counters.length ? <ul className="rp-list">{cur.counters.map((x) => <li key={x.t}>{x.t} <span className="mute">({x.k})</span></li>)}</ul> : <p className="dim" style={{ margin: '8px 0 0' }} data-rp-noflags>{NO_FLAGS_SENTENCE}</p>}
        {!grade.note?.includes('Scope') && <p className="small mute" style={{ margin: '8px 0 0' }}>{RISK_SCOPE}</p>}
      </div>
      <h3 className="rp-h rp-h2">In its favour, as the screen lists it</h3>
      <div className="card rp-card">{cur.strengths.length ? <ul className="rp-list">{cur.strengths.map((x) => <li key={x.t}>{x.t} <span className="mute">({x.k})</span></li>)}</ul> : <p className="dim" style={{ margin: 0 }}>The screen found no strengths clear enough to list. That is not a negative finding.</p>}</div>
    </section>

    <section className="rp-sec" data-rp="facts" aria-label="Key dated facts and sources">
      <h3 className="rp-h">Key dated facts and sources</h3>
      <table className="tbl rp-facts"><thead><tr><th scope="col" style={{ textAlign: 'left' }}>Fact</th><th scope="col" style={{ textAlign: 'left' }}>Date</th><th scope="col" style={{ textAlign: 'left' }}>Source</th></tr></thead>
        <tbody>{facts.map((f) => <tr key={f.label}><th scope="row" style={{ textAlign: 'left', fontWeight: 500 }}>{f.label}<span className="mute"> · {f.value}</span></th><td className="num">{f.date ? dayWord(f.date) : 'not dated'}</td><td className="small">{f.source}</td></tr>)}</tbody></table>
    </section>

    <section className="rp-sec" data-rp="missing" aria-label="Missing evidence">
      <h3 className="rp-h">Missing evidence</h3>
      <p className="small dim" style={{ margin: '0 0 8px' }}>What this app does not hold for {sym}, read from the data that is absent. A gap here is not a finding about the company.</p>
      {ch.loading ? <p className="small mute">Reading the price history…</p> : <ul className="rp-list" data-missing>{miss.map((m, k) => <li key={`${m.id}${k}`} data-missing-id={m.id}><b>{m.label}.</b> {m.detail}</li>)}</ul>}
    </section>

    <p className="small dim rp-foot" data-rp="source">Source: Alpha screen built {dayWord(c.data.built_on)}; prices and statements from Yahoo Finance. Educational research, not advice. Paper analysis only; no order is placed. Generated on this device from your own notes; nothing was uploaded.</p>
  </div>;
}
