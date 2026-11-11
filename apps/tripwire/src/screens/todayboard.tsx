import { useEffect, useMemo, useRef, useState } from 'react';
import { setState, useAppState, useSheets } from '../app.tsx';
import type { Row } from '../screen.ts';
import { dayWord, inr, pct, tone } from '../fmt.ts';
import { THRESHOLDS, changeCopy, dismissChange, lastSeen, recordSeen, restoreChange, surface, type SeenChange } from '../sincevisit.ts';
import { livePrice, useLiveSymbols } from '../quotes.ts';
import { reviewDue } from '../store.ts';
import { safeHref, type NewsEvent } from '../newsview.ts';
import { storyTime } from '../newshealth.ts';
import { attention, boardChips, orderBoard } from '../todayboard.ts';
import { Icon } from '../ui.tsx';

/** "Your names" on Today (revamp v2, 11 Nov 2026): a departure board, one row per followed company. Symbol, name, price and the day's change; under it the chips for what
 *  matters (a crossed thesis level, a review due, results, what changed since the last visit, headlines, the paper book). A tap opens the row: the changes with their before and
 *  after (dismiss, undo, basis, as "Since your last visit" had them), the company's own headlines, and the two actions. It replaces the separate "Since your last visit",
 *  "Due for review" and per-company news blocks, so each fact is said once.
 *  The since-visit baseline is read once, when the board mounts, so what this visit records can never hide what it reports; the record is written only after the board has been
 *  on screen for three seconds (the rule sincevisit.ts and tests/today.mjs pin). */
