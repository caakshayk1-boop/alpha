import { useAppState } from '../app.tsx';
import { useCompany } from '../data.ts';
import { PageBar, Failed, Loading } from './common.tsx';
import { current } from '../store.ts';
import { dayWord, inr, pct, x1 } from '../fmt.ts';
import { Icon } from '../ui.tsx';
import { curateCase, eligibilityOf, meaningful } from '../eligibility.ts';

/** A clean one-page report. "Print" opens the browser's own dialog, which can save a PDF. Only this company's notes are included. */
export function Report({ sym }: { sym: string }) {
  const c = useCompany(sym); const s = useAppState();
  if (c.loading) return <Loading what="the report" />;
  if (!c.data) return <Failed what="the report" err={c.err ?? 'no data'} retry={c.retry} />;
  const r = c.data.row; const el = eligibilityOf(r, c.data.years); const cur = curateCase({ strengths: c.data.swot?.s ?? [], flags: c.data.risk?.flags ?? [], weaknesses: c.data.swot?.w ?? [] }, el); const notes = s.entries.filter((e) => e.sym === sym && !e.archived);
  return <div>
    <PageBar title="Report" onBack right={<button className="icon-btn noprint" onClick={() => window.print()} aria-label="Print or save as PDF"><Icon n="print" /></button>} />
    <h2 style={{ margin: '0 0 4px' }}>{r.name} ({sym})</h2>
    <p className="dim" style={{ margin: 0 }}>Close of {dayWord(r.last_date)} · {inr(r.price)} · {r.sector ?? 'sector not stated'}</p>
    <div className="card" style={{ marginTop: 12 }}><b>Figures</b><p className="num" style={{ margin: '6px 0 0' }}>PE {x1(r.pe)}{meaningful(el, 'roce') ? ` · ROCE (median) ${pct(r.roce_med, 1, false)}` : ''}{meaningful(el, 'leverage') ? ` · Debt/equity ${x1(r.de, 2)}` : ''} · RSI {x1(r.rsi, 0)} · From 52-week high {pct(r.from_high)}</p>{el.notes.map((t) => <p key={t} className="small dim" style={{ margin: '6px 0 0' }}>{t}</p>)}</div>
    <div className="card"><b>Case</b>{cur.strengths.map((x) => <p key={x.t} style={{ margin: '6px 0 0' }}>{x.t} <span className="mute">({x.k})</span></p>)}{!cur.strengths.length && <p className="dim">None listed.</p>}</div>
    <div className="card"><b>Countercase</b>{cur.counters.map((x) => <p key={x.t} style={{ margin: '6px 0 0' }}>{x.t} <span className="mute">({x.k})</span></p>)}{!cur.counters.length && <p className="dim">None listed.</p>}</div>
    {notes.map((e) => { const v = current(e); return <div key={e.id} className="card"><b>Your thesis</b> <span className="mute small">recorded {dayWord(v.at)}</span>
      {([['Thesis', v.thesis], ['Supporting evidence', v.support], ['Counterargument', v.counter], ['Decision', v.decision], ['Wrong if', v.invalidation], ['Review trigger', v.trigger], ['Review date', v.reviewOn ? dayWord(v.reviewOn) : '']] as const).filter(([, t]) => t).map(([l, t]) => <p key={l} style={{ margin: '6px 0 0' }}><span className="mute">{l}: </span>{t}</p>)}</div>; })}
    <p className="small dim">Source: Alpha screen, built {c.data.built_on}. Educational research, not advice. Paper analysis only; no order is placed. Figures can be wrong or late. Generated on this device from your own notes; nothing was uploaded.</p>
  </div>;
}
