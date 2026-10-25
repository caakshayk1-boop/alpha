import { useEffect, useMemo } from 'react';
import { go, setState, useAppState, useSheets } from '../app.tsx';
import { DotArc, Empty } from '../ui.tsx';
import { Head, Loading, Failed, PageBar, CompanyRow } from './common.tsx';
import { freshness } from '../fresh.ts';
import { breadth } from '../insight.ts';
import { changesSince, istDay, recordSnap, reviewDue, current } from '../store.ts';
import { dayWord, isNum, pct } from '../fmt.ts';
import { useEngines } from '../useEngines.ts';
import { ENGINES } from '../quant.ts';
import type { Row } from '../screen.ts';

export function Today() {
  const s = useAppState(); const { open } = useSheets();
  const { scr, out } = useEngines();
  const rows = scr.data?.rows ?? [];
  const day = scr.data?.as_of ?? null;
  const fr = freshness(day);
  const today = istDay();
  const b = useMemo(() => breadth(rows), [rows]);
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
  // the best pick of each engine, never more than three, skipping names already followed
  const cands = useMemo(() => (out ? out.runs.map((r) => r.picks.find((p) => !s.follows.includes(p.sym))).filter((p): p is NonNullable<typeof p> => !!p) : []), [out, s.follows]);
  const total = out?.picks.length ?? 0;
  const book = s.paper.filter((p) => !p.closedByUser).length;
  const lit = b.pct == null ? 0 : Math.round((b.pct / 100) * 28);
  const next = reviews.length ? { t: `Review ${reviews[0].sym}: your date has come.`, go: () => open({ k: 'thesis', sym: reviews[0].sym, id: reviews[0].id }), cta: 'Open review' }
    : total && !book ? { t: 'The engines have picks tonight. Take one on paper and Tripwire will follow it with real prices.', go: () => go('/signals'), cta: 'See the picks' }
    : !s.entries.length ? { t: 'Write your first thesis, in seven short fields. Everything else gets easier to judge.', go: () => go('/discover'), cta: 'Pick a name' }
    : !s.follows.length ? { t: 'Follow one name so Today can tell you what changed in it.', go: () => go('/discover'), cta: 'Find a name' }
    : { t: 'Nothing is due. Check the paper book against its stops.', go: () => go('/signals?v=tracker'), cta: 'Open the tracker' };

  return <div>
    <PageBar title="Today" sub={day ? <>Data through {dayWord(day)} · <span className={fr.tone === 'lime' ? 'up' : 'down'}>{fr.word}</span></> : 'Loading'} />
    {scr.loading && <Loading what="the market read" />}
    {scr.err && <Failed what="the market data" err={scr.err} retry={scr.retry} />}
    {scr.data && <>
      <section className="card glass" aria-label="Market read">
        <div className="gauge">
          <DotArc lit={lit} label={b.pct == null ? 'Breadth not measured' : `${b.pct.toFixed(0)} percent of liquid stocks closed above their 50-day average`} />
          <div style={{ marginTop: -76, textAlign: 'center', maxWidth: 170 }}>
            <div className="big num">{b.pct == null ? '—' : b.pct.toFixed(0)}<span style={{ fontSize: 18 }}>{b.pct == null ? '' : '%'}</span></div>
            <div className="k" style={{ marginTop: 6, lineHeight: 1.35 }}>liquid stocks above their 50-day average</div>
          </div>
        </div>
        <p className="lead" style={{ marginTop: 18 }}>
          {total ? <><em className="ed">{total}</em> pick{total > 1 ? 's' : ''} from {out!.runs.filter((r) => r.picks.length).length} of {ENGINES.length} engines tonight.</> : <>No engine has a pick <em className="ed">tonight</em>.</>}
        </p>
        <p className="dim small" style={{ margin: '8px 0 0' }}>{b.n} liquid names measured at the close of {dayWord(day)}. Breadth is context, not a switch: the engines run either way, and say so when nothing qualifies.</p>
      </section>

      <div className="card" style={{ marginTop: 10, borderColor: 'var(--line2)' }}>
        <div className="k">One thing to do</div>
        <p style={{ margin: '6px 0 12px', fontSize: 15 }}>{next.t}</p>
        <button className="btn pri" onClick={next.go}>{next.cta}</button>
      </div>

      {book > 0 && <a className="card" href="#/signals?v=tracker" style={{ display: 'flex', marginTop: 10, alignItems: 'center', gap: 10 }}><span className="grow"><span className="k">Paper book</span><span style={{ display: 'block', fontWeight: 650 }}>{book} paper trade{book > 1 ? 's' : ''} being followed</span></span><span className="tag lime">Open tracker</span></a>}

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
      {cands.length ? cands.map((p) => { const r = rows.find((x) => x.sym === p.sym); return r ? <div key={p.sym} className="card"><CompanyRow r={r} />
        <p className="small" style={{ margin: '8px 0 4px' }}><span className="up">{ENGINES.find((e) => e.id === p.engine)!.name}</span> · rank {p.rank} of {ENGINES.find((e) => e.id === p.engine)!.top}, score {p.score}</p>
        <p className="small" style={{ margin: 0 }}><span className="down">Main risk</span> · {p.risk ?? 'not stated'}</p></div> : null; })
        : <Empty title="Nothing qualifies tonight">Each engine publishes only names that pass every one of its filters. When none do, Tripwire shows none.</Empty>}
      <p className="mute small" style={{ marginTop: 8 }}>The top pick of each engine. Starting points to investigate, not recommendations.</p>
    </>}
  </div>;
}
function addDays(d: string, n: number) { return new Date(new Date(d + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10); }