export function NamesBoard({ rows, day, today, newsBySym, inBook }: { rows: Row[]; day: string | null; today: string; newsBySym: Record<string, NewsEvent[]>; inBook: ReadonlySet<string> }) {
  const s = useAppState(); const { open } = useSheets();
  const baseline = useRef(lastSeen(s)); const sawAt = useRef<string | null>(null);
  const [showDis, setShowDis] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [last, setLast] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const q = useLiveSymbols(s.follows, s.follows.length > 0);
  const live = useMemo(() => Object.fromEntries(s.follows.map((sym) => { const r = rows.find((x) => x.sym === sym); const lp = r ? livePrice(r, q.data?.quotes[sym] ?? null) : null; return [sym, lp?.fromQuote && lp.live ? lp.px : null]; })), [q.data, rows, s.follows.join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const sv = useMemo(() => surface(s, baseline.current, rows, day, today, nowIso, live), [s.follows, s.entries, s.inbox, s.dismissed, rows, day, today, live, nowIso]);   // eslint-disable-line react-hooks/exhaustive-deps
  // record what was shown once the board has been visible for 3 s (page visible, at least half of it, or 240px of it, on screen)
  const box = useRef<HTMLElement>(null); const latest = useRef({ rows, day, fresh: sv.fresh, today }); latest.current = { rows, day, fresh: [...sv.fresh, ...sv.dismissed], today };
  useEffect(() => {
    const el = box.current; if (!el || !day || !rows.length || !s.follows.length || sawAt.current === day) return;
    let timer = 0; let inView = false;
    const arm = () => { window.clearTimeout(timer); if (inView && document.visibilityState === 'visible') timer = window.setTimeout(() => { sawAt.current = latest.current.day; const l = latest.current; setState((x) => recordSeen(x, l.rows, l.day, l.fresh, new Date().toISOString(), l.today)); }, THRESHOLDS.visibleMs); };
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((e) => { const x = e[e.length - 1]; inView = !!x && x.isIntersecting && (x.intersectionRatio >= 0.5 || x.intersectionRect.height >= 240); arm(); }, { threshold: [0, 0.25, 0.5, 1] }) : null;
    if (io) io.observe(el); else inView = true;
    document.addEventListener('visibilitychange', arm); arm();
    return () => { window.clearTimeout(timer); io?.disconnect(); document.removeEventListener('visibilitychange', arm); };
  }, [day, rows.length, s.follows.join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  const dismiss = (c: SeenChange) => { setState((x) => dismissChange(x, c.id, new Date().toISOString())); setLast(c.id); setMsg(`Dismissed ${c.sym}: ${c.title}.`); };
  const undo = () => { if (last) setState((x) => restoreChange(x, last)); setMsg(last ? 'Restored.' : null); setLast(null); };
  const changes = [...sv.fresh, ...sv.earlier];
  const nowMs = useMemo(() => Date.now(), [newsBySym]);   // eslint-disable-line react-hooks/exhaustive-deps

  const board = orderBoard(s.follows.map((sym) => {
    const r = rows.find((x) => x.sym === sym) ?? null; const mine = changes.filter((c) => c.sym === sym); const news = newsBySym[sym] ?? [];
    const entry = s.entries.find((e) => e.sym === sym && !e.archived) ?? null; const due = entry ? reviewDue(entry, today) : null; const review = due === 'overdue' || due === 'today' ? due : null;
    const chips = boardChips({ sym, changes: mine, news, review, inBook: inBook.has(sym), nextResults: r?.next_earnings ?? null, today });
    return { sym, r, mine, news, entry, chips, score: attention({ changes: mine, news, review }) };
  }), s.follows);

  const item = (c: SeenChange, dis = false) => { const copy = changeCopy(c, today); return <li key={c.id} className="svi">
    <div className="svi-h">{dis && <a className="sym" href={`#/c/${c.sym}`}>{c.sym}</a>}<span className="svi-t">{copy.title}</span>{!dis && sv.fresh.includes(c) ? <span className="svi-new">New</span> : null}</div>
    <div className="svi-ba num">{copy.detail}</div>
    {c.kind === 'invalidation' && <div className="small svi-inv">{c.framing.charAt(0).toUpperCase() + c.framing.slice(1)}</div>}
    <details className="svi-basis"><summary>Basis · {dayWord(c.curDay)}</summary><p className="small dim">{c.basis}</p></details>
    <div className="row svi-act">{dis ? <button className="btn sm" onClick={() => { setState((x) => restoreChange(x, c.id)); setMsg(`Restored ${c.sym}: ${c.title}.`); setLast(null); }}>Restore</button>
      : <>{c.kind === 'invalidation' && c.entryId && <button className="btn sm" onClick={() => open({ k: 'thesis', sym: c.sym, id: c.entryId! })}>Review thesis</button>}<button className="btn sm" onClick={() => dismiss(c)} aria-label={`Dismiss ${c.sym}: ${copy.title}`}>Dismiss</button></>}</div></li>; };

  return <section ref={box} className="tsec board sv" aria-labelledby="bd-h" data-sec="changes">
    <div className="row between sechead"><h2 id="bd-h" className="sec">Your names</h2><span className="small mute num">{s.follows.length} followed</span></div>
    <ul className="board-list" aria-label="Companies you follow">
      {board.map(({ sym, r, mine, news, entry, chips }) => {
        const lp = r ? livePrice(r, q.data?.quotes[sym] ?? null) : null; const isOpen = opened === sym; const pid = `br-${sym}`; const ch = lp?.ch ?? null;
        return <li key={sym} className={`br${isOpen ? ' open' : ''}${mine.some((c) => sv.fresh.includes(c)) ? ' has-new' : ''}`} data-board-row={sym}>
          <button type="button" className="br-hit" aria-expanded={isOpen} aria-controls={pid} onClick={() => setOpened(isOpen ? null : sym)}>
            <span className="br-id"><b className="br-sym">{sym}</b><span className="br-name">{r?.name ?? 'Not in the screen'}</span></span>
            <span className="br-px num"><b>{lp?.px != null ? inr(lp.px) : '—'}</b><span className={`br-ch ${tone(ch)}`}>{ch == null ? '—' : <><span aria-hidden="true">{ch > 0 ? '▲' : ch < 0 ? '▼' : '■'}</span> {pct(ch)}</>}</span></span>
            {chips.length > 0 && <span className="br-chips">{chips.map((c) => <span key={c.id} className={`br-chip ${c.tone}`}>{c.text}</span>)}</span>}
            <span className="br-chev" aria-hidden="true"><Icon n="chev" /></span>
          </button>
          <div className="br-panel" id={pid} role="region" aria-label={`${sym}: changes, headlines and actions`}><div className="br-inner">
            {mine.length > 0 && <><p className="br-k" aria-hidden="true">Since your last visit</p><ul className="svevents" aria-label={`What changed in ${sym}`}>{mine.map((c) => item(c))}</ul></>}
            {news.length > 0 && <p className="br-k" aria-hidden="true">Headlines</p>}
            {news.length > 0 ? <ul className="br-news" aria-label={`Headlines naming ${sym}`}>{news.map((ev) => { const h = safeHref(ev.canonicalUrl); const t = storyTime(ev.publishedAt, nowMs); return <li key={ev.eventClusterId}>
              {h ? <a href={h} target="_blank" rel="noopener noreferrer">{ev.headline}<span className="sr"> (opens in a new tab)</span></a> : <span>{ev.headline}</span>}
              <span className="small mute">{ev.sourceTitle} · <time dateTime={ev.publishedAt ?? undefined} title={t.ist}>{t.ageWord}</time></span></li>; })}</ul>
              : <p className="small mute br-quiet">No verified headline names {sym} in the last three days.</p>}
            <div className="row br-act"><a className="btn sm" href={`#/c/${sym}`}>Open company</a>{entry && <button type="button" className="btn sm" onClick={() => open({ k: 'thesis', sym, id: entry.id })}>Review thesis</button>}</div>
          </div></div>
        </li>; })}
    </ul>
    {sv.first ? <p className="small dim board-note" role="status" data-sv="first"><b>Tracking starts today.</b> From your next visit, meaningful changes in {s.follows.length === 1 ? 'this company' : `these ${s.follows.length} companies`} show on their rows, with the figures before and after.</p>
      : changes.length ? <p className="small mute board-note" data-sv="basis">Changes are against what you were last shown{sv.dayFrom ? <>: screen data {dayWord(sv.dayFrom)} to {dayWord(sv.dayTo)}.</> : <>, screen data {dayWord(day)} (no newer screen yet).</>}</p>
        : <p className="small mute board-note" data-sv="none">Nothing meaningful changed in the {sv.compared === 1 ? 'company' : `${sv.compared} companies`} you follow since you last looked.</p>}
    {sv.starting.length > 0 && !sv.first && <p className="small mute board-note" data-sv="starting">Tracking starts today for {sv.starting.join(', ')}.</p>}
    <div role="status" className="svmsg">{msg && <span className="small">{msg} {last && <button className="linkbtn" onClick={undo}>Undo</button>}</span>}</div>
    {sv.dismissed.length > 0 && <><button className="linkbtn" onClick={() => setShowDis(!showDis)} aria-expanded={showDis}>{showDis ? 'Hide dismissed' : `Show dismissed (${sv.dismissed.length})`}</button>
      {showDis && <ul className="svlist dis" aria-label="Dismissed changes">{sv.dismissed.map((c) => item(c, true))}</ul>}</>}
  </section>;
}

/** Nothing followed yet: one line and one action. */
export function NamesEmpty() {
  const { open } = useSheets();
  return <section className="tsec board board-empty" aria-labelledby="bd-h" data-sec="changes">
    <h2 id="bd-h" className="sec">Your names</h2>
    <div className="card board-empty-card"><p className="small dim">Follow a company and its price, changes and headlines line up here.</p><button className="btn pri" onClick={() => open({ k: 'search' })}><Icon n="search" />Find a company</button></div>
  </section>;
}
