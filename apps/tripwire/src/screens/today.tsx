import { useMemo } from 'react';
import { go, setState, useAppState, useSheets } from '../app.tsx';
import { useScreen, useSignals } from '../data.ts';
import { DotArc, Empty } from '../ui.tsx';
import { Head, Loading, Failed, PageBar, CompanyRow } from './common.tsx';
import { freshness } from '../fresh.ts';
import { breadth } from '../insight.ts';
import { RULES, runRules } from '../../../../src/lib/rules.ts';
import { changesSince, istDay, recordSnap, reviewDue, current } from '../store.ts';
import { dayWord, isNum, pct } from '../fmt.ts';
import { useEffect } from 'react';
import type { Row } from '../screen.ts';

const CAND = ['aligned', 'rs-leader', 'pullback', 'near-high'];
export function Today() {
  const s = useAppState(); const { open } = useSheets();
  const scr = useScreen(); const sig = useSignals();
  const rows = scr.data?.rows ?? [];
  const day = scr.data?.as_of ?? null;
  const fr = freshness(day);
  const today = istDay();
  const b = useMemo(() => breadth(rows), [rows]);
  const board = useMemo(() => (rows.length ? runRules(rows as never) : null), [rows]);
  // one snapshot per data day for each followed name: this is what makes "since you last looked" honest
  useEffect(() => {
    if (!day) return;
    for (const sym of s.follows) { const r = rows.find((x) => x.sym === sym); if (r) setState((x) => recordSnap(x, sym, { day, px: r.price ?? null, rsi: r.rsi ?? null, rs3m: r.rs3m ?? null, from_high: r.from_high ?? null })); }
  }, [day, rows, s.follows.join()]);   // eslint-disable-line react-hooks/exhaustive-deps
  const changes = useMemo(() => {
    if (!day) return [];
    const now: Record<string, { day: string; px: number | null; rsi: number | null; rs3m: number | null; from_high: number | null }> = {};
    for (const sym of s.follows) { const r = rows.find((x) => x.sym === sym); if (r) now[sym] = { day, px: r.price ?? null, rsi: r.rsi ?? null, rs3m: r.rs3m ?? null, from_high: r.from_high ?? null }; }
    return changesSince(s, now);
  }, [s.follows, s.snaps, rows, day]);
  const events = s.follows.map((sym) => rows.find((r) => r.sym === sym)).filter((r): r is Row => !!r && !!r.next_earnings && r.next_earnings >= today && r.next_earnings <= addDays(today, 30)).sort((a, b) => a.next_earnings!.localeCompare(b.next_earnings!));
  const reviews = s.entries.filter((e) => ['overdue', 'today'].includes(reviewDue(e) ?? ''));
  const cands = useMemo(() => {
    if (!board) return [];
    const seen = new Set<string>(); const out: { r: Row; why: string; risk: string }[] = [];
    for (const id of CAND) {
      const res = board.results.find((x) => x.rule.id === id); if (!res || res.wide) continue;
      for (const h of res.hits) {
        const r = rows.find((x) => x.sym === h.sym); if (!r || seen.has(r.sym) || r.risk_lvl === 'HIGH' || s.follows.includes(r.sym)) continue;
        if (s.prefs.interests.length && r.sector && !s.prefs.interests.includes(r.sector) && out.length < 1) continue;
        seen.add(r.sym); out.push({ r, why: `${res.rule.title}: ${res.rule.check}`, risk: r.risk_top ?? `Screen risk grade ${r.risk_lvl ?? 'not graded'}. Open the countercase before anything else.` });
        break;
      }
      if (out.length >= 3) break;
    }
    return out;
  }, [board, rows, s.follows, s.prefs.interests]);
  const g = sig.data?.gate;
  const lit = b.pct == null ? 0 : Math.round((b.pct / 100) * 28);
  const next = reviews.length ? { t: `Review ${reviews[0].sym}: your date has come.`, go: () => open({ k: 'thesis', sym: reviews[0].sym, id: reviews[0].id }), cta: 'Open review' }
    : !s.entries.length ? { t: 'Write your first thesis, in seven short fields. Everything else gets easier to judge.', go: () => go('/discover'), cta: 'Pick a name' }
    : !s.follows.length ? { t: 'Follow one name so Today can tell you what changed in it.', go: () => go('/discover'), cta: 'Find a name' }
    : { t: 'Nothing is due. Check whether any of your invalidation levels is close.', go: () => go('/desk'), cta: 'Open My Desk' };

  return <div>
    <PageBar title="Today" sub={day ? <>Data through {dayWord(day)} · <span className={fr.tone === 'lime' ? 'up' : 'down'}>{fr.word}</span></> : 'Loading'} />
    {scr.loading && <Loading what="the market read" />}
    {scr.err && <Failed what="the market data" err={scr.err} retry={scr.retry} />}
    {scr.data && <>
      <section className="card glass" aria-label="Market read">
        <div className="gauge">
          <DotArc lit={lit} label={b.pct == null ? 'Breadth not measured' : `${b.pct.toFixed(0)} percent of liquid stocks closed above their 50-day average`} />
          <div style={{ marginTop: -86, textAlign: 'center', maxWidth: 190 }}>
            <div className="big num">{b.pct == null ? '—' : b.pct.toFixed(0)}<span style={{ fontSize: 22 }}>{b.pct == null ? '' : '%'}</span></div>
            <div className="k" style={{ marginTop: 6, lineHeight: 1.35 }}>liquid stocks above their 50-day average</div>
          </div>
        </div>
        <p className="lead" style={{ marginTop: 18 }}>
          {g ? <>The market gate is <em className="ed">{g.on ? 'on' : 'off'}</em>: {g.passed} of {g.checks.length} conditions pass{g.on ? '.' : ', so the swing rules file nothing.'}</> : <>Gate status is <em className="ed">unavailable</em> right now.</>}
        </p>
        <p className="dim small" style={{ margin: '8px 0 0' }}>{b.n} liquid names measured. Sources: Alpha screen (last close), swing gate{sig.data ? `, data through ${dayWord(sig.data.data_through)}` : ''}. Holidays are not modelled in the freshness check.</p>
        {g && !g.on && <details className="ev"><summary>What is not met<Chev /></summary><div className="body">{g.checks.filter((c) => !c.ok).map((c) => <p key={c.rule} style={{ margin: '0 0 8px' }}>{c.rule}<br /><span className="mute small">{c.value}</span></p>)}</div></details>}
      </section>

      <div className="card" style={{ marginTop: 10, borderColor: 'var(--line2)' }}>
        <div className="k">One thing to do</div>
        <p style={{ margin: '6px 0 12px', fontSize: 16 }}>{next.t}</p>
        <button className="btn pri" onClick={next.go}>{next.cta}</button>
      </div>

      <Head>Since you last looked</Head>
      {!s.follows.length ? <Empty title="You follow nothing yet">Follow a name and Tripwire will report what moved, from your second visit on.</Empty>
        : changes.length ? <div className="card"><div className="list">{changes.map((c) => <a key={c.sym} className="li" href={`#/c/${c.sym}`}><span className="avatar">{c.sym.slice(0, 2)}</span><span className="grow"><span className="sym">{c.sym}</span><span className="dim small" style={{ display: 'block' }}>{[c.crossed.join(', '), isNum(c.pxPct) ? `${pct(c.pxPct)} since ${dayWord(c.since)}` : ''].filter(Boolean).join(' · ')}</span></span></a>)}</div></div>
        : <div className="card dim">Nothing material in {s.follows.length} followed name{s.follows.length > 1 ? 's' : ''} against the last stored day. Quiet is a result.</div>}

      {(reviews.length > 0 || events.length > 0) && <><Head>Coming up</Head>
        <div className="card"><div className="list">
          {reviews.map((e) => <button key={e.id} className="li" style={{ textAlign: 'left', width: '100%' }} onClick={() => open({ k: 'thesis', sym: e.sym, id: e.id })}><span className="tag peach">{reviewDue(e) === 'overdue' ? 'Overdue' : 'Today'}</span><span className="grow"><span className="sym">{e.sym}</span><span className="dim small trunc" style={{ display: 'block' }}>Review: {current(e).trigger || current(e).thesis}</span></span></button>)}
          {events.map((r) => <a key={r.sym} className="li" href={`#/c/${r.sym}`}><span className="tag">{dayWord(r.next_earnings)}</span><span className="grow"><span className="sym">{r.sym}</span><span className="dim small" style={{ display: 'block' }}>Results, estimated date</span></span></a>)}
        </div></div></>}

      <Head aside={<span className="tag">{cands.length} of 3</span>}>Worth a look</Head>
      {cands.length ? cands.map((c) => <div key={c.r.sym} className="card"><CompanyRow r={c.r} />
        <p className="small" style={{ margin: '8px 0 4px' }}><span className="up">Why it came up</span> · {c.why}</p>
        <p className="small" style={{ margin: 0 }}><span className="down">Main risk</span> · {c.risk}</p></div>)
        : <Empty title="No names qualify today">Starting points come from narrow public rules on liquid names with a risk grade below HIGH. When none fit, Tripwire shows none.</Empty>}
      <p className="mute small" style={{ marginTop: 8 }}>Starting points to investigate, not recommendations. Rules: {RULES.filter((r) => CAND.includes(r.id)).map((r) => r.title).join('; ')}.</p>
    </>}
  </div>;
}
const Chev = () => <span className="chev" aria-hidden="true">▾</span>;
function addDays(d: string, n: number) { return new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10); }
