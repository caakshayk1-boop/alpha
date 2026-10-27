import { useEffect, useMemo, useRef, useState } from 'react';
import { setState, useAppState, useSheets } from '../app.tsx';
import type { Row } from '../screen.ts';
import { dayWord } from '../fmt.ts';
import { THRESHOLDS, dismissChange, lastSeen, recordSeen, restoreChange, surface, type SeenChange } from '../sincevisit.ts';
import { livePrice, useLiveSymbols } from '../quotes.ts';

const SHOWN = 5;

/** "Since your last visit": changes in the companies you follow against what you were last shown. The baseline is read once, when the module opens, so what this
 *  visit records can never hide what this visit reports; the record is written only after the module has been on screen for three seconds. */
export function SinceVisit({ rows, day, today }: { rows: Row[]; day: string | null; today: string }) {
  const s = useAppState(); const { open } = useSheets();
  const baseline = useRef(lastSeen(s)); const sawAt = useRef<string | null>(null);
  const [all, setAll] = useState(false); const [showDis, setShowDis] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [last, setLast] = useState<string | null>(null);
  const q = useLiveSymbols(s.follows, s.follows.length > 0);
  const live = useMemo(() => Object.fromEntries(s.follows.map((sym) => { const r = rows.find((x) => x.sym === sym); const lp = r ? livePrice(r, q.data?.quotes[sym] ?? null) : null; return [sym, lp?.fromQuote && lp.live ? lp.px : null]; })), [q.data, rows, s.follows.join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const sv = useMemo(() => surface(s, baseline.current, rows, day, today, nowIso, live), [s.follows, s.entries, s.inbox, s.dismissed, rows, day, today, live, nowIso]);   // eslint-disable-line react-hooks/exhaustive-deps
  // record what was shown once it has been visible for 3 s (page visible, module at least half on screen)
  const box = useRef<HTMLElement>(null); const latest = useRef({ rows, day, fresh: sv.fresh, today }); latest.current = { rows, day, fresh: sv.fresh, today };
  useEffect(() => {
    const el = box.current; if (!el || !day || !rows.length || !s.follows.length || sawAt.current === day) return;
    let timer = 0; let inView = false;
    const arm = () => { window.clearTimeout(timer); if (inView && document.visibilityState === 'visible') timer = window.setTimeout(() => { sawAt.current = latest.current.day; const l = latest.current; setState((x) => recordSeen(x, l.rows, l.day, l.fresh, new Date().toISOString(), l.today)); }, THRESHOLDS.visibleMs); };
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((e) => { inView = !!e[0]?.isIntersecting; arm(); }, { threshold: 0.5 }) : null;
    if (io) io.observe(el); else inView = true;
    document.addEventListener('visibilitychange', arm); arm();
    return () => { window.clearTimeout(timer); io?.disconnect(); document.removeEventListener('visibilitychange', arm); };
  }, [day, rows.length, s.follows.join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  const dismiss = (c: SeenChange) => { setState((x) => dismissChange(x, c.id, new Date().toISOString())); setLast(c.id); setMsg(`Dismissed ${c.sym}: ${c.title}.`); };
  const undo = () => { if (last) setState((x) => restoreChange(x, last)); setMsg(last ? 'Restored.' : null); setLast(null); };
  const review = (c: SeenChange) => { if (c.entryId) open({ k: 'thesis', sym: c.sym, id: c.entryId }); else location.hash = `/c/${c.sym}`; };
  const list = [...sv.fresh, ...sv.earlier]; const shown = all ? list : list.slice(0, SHOWN);
  const item = (c: SeenChange, dis = false) => <li key={c.id} className="svi">
    <div className="svi-h"><a className="sym" href={`#/c/${c.sym}`}>{c.sym}</a><span className="svi-t">{c.title}</span>{!dis && sv.fresh.includes(c) ? <span className="svi-new">New</span> : null}</div>
    <div className="svi-ba num"><span>{c.before}</span><span aria-hidden="true"> → </span><span className="sr"> changed to </span><span>{c.after}</span></div>
    <div className={`small ${c.kind === 'invalidation' ? 'svi-inv' : 'dim'}`}>{c.framing.charAt(0).toUpperCase() + c.framing.slice(1)}</div>
    <details className="svi-basis"><summary>Basis</summary><p className="small dim">{c.basis}</p></details>
    <div className="row svi-act">{dis ? <button className="btn sm" onClick={() => { setState((x) => restoreChange(x, c.id)); setMsg(`Restored ${c.sym}: ${c.title}.`); setLast(null); }}>Restore</button>
      : <><button className="btn sm" onClick={() => review(c)}>{c.entryId ? 'Review thesis' : 'Review'}</button><button className="btn sm" onClick={() => dismiss(c)} aria-label={`Dismiss ${c.sym}: ${c.title}`}>Dismiss</button></>}</div></li>;
  return <section ref={box} className="sv" aria-labelledby="sv-h">
    <h2 id="sv-h" className="sec">Since your last visit</h2>
    {sv.first ? <p className="small dim" role="status" data-sv="first"><b>Tracking starts today.</b> From your next visit, meaningful changes in the {s.follows.length === 1 ? 'company' : `${s.follows.length} companies`} you follow will show here, with the figures before and after.</p>
      : <>
        <p className="small dim" data-sv="basis">Against what you were last shown{sv.dayFrom ? <>: screen data {dayWord(sv.dayFrom)} to {dayWord(sv.dayTo)}.</> : <>, screen data {dayWord(day)} (no newer screen yet).</>}</p>
        {list.length ? <ul className="svlist" aria-label="Changes in the companies you follow">{shown.map((c) => item(c))}</ul>
          : <p className="small" data-sv="none">Nothing meaningful changed in the {sv.compared === 1 ? 'company' : `${sv.compared} companies`} you follow.</p>}
        {list.length > SHOWN && <button className="btn sm" onClick={() => setAll(!all)} aria-expanded={all}>{all ? 'Show fewer' : `Show ${list.length - SHOWN} more`}</button>}</>}
    {sv.starting.length > 0 && !sv.first && <p className="small dim" data-sv="starting">Tracking starts today for {sv.starting.join(', ')}.</p>}
    <div role="status" className="svmsg">{msg && <span className="small">{msg} {last && <button className="linkbtn" onClick={undo}>Undo</button>}</span>}</div>
    {sv.dismissed.length > 0 && <><button className="linkbtn" onClick={() => setShowDis(!showDis)} aria-expanded={showDis}>{showDis ? 'Hide dismissed' : `Show dismissed (${sv.dismissed.length})`}</button>
      {showDis && <ul className="svlist dis" aria-label="Dismissed changes">{sv.dismissed.map((c) => item(c, true))}</ul>}</>}
  </section>;
}
