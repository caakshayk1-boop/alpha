import { useMemo } from 'react';
import { useJson, useLedger } from '../data.ts';
import { edition, editionDays, failingChecks, gateRun } from '../edition.ts';
import { lastGateOn, type SwingFeed } from '../trust.ts';
import { dayWord } from '../fmt.ts';
import { PageBar, Loading } from './common.tsx';

/** Phase 1 of the product vision (18 Nov 2026): the ledger is the front of the house. Three pieces, all read from the published files and nothing recounted:
 *  LedgerLine (the one live sentence on the welcome screen), GateHero (the gate as the centrepiece of its page) and Edition (one ledger night as a dated page). Missing data is shown as missing. */

/** The live sentence under the welcome headline. Its box is reserved so the figures arriving do not move the page. */
export function LedgerLine() {
  const f = useLedger(), g = useJson<SwingFeed>('/data/signals.json'); const l = f.data?.ledger, s = g.data;
  const run = gateRun(s?.gate_history);
  return <p className="lp-ledger small" data-ledger-line aria-live="polite">
    {!l ? (f.loading ? 'Reading the public ledger…' : <>The public ledger could not be read just now. <a href="#/edition">Open the daily edition</a>.</>)
      : <>The public record: <b className="num">{l.days.length}</b> nights recorded, <b className="num">{l.picks.length}</b> paper picks{s ? <>, swing gate <b>{s.gate.on ? 'on' : 'off'}</b>{run && !s.gate.on && run.offStreak > 0 ? <> for <b className="num">{run.offStreak}</b> published days</> : null}</> : null}. <a href="#/edition">Read tonight’s edition</a></>}
  </p>;
}

/** The gate as the centrepiece: its state, how many of its checks pass, which check is nearest to passing, and how long it has sat out. */
export function GateHero({ s }: { s: SwingFeed }) {
  const bad = useMemo(() => failingChecks(s.gate), [s]), run = gateRun(s.gate_history), last = lastGateOn(s);
  const near = bad[0]; const ranked = near?.gap != null;
  return <section className="gate-hero" data-gate-hero aria-labelledby="gh-h">
    <p className="k">Swing gate · {dayWord(s.data_through)}</p>
    <h1 id="gh-h" className={s.gate.on ? 'up' : ''}>{s.gate.on ? 'The gate is on.' : 'The gate is off. That is the discipline.'}</h1>
    <p className="gh-count"><b className="num">{s.gate.passed}</b> of <b className="num">{s.gate.checks.length}</b> market checks pass. Every one must.</p>
    <ul className="gh-checks" aria-label="The market checks">{s.gate.checks.map((c) => <li key={c.rule} data-ok={c.ok}><span className="gh-mark" aria-hidden="true">{c.ok ? '✓' : '✗'}</span><span><b className="sr">{c.ok ? 'Pass: ' : 'Fail: '}</b>{c.rule}<small className="num">{c.value}</small></span></li>)}</ul>
    {near && <p className="gh-near" data-gate-near><b>{ranked ? 'Nearest to passing:' : 'Not yet passing:'}</b> {near.rule}. <span className="num">{near.value}</span>{ranked ? <> · <b className="num">{near.gap}</b></> : <> · <span className="dim">no distance can be read from the published value</span></>}</p>}
    {bad.length > 1 && <p className="small dim">Also failing: {bad.slice(1).map((b) => b.gap ? `${b.rule} (${b.gap})` : b.rule).join('; ')}.</p>}
    <p className="small dim" data-gate-run>{run ? <><b className="num">{run.off}</b> of <b className="num">{run.total}</b> published days the gate was off{run.on ? <>; on <b className="num">{run.on}</b>, last on {last ? dayWord(last) : 'not in this history'}</> : <>; it has not been on in the published history</>}.</> : 'No published gate history to count.'} Sitting out is a result, not a gap in the record.</p>
  </section>;
}

