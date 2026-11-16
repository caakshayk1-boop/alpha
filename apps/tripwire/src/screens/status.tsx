import { useMemo } from 'react';
import { useLedger, useScreen, useSignals } from '../data.ts';
import { useAutoBook } from '../book.ts';
import { useFreshness } from '../freshdata.ts';
import { buildLedgerView } from '../ledgerview.ts';
import { gateLine } from '../components/gate.ts';
import { alertsOf, bookRisk, crossChecks, nightlyHealth, PAPER_WORDS } from '../statusboard.ts';
import { builtWord, throughWord, type Status } from '../freshness.ts';
import { dayWord, inr0 } from '../fmt.ts';
import { Loading } from './common.tsx';
import { SectionHeader, EmptyState, StatusPill, type Tone } from '../components/index.ts';

const WORD: Record<Status, string> = { current: 'Current', pending: 'Build due', stale: 'Behind', unknown: 'Date unreadable', missing: 'Not published' };
const TONE: Record<Status, Tone> = { current: 'up', pending: 'neutral', stale: 'amber', unknown: 'amber', missing: 'amber' };

/** One status page: what is behind, the gate and its reason, the book's risk, the nightly job and whether the feeds agree. Read-only; every line is derived from data the app already reads, and a figure that cannot be measured says so. */
export function Status() {
  const fx = useFreshness(); const led = useLedger(); const scr = useScreen(); const sig = useSignals(); const book = useAutoBook(false);
  const l = led.data?.ledger ?? null; const plan = book.plan; const rows = scr.data?.rows ?? [];
  const sectors = useMemo(() => new Map(rows.map((r) => [r.sym, r.sector ?? null])), [rows]);
  const lv = useMemo(() => (l && plan ? buildLedgerView(l, plan) : null), [l, plan]);
  const risk = useMemo(() => (l && plan && lv ? bookRisk(l, plan, (s) => sectors.get(s) ?? null, lv) : null), [l, plan, lv, sectors]);
  const nightly = useMemo(() => (l ? nightlyHealth(l, fx.now) : null), [l, fx.now]);
  const gate = useMemo(() => gateLine(sig.data), [sig.data]);
  const held = useMemo(() => (lv ? lv.lifecycles.filter((x) => x.owner === 'engine' && (x.state === 'open' || x.state === 'awaiting')).map((x) => x.sym) : []), [lv]);
  const checks = useMemo(() => crossChecks({ screenAsOf: scr.data?.as_of ?? null, ledgerAsOf: nightly?.last ?? null, signalsThrough: sig.data?.data_through ?? null, screenSyms: rows.length ? new Set(rows.map((r) => r.sym)) : null, bookSyms: held }), [scr.data, nightly, sig.data, rows, held]);
  const alerts = useMemo(() => (nightly ? alertsOf({ files: fx.files, gate, voided: Object.keys(l?.voided ?? {}).length, nightly, checks, risk }) : []), [fx.files, gate, l, nightly, checks, risk]);
  if (fx.loading && !fx.files.length) return <Loading what="the status board" />;
  if (!l || !plan || !nightly) return <EmptyState>The status board needs the nightly ledger and it has not loaded: missing is shown as missing, not as healthy.</EmptyState>;
  const attention = alerts.filter((a) => a.level === 'attention');
  return <div className="st-page" data-status>
    <header className="gb-head">
      <p className="eyebrow">Status · paper only</p>
      <h1>{attention.length ? `${attention.length} thing${attention.length === 1 ? '' : 's'} need attention` : 'Nothing needs attention'}</h1>
      <p className="dim">{PAPER_WORDS} Data through {throughWord(scr.data?.as_of)}{builtWord(scr.data?.built_at) ? `, built ${builtWord(scr.data?.built_at)}` : ''}.</p>
    </header>

    <section className="rec-sec card" aria-labelledby="st-al" data-status-alerts>
      <SectionHeader id="st-al" title="Alerts" description="Worked out from the figures below each time you open this page. Nothing is stored or sent." />
      {alerts.length === 0 ? <p className="dim">No alerts.</p> : <ul className="st-list">{alerts.map((a) => <li key={a.id} data-level={a.level}><b className={a.level === 'attention' ? 'down' : 'dim'}>{a.level === 'attention' ? 'Attention' : 'Note'}</b> {a.text}</li>)}</ul>}
    </section>

    <section className="rec-sec card" aria-labelledby="st-gate" data-status-gate>
      <SectionHeader id="st-gate" title="The signals gate" description="Context for the market, separate from the factor engines' paper picks." />
      {gate ? <><p><b>{gate.on ? 'ON' : 'OFF'}</b> · <span className="num">{gate.passed}/{gate.total}</span> market checks pass{gate.holdout ? <>. Holdout t <span className="num">{gate.holdout.t}</span>, needs <span className="num">+{gate.holdout.needs}</span></> : null}.</p>
        <ul className="st-list">{gate.checks.map((c) => <li key={c.rule}><b className={c.ok ? 'up' : 'down'}>{c.ok ? 'Holds' : 'Fails'}</b> {c.rule} <span className="dim num">{c.value}</span></li>)}</ul></>
        : <p className="dim">The gate state is not published right now.</p>}
    </section>

    <section className="rec-sec card" aria-labelledby="st-feeds" data-status-feeds>
      <SectionHeader id="st-feeds" title="Each feed, and how old" description={`The last finished session is ${throughWord(fx.expected)}. Full table with build times: Data and coverage.`} action={<a className="btn sm" href="#/data">Data and coverage</a>} />
      <ul className="st-list">{fx.files.map((f) => <li key={f.id} data-file={f.id}><span className="grow">{f.label}</span><span className="num dim">{f.asOf ? dayWord(f.asOf) : '—'}</span><StatusPill tone={TONE[f.status]} icon={f.status === 'current' ? 'check' : f.status === 'pending' ? 'clock' : 'alert'}>{WORD[f.status]}</StatusPill></li>)}</ul>
    </section>

    <section className="rec-sec card" aria-labelledby="st-risk" data-status-risk>
      <SectionHeader id="st-risk" title="Book risk" description="Simulated paper positions only." />
      {risk && <><dl className="gb-stats">
        <div><dt>Slots used</dt><dd className="num">{risk.slotsUsed} of {risk.slotsMax}</dd></div>
        <div><dt>Open</dt><dd className="num">{risk.open}</dd></div>
        <div><dt>Awaiting entry</dt><dd className="num">{risk.awaiting}</dd></div>
        <div><dt>Risk at first stop</dt><dd className="num">{risk.initialRisk == null ? '—' : inr0(risk.initialRisk)}</dd></div>
        <div><dt>Largest name</dt><dd className="num">{risk.largest ? `${risk.largest.sym} ${risk.largest.share}%` : '—'}</dd></div>
      </dl>
      {risk.bySector.length > 0 && <p className="small">By sector: {risk.bySector.map((s) => `${s.sector} ${s.n}${s.atCap ? ' (at the limit)' : ''}`).join(' · ')}.</p>}
      <p className="small dim">{risk.basis}{risk.unmeasured ? ` ${risk.unmeasured} open position${risk.unmeasured === 1 ? ' has' : 's have'} no entry on record and ${risk.unmeasured === 1 ? 'is' : 'are'} not in the risk figure.` : ''}</p></>}
    </section>

    <section className="rec-sec card" aria-labelledby="st-night" data-status-nightly>
      <SectionHeader id="st-night" title="The nightly job" />
      <p>{nightly.line}</p>
      {nightly.recorded ? <p className="small dim">Last write: {builtWord(nightly.recorded) ?? 'time unreadable'} on {dayWord(nightly.recorded.slice(0, 10))}.</p> : null}
      {nightly.gapLine ? <p className="down small">{nightly.gapLine}</p> : <p className="small dim">No session is missing between the first and the latest recorded night.</p>}
    </section>

    <section className="rec-sec card" aria-labelledby="st-x" data-status-checks>
      <SectionHeader id="st-x" title="Do the feeds agree?" description="Cross-checks between the screen, the ledger and the signals file." />
      <ul className="st-list">{checks.map((c) => <li key={c.id}><b className={c.ok === true ? 'up' : c.ok === false ? 'down' : 'dim'}>{c.ok === true ? 'Agree' : c.ok === false ? 'Differ' : 'Not checked'}</b> {c.line}</li>)}</ul>
    </section>
  </div>;
}
