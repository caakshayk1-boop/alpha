'use client';
/** Today (brief Part I §4): an overview that takes one minute. In order: the masthead; a two-column lead (the market read and
 *  what changed in the names you follow); a quiet market strip; at most three ideas worth investigating, each with one reason
 *  and one limitation; results coming up; and one row of previews that link to the pages owning the detail. Every block reads
 *  a feed the site already publishes, through the same shared computations as the pages it previews. Nothing is estimated. */
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Chg, LazyMount, Skel } from '@/components/ui';
import { FreshnessPill, useDatasetStatus } from '@/components/DataStamp';
import { MarketClock } from '@/components/MarketClock';
import { dayLabel, useToday } from '@/components/widgets/DayContext';
import { IndexStrip } from '@/components/widgets/IndexStrip';
import { stageWords } from '@/lib/barometer';
import { useFeedWhen, useRotation, useShard, useSignals, useSummary } from '@/lib/data';
import { dateLabel, num } from '@/lib/format';
import { rankIdeas, upcomingResults } from '@/lib/ideas';
import { priceView } from '@/lib/price';
import { diffSnapshot, readSnapshots, saveSnapshot, snapshotOf, type Snapshot } from '@/lib/review';
import { rotationShift } from '@/lib/rotationShift';
import { sessionHead } from '@/lib/session';
import { companyHref } from '@/lib/slug';
import { useStoredList } from '@/lib/store';
import { takeaway } from '@/lib/takeaway';
import { istHM } from '@/lib/today';
import { useBarometer } from '@/lib/useBarometer';

const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** 1. Date, session state and the one freshness indicator. */
export function Masthead() {
  const baro = useBarometer();
  const today = useToday();
  const day = today?.day ?? null;
  const head = sessionHead(day?.session ?? baro.view?.session ?? null, today?.live.snap ?? null);
  const [date, ...state] = (head ?? '').split(' · ');
  return (
    <div className="wrap mast">
      <div className="mast-date">{head ? <>{date}{state.length > 0 && <span> · {state.join(' · ')}</span>}</> : <span>Today</span>}</div>
      <div className="mast-r"><span className="show-sm"><FreshnessPill /></span><span className="today-clock"><MarketClock /></span></div>
    </div>
  );
}