/** One ledger night. `day` is the night asked for; the latest when absent. */
export function EditionPage({ day }: { day?: string | null }) {
  const f = useLedger(), g = useJson<SwingFeed>('/data/signals.json'); const l = f.data?.ledger;
  const e = useMemo(() => (l ? edition(l, day ?? undefined, g.data?.gate_history) : null), [l, day, g.data]);
  const days = useMemo(() => (l ? editionDays(l) : []), [l]);
  if (f.loading && !l) return <div className="mp trust-page"><PageBar title="Daily edition" onBack /><Loading what="the daily edition" /></div>;
  if (!l) return <div className="mp trust-page"><PageBar title="Daily edition" onBack /><p role="status">The ledger is unavailable, so there is no edition to show. <button className="btn" onClick={f.retry}>Retry</button></p></div>;
  if (!e) return <div className="mp trust-page"><PageBar title="Daily edition" onBack /><p role="status">{day ? `The ledger has no night recorded for ${day}.` : 'The ledger has no nights recorded yet.'}</p>{days.length > 0 && <p><a className="btn" href={`#/edition?d=${days[0]}`}>Open the latest night, {dayWord(days[0])}</a></p>}</div>;
  const taken = e.picks.length, wide = e.engines.reduce((n, x) => n + x.skippedWideStop, 0);
  const sat = e.engines.reduce((n, x) => n + x.passedNotPicked, 0);
  return <div className="mp trust-page edition" data-edition={e.asOf}>
    <PageBar title="Daily edition" onBack />
    <header className="ed-head">
      <p className="k">Edition {e.position} of {e.of} · data through {dayWord(e.asOf)}</p>
      <h1>{dayWord(e.asOf)}: {taken} paper {taken === 1 ? 'pick' : 'picks'} recorded, {sat} rule {sat === 1 ? 'pass' : 'passes'} not picked.</h1>
      <p className="dim">Simulated paper research, not investment advice. Recorded {e.recorded.slice(0, 16).replace('T', ' ')} UTC{e.rules ? <> under rule set <span className="num">{e.rules}</span></> : <>; rule set not recorded for this night</>}. The record is append-only: this page is rebuilt from the ledger and never edited.</p>
      <nav className="ed-nav" aria-label="Other editions">
        {e.prev ? <a className="btn" href={`#/edition?d=${e.prev}`}>← {dayWord(e.prev)}</a> : <span className="dim small">First recorded night</span>}
        {e.next ? <a className="btn" href={`#/edition?d=${e.next}`}>{dayWord(e.next)} →</a> : <span className="dim small">Latest night</span>}
      </nav>
    </header>

    <section aria-labelledby="ed-gate"><h2 id="ed-gate">The gate</h2>
      {e.gate == null ? <p>The published gate history has no entry for this night. It is shown as missing, not as off.</p> : <p>The swing gate was <b>{e.gate ? 'on' : 'off'}</b> on this night.</p>}
      <p className="small dim">The swing gate and the nightly engines are separate records. <a href="#/gate">Read the gate</a>.</p>
    </section>

    <section aria-labelledby="ed-eng"><h2 id="ed-eng">Passed is not picked</h2>
      <p className="small dim">Counted per engine, so one company that passes two engines is counted twice.</p>
      <div className="scroll-x" tabIndex={0} role="region" aria-label="Engines for this night, scrolls sideways"><table className="tbl"><thead><tr><th scope="col">Engine</th><th scope="col">Eligible</th><th scope="col">Passed</th><th scope="col">Picked</th><th scope="col">Wide stop, skipped</th></tr></thead>
        <tbody>{e.engines.map((x) => <tr key={x.engine}><th scope="row">{x.engine}</th><td className="num">{x.eligible}</td><td className="num">{x.passed}</td><td className="num">{x.picked}</td><td className="num">{x.skippedWideStop}</td></tr>)}</tbody></table></div>
      <p className="small dim">{wide} {wide === 1 ? 'name was' : 'names were'} skipped for a stop too wide for the book. The publisher stores counts for those, not names.</p>
    </section>

    <section aria-labelledby="ed-picks"><h2 id="ed-picks">What was recorded</h2>
      {e.picks.length === 0 ? <p>No pick was recorded on this night.</p> : <ul className="ed-picks">{e.picks.map((p) => <li key={p.id}><a href={`#/glass?pick=${encodeURIComponent(p.id)}`}><b>{p.sym}</b> <small className="dim">{p.engine} · stop <span className="num">{p.stop}</span></small></a>{e.newNames.some((n) => n.id === p.id) ? <span className="chip sm">new name</span> : null}</li>)}</ul>}
      <p className="small dim">Each name opens its timeline in the Glass Book, from signal to exit.</p>
    </section>

    {e.voided.length > 0 && <section aria-labelledby="ed-void"><h2 id="ed-void">Corrected, not deleted</h2>
      {e.voided.map((v) => <p key={v.id}><b>{v.id.split('|').slice(1).join(' · ')}</b>: {v.reason}</p>)}</section>}

    <section aria-labelledby="ed-all"><h2 id="ed-all">All editions</h2>
      <ul className="ed-days">{days.map((d) => <li key={d}>{d === e.asOf ? <b aria-current="page">{dayWord(d)}</b> : <a href={`#/edition?d=${d}`}>{dayWord(d)}</a>}</li>)}</ul>
    </section>
  </div>;
}