/** 2a. The market read: one sentence, what drives it, and how it moved since the previous published reading (H01, H02, H04). */
export function MarketRead() {
  const baro = useBarometer();
  const sum = useSummary();
  const today = useToday();
  const v = baro.view, r = v?.reading ?? null;
  const b200 = sum.data?.above200 ?? null;
  const prev = v?.previous ?? null;
  const tk = useMemo(() => (v && r ? takeaway({ score: r.score, band: r.band.t, stage: r.stage?.t ?? null, nifty: r.nifty, drawdownPct: r.drawdownPct, vix: r.vix, asOf: v.session, above200: b200?.above ?? null, with200: b200?.withHistory ?? null, previous: prev }) : null), [v, r, b200, prev]);
  const day = today?.day ?? null;
  const stamp = v ? (v.source === 'live' && v.at ? `live ${istHM(v.at)} IST` : `${dateLabel(v.session)} close`) : null;
  const [lead, ...rest] = (tk?.headline ?? '').replace(/\.$/, '').split(', ');
  const delta = (a: number | null | undefined, b: number | null | undefined, unit: string, dp = 1) => (typeof a === 'number' && typeof b === 'number' ? `${b > a ? '+' : b < a ? '−' : '±'}${num(Math.abs(b - a), dp)}${unit}` : null);
  return (
    <div className="mread">
      {tk?.available ? (
        <h1 className="lead-h">{lead}{rest.length > 0 && <>, <em>{rest.join(', ')}</em></>}.</h1>
      ) : baro.error ? <h1 className="lead-h">The market read is not available right now.</h1> : (
        <div role="status" aria-busy="true" aria-label="Loading the market read"><h1 className="lead-h"><span className="skel" style={{ display: 'block', height: '1.1em', width: '82%' }} aria-hidden /></h1></div>
      )}
      <p className="lead-sub">{tk?.available ? tk.sub : baro.error ? 'The Barometer could not be loaded. Nothing is estimated in its place.' : ' '}</p>

      <section className="card" aria-labelledby="baro-h">
        <div className="card-h">
          <h2 id="baro-h">Market barometer{r ? <> · <span className="num">{r.score}</span><span className="dim" style={{ fontWeight: 500 }}> / 100</span></> : null}</h2>
          <Link className="more" href="/brief/">The brief →</Link>
        </div>
        {r ? (
          <>
            <p className="dim" style={{ margin: '-4px 0 14px', fontSize: 13 }}>{r.band.t}{prev ? `, ${r.score > prev.score ? 'up' : r.score < prev.score ? 'down' : 'unchanged'} from ${prev.score} on ${dateLabel(prev.date)}` : ''} · {stamp}{r.stage ? ` · price stage: ${stageWords(r.stage.k)}` : ''}</p>
            {r.parts.length > 0 ? (
              <ul className="fx-list" aria-label="What makes up the reading">
                {r.parts.map((p) => (
                  <li key={p.key}>
                    <span className="f-l"><b>{p.label} <em className="f-w">weight {p.weight}</em></b><span title={p.detail}>{p.detail}</span></span>
                    <span className="f-bar" aria-hidden><i style={{ width: `${Math.max(0, Math.min(100, p.score))}%` }} /></span>
                    <span className="f-v">{Math.round(p.score)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="dim" style={{ margin: 0 }}>The factor breakdown is not in this reading.</p>}
            {prev && (prev.drawdownPct !== undefined || prev.vix !== undefined) && (
              <p className="card-foot">Since {dateLabel(prev.date)}: Nifty drawdown {delta(prev.drawdownPct, r.drawdownPct, ' pts') ?? 'n/a'}, India VIX {delta(prev.vix, r.vix, '') ?? 'n/a'}, stocks above their 200-day {delta(prev.above200Pct, r.above200Pct, ' pts') ?? 'n/a'}.</p>
            )}
          </>
        ) : baro.error ? <div className="state"><b>The Barometer did not load.</b><p>Nothing is estimated in its place. The market strip below has the index levels.</p></div> : <Skel h={180} />}
      </section>

      {day && day.counted > 0 && (
        <p className="mread-breadth dim">
          {dayLabel(day, today?.live.snap ?? null)}: <b className="up num">{num(day.up)}</b> of {num(day.counted)} priced stocks rose, <b className="down num">{num(day.down)}</b> fell.
          {b200 && <> At the {sum.data?.as_of ? dateLabel(sum.data.as_of) : 'last'} close, {num(b200.above)} of the {num(b200.withHistory)} with a 200-day history sat above that average (the screen&apos;s count; the Barometer&apos;s factor above is its own job&apos;s count over every priced name, so the two can differ).</>}
        </p>
      )}
    </div>
  );
}

/** 2b. The names you follow: today's move and what changed since you last marked each one reviewed (brief §7.1). */
export function YourNames() {
  const [watch] = useStoredList('alpha-watchlist');
  const [snaps, setSnaps] = useState<Record<string, Snapshot>>({});
  useEffect(() => { const read = () => setSnaps(readSnapshots()); read(); window.addEventListener('alpha-reviewed', read); return () => window.removeEventListener('alpha-reviewed', read); }, []);
  const shown = watch.slice(0, 6);
  return (
    <section className="card" aria-labelledby="yours-h">
      <div className="card-h"><h2 id="yours-h">Your names</h2>{watch.length > 0 && <Link className="more" href="/desk/">My Desk →</Link>}</div>
      {watch.length === 0 ? (
        <div className="state">
          <b>Follow a company to see what changes.</b>
          <p>Watch one name you already know. Its move, its results date and anything that changes since you last reviewed it will show here. Kept in this browser only.</p>
          <div className="acts">
            <button type="button" className="act primary" onClick={() => window.dispatchEvent(new Event('alpha:search'))}>Find a company</button>
            <Link className="act" href="/screen/">Browse the screen</Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="rows">{shown.map((s) => <li key={s}><NameRow sym={s} snap={snaps[s] ?? null} /></li>)}</ul>
          {watch.length > shown.length && <p className="card-foot">{watch.length - shown.length} more on <Link className="link" href="/desk/">My Desk</Link>.</p>}
        </>
      )}
    </section>
  );
}

function NameRow({ sym, snap }: { sym: string; snap: Snapshot | null }) {
  const sh = useShard(sym);
  const today = useToday();
  const r = sh.data?.row ?? null;
  const pv = r ? priceView(sym, r, today?.live.snap ?? null) : null;
  const changes = useMemo(() => (r && snap ? diffSnapshot(snap, r) : []), [r, snap]);
  const now = istToday();
  const soon = r?.next_earnings && r.next_earnings >= now && Date.parse(r.next_earnings) - Date.parse(now) <= 14 * 864e5 ? r.next_earnings : null;
  const fact = !r ? null
    : snap ? (changes.length ? `${changes.length} change${changes.length > 1 ? 's' : ''} since you reviewed on ${dateLabel(snap.at.slice(0, 10))}: ${changes.slice(0, 2).map((c) => `${c.field.toLowerCase()} ${c.from} → ${c.to}`).join('; ')}` : `No change in its figures since you reviewed on ${dateLabel(snap.at.slice(0, 10))}`)
      : soon ? `Results date on file: ${dateLabel(soon)} (not confirmed)` : 'No review baseline yet: mark it reviewed to track changes';
  return (
    <div className="row yrow">
      <Link href={companyHref(sym)} style={{ minWidth: 0 }}>
        <div className="row-t">{sym}</div>
        <div className="row-s">{sh.error ? 'Not in the screened universe' : fact ?? 'Loading…'}</div>
      </Link>
      <div className="row-r">
        {pv?.price != null ? <><Chg v={pv.pct} /><small>₹{num(pv.price, 2)}{pv.source === 'close' ? ` · ${dateLabel(pv.session)} close` : ''}</small></> : sh.loading ? <Skel h={16} w={60} /> : <small>no price</small>}
        {r && <button type="button" className="act quiet yrow-rev" onClick={() => saveSnapshot(sym, snapshotOf(r, new Date().toISOString()))} aria-label={`Mark ${sym} reviewed now`}>{snap ? 'Reviewed' : 'Mark reviewed'}</button>}
      </div>
    </div>
  );
}

/** 3. The quiet market strip: the existing strip, each value with its own last-trade time. */
export function MarketStrip() {
  return <IndexStrip />;
}

/** 4. At most three ideas: one reason, one limitation, a link to the evidence. Same ranking and check count as Tools (A03). */
export function WorthInvestigating() {
  return (
    <section className="wrap section2" aria-labelledby="ideas-h">
      <div className="card-h">
        <div><h2 id="ideas-h" className="sec-title">Worth investigating</h2><p className="sec-sub">Where several of Alpha&apos;s nine checks agree. A place to start reading, not a recommendation.</p></div>
        <Link className="more" href="/tools/#confluence">The full board →</Link>
      </div>
      <LazyMount minHeight={260}><IdeasBody /></LazyMount>
    </section>
  );
}
function IdeasBody() {
  const s = useFeedWhen('screen', true);
  const eng = useSignals();
  const out = useMemo(() => (s.data ? rankIdeas(s.data.rows, eng.data?.signals ?? [], !!eng.data?.alertable, 3) : null), [s.data, eng.data]);
  if (s.error) return <div className="state"><b>The screen did not load.</b><p>No ideas are shown in its place. <Link className="link" href="/screen/">Open the screen</Link> to try again.</p></div>;
  if (!out) return <div className="ideas" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="idea"><Skel h={22} w="40%" /><Skel h={60} /><Skel h={40} /></div>)}</div>;
  if (!out.ideas.length) return <div className="state"><b>No liquid company passes enough checks today.</b><p>That is the rule working. <Link className="link" href="/screen/">Browse the screen</Link> instead.</p></div>;
  return (
    <>
      <div className="ideas">
        {out.ideas.map((i) => (
          <Link key={i.r.sym} href={companyHref(i.r.sym)} className="idea">
            <div className="idea-top"><div style={{ minWidth: 0 }}><div className="idea-sym">{i.r.sym}</div><div className="idea-name">{i.r.name}</div></div><span className="pill nodot num" title={`${i.passed} passed of ${i.known} that apply; ${i.total - i.known} of ${i.total} not applicable or unavailable. Rule set ${i.d.version}.`}>{i.passed} of {i.known} checks</span></div>
            <div><div className="idea-k">Reason</div><p>{i.reason}</p></div>
            <div><div className="idea-k">{i.limitationKind === 'data' ? 'Data limitation' : 'Limitation'}</div><p className="lim">{i.limitation}</p></div>
            <div className="idea-foot"><span>{i.r.sector}</span><span className="link">Read the evidence →</span></div>
          </Link>
        ))}
      </div>
      <p className="dim" style={{ fontSize: 13, margin: '10px 0 0' }}>Ranked from {num(out.ranked)} liquid companies at the {dateLabel(s.data?.rows[0]?.last_date ?? null)} close; {num(out.skipped)} left out for having fewer than six applicable checks. <Link className="link" href="/about/#confluence">How it is ranked</Link></p>
    </>
  );
}

/** 5. Results coming up: names you follow first. Dates are the screen's, unconfirmed, and say so (E12). */
export function ComingUp() {
  return (
    <section className="card" aria-labelledby="coming-h">
      <div className="card-h"><h2 id="coming-h">Coming up</h2><Link className="more" href="/calendar/">Calendar →</Link></div>
      <LazyMount minHeight={160}><ComingBody /></LazyMount>
    </section>
  );
}
function ComingBody() {
  const s = useFeedWhen('screen', true);
  const [watch] = useStoredList('alpha-watchlist');
  const list = useMemo(() => (s.data ? upcomingResults(s.data.rows, watch, istToday(), 14, 6) : null), [s.data, watch]);
  if (s.error) return <p className="dim" style={{ margin: 0 }}>Results dates could not be loaded.</p>;
  if (!list) return <Skel h={140} />;
  if (!list.length) return <div className="state"><b>No results date on file in the next two weeks.</b><p>The calendar lists later dates.</p></div>;
  return (
    <>
      <ul className="rows">{list.map((u) => <li key={u.sym}><Link className="row" href={companyHref(u.sym)}><span style={{ minWidth: 0 }}><span className="row-t">{u.sym}</span>{u.followed && <span className="pill acc nodot" style={{ marginLeft: 8 }}>Following</span>}<div className="row-s">{u.name}</div></span><span className="row-r num">{dateLabel(u.date)}<small>estimated</small></span></Link></li>)}</ul>
      <p className="card-foot">Dates are the screen&apos;s estimates, not exchange confirmations. Check the company&apos;s filing before relying on one.</p>
    </>
  );
}

/** 6. One row of previews, each a doorway to the page that owns the detail. */
export function Previews() {
  return (
    <div className="grid-2 previews">
      <SignalsStatus />
      <RotationPreview />
    </div>
  );
}

/** Signals in one card, with the reasons kept apart (H05): the market gate, the input data, the engine's validation and
 *  whether anything is published. An empty book leads with the reason and a research action, never a P&L call (H06). */
function SignalsStatus() {
  const eng = useSignals();
  const { items } = useDatasetStatus();
  const st = items.find((i) => i.id === 'engines');
  const f = eng.data;
  const open = (f?.signals ?? []).filter((x) => x.status === 'open').length, pending = (f?.signals ?? []).filter((x) => x.status === 'pending').length;
  const lines: [string, string, 'ok' | 'warn' | 'bad'][] = f ? [
    ['Market gate', f.gate.on ? `on: all 4 checks pass at the ${dateLabel(f.gate.date)} close` : `off: ${f.gate.passed} of 4 checks pass at the ${dateLabel(f.gate.date)} close`, f.gate.on ? 'ok' : 'bad'],
    ['Input data', st ? (st.state === 'current' ? `current, through ${dateLabel(f.data_through)}` : `through ${dateLabel(f.data_through)}, ${st.lagSessions} session${st.lagSessions === 1 ? '' : 's'} behind`) : `through ${dateLabel(f.data_through)}`, st && st.state !== 'current' ? 'warn' : 'ok'],
    ['Validation', f.alertable ? 'holdout passed: alerts may be sent' : 'holdout not passed: research only, alerts off', f.alertable ? 'ok' : 'warn'],
    ['Paper book', open + pending ? `${num(open)} open, ${num(pending)} waiting to enter` : 'no open or pending paper trade', 'ok'],
  ] : [];
  return (
    <section className="card" aria-labelledby="sig-h">
      <div className="card-h"><h2 id="sig-h">Signals · Swing v2</h2><Link className="more" href="/engines/">Setups and method →</Link></div>
      {!f ? (eng.error ? <p className="dim" style={{ margin: 0 }}>The signal book did not load.</p> : <Skel h={120} />) : (
        <>
          <ul className="rows">{lines.map(([k, t, tone]) => <li key={k} className="row kvrow"><span className="row-s">{k}</span><span><span className={`pill ${tone} nodot`} style={{ marginRight: 6 }}>{tone === 'ok' ? 'OK' : tone === 'warn' ? 'Note' : 'Off'}</span>{t}</span></li>)}</ul>
          <p className="card-foot">{open + pending === 0 ? <>No new paper setups: {f.gate.on ? 'no stock passed every rule' : 'the market gate is off'}, assessed through {dateLabel(f.data_through)}. <Link className="link" href="/screen/">Review candidates on the screen</Link>.</> : <><Link className="link" href="/trades/">The paper book</Link>, marked to the latest price. Paper only, never a broker fill.</>}</p>
        </>
      )}
    </section>
  );
}

/** Rotation in one line each way, with the week it describes (E09: a week in progress says so first). */
function RotationPreview() {
  const r = useRotation();
  const { items } = useDatasetStatus();
  const st = items.find((i) => i.id === 'rotation');
  const s = useMemo(() => (r.data ? rotationShift(r.data, 4) : []), [r.data]);
  const top = s[0], bottom = s[s.length - 1];
  return (
    <section className="card" aria-labelledby="rot-h">
      <div className="card-h"><h2 id="rot-h">Rotation · 4 weeks</h2><Link className="more" href="/rotation/">All groups →</Link></div>
      {!r.data ? (r.error ? <p className="dim" style={{ margin: 0 }}>Rotation did not load.</p> : <Skel h={120} />) : !top ? <p className="dim" style={{ margin: 0 }}>Not enough weeks on file.</p> : (
        <>
          <ul className="rows">
            <li className="row"><span style={{ minWidth: 0 }}><span className="row-s">Gaining most against the Nifty</span><div className="row-t">{top.name}</div></span><span className="row-r"><Chg v={top.shift} dp={1} /><small>{top.real ? 'NSE index' : `Alpha basket, ${top.members} stocks`}</small></span></li>
            <li className="row"><span style={{ minWidth: 0 }}><span className="row-s">Losing most</span><div className="row-t">{bottom.name}</div></span><span className="row-r"><Chg v={bottom.shift} dp={1} /><small>{bottom.real ? 'NSE index' : `Alpha basket, ${bottom.members} stocks`}</small></span></li>
          </ul>
          <p className="card-foot">{st?.note ? `Week in progress; through ${st.asOf ? dateLabel(st.asOf) : 'the latest session'}. ` : st?.asOf ? `Through ${dateLabel(st.asOf)}. ` : ''}Relative strength against the Nifty, refreshed weekly. NSE indices and Alpha baskets are different universes and can disagree.</p>
        </>
      )}
    </section>
  );
}
