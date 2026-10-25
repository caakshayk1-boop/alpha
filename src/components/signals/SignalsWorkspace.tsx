'use client';
/** Signals in three views on one page (/engines/, and /trades/ with the Paper record open): Setups, Paper record, and Method and
 *  validation. Tabs are hash-addressable (#setups, #record, #method). Each engine family is read from its own feed and run, with
 *  one lifecycle vocabulary (lib/signalsView.ts); nothing from one family or model version is added to another's. */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Async, PageHead } from '@/components/ui';
import { useDatasetStatus } from '@/components/DataStamp';
import { GatePanel } from '@/components/Gate';
import { useEnginesV3 } from '@/lib/data';
import { RuleBoard } from './RuleBoard';
import { sessionLabel } from '@/lib/price';
import { LIFECYCLE_TONE, istStamp, setupReasons, swingLifecycle, type Lag } from '@/lib/signalsView';
import type { SignalsFeed } from '@/lib/types';
import { useBook } from '@/lib/useBook';
import { LagNotice } from './LagNotice';
import dynamic from 'next/dynamic';
// the two tabs that are not the default load when first opened, so /engines/ ships only the Setups view up front
const PaperRecord = dynamic(() => import('./PaperRecord').then((m) => m.PaperRecord), { loading: () => <div className="skel" style={{ height: 320 }} aria-hidden /> });
const MethodView = dynamic(() => import('./Method').then((m) => m.MethodView), { loading: () => <div className="skel" style={{ height: 320 }} aria-hidden /> });
import { SetupCard } from './SetupCard';

export type SignalsTab = 'setups' | 'record' | 'method';
const TABS: [SignalsTab, string][] = [['setups', 'Signals'], ['record', 'Paper record'], ['method', 'Method and validation']];
const isTab = (h: string): h is SignalsTab => TABS.some(([k]) => k === h);

export function SignalsWorkspace({ initial }: { initial: SignalsTab }) {
  const [tab, setTab] = useState<SignalsTab>(initial);
  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1); if (isTab(h)) setTab(h); };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const pick = useCallback((k: SignalsTab, focus = false) => {
    setTab(k);
    try { window.history.replaceState(null, '', `#${k}`); } catch { /* sandboxed frame: the tab still changes */ }
    if (focus) document.getElementById(`sg-tab-${k}`)?.focus();
  }, []);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex(([k]) => k === tab);
    const to = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
    if (to >= 0) { e.preventDefault(); pick(TABS[to][0], true); }
  };

  const book = useBook();
  const { q, feed } = book;
  const v3 = useEnginesV3();
  const { items } = useDatasetStatus();
  const st = items.find((i) => i.id === 'engines');
  const lag: Lag | null = st && st.asOf ? { state: st.state, lagSessions: st.lagSessions, reference: st.reference } : null;
  const v3Published = !v3.loading && !v3.error && !!v3.data;

  return (
    <>
      <PageHead method={initial === 'record' ? 'trades' : 'engines'} eyebrow="Signals" title="Signals," em="rule by rule."
        lede="Ten plain rules run on every liquid stock at the last close; each shows who meets it and the figure behind it. Observations, not advice. Swing v2's paper setups, below, are a paper rule-verification log, not a model portfolio." />
      <nav className="secnav sg-tabs" aria-label="Signals views">
        <div className="wrap" role="tablist" aria-label="Signals views" onKeyDown={onKey}>
          {TABS.map(([k, l]) => <button key={k} id={`sg-tab-${k}`} type="button" role="tab" aria-selected={tab === k} aria-controls={`sg-panel-${k}`} tabIndex={tab === k ? 0 : -1} onClick={() => pick(k)}>{l}</button>)}
        </div>
      </nav>
      <div className="wrap sg-body" role="tabpanel" id={`sg-panel-${tab}`} aria-labelledby={`sg-tab-${tab}`}>
        <Async loading={q.loading} error={q.error} rows={3}>
          {feed && (tab === 'setups' ? <SetupsView feed={feed} rows={book.rows} lag={lag} v3Published={v3Published} onPick={pick} />
            : tab === 'record' ? <PaperRecord book={book} lag={lag} />
            : <MethodView feed={feed} />)}
        </Async>
      </div>
    </>
  );
}

function FamilyHead({ feed }: { feed: SignalsFeed }) {
  const lc = swingLifecycle(feed);
  return (
    <div className="sg-family">
      <div style={{ minWidth: 0 }}>
        <h2 className="sec-title">Swing v2</h2>
        <p className="sec-sub">Model {feed.version} · decisions through {sessionLabel(feed.data_through)} · backtest built {sessionLabel(feed.backtest?.generated.slice(0, 10))} · forward record since {sessionLabel(feed.launched)}</p>
      </div>
      <span className={`pill ${LIFECYCLE_TONE[lc]}`} title="Lifecycle: Research, Paper, Validated, Paused, Retired or Blocked (data)">{lc}{feed.alertable ? '' : ' · alerts off'}</span>
    </div>
  );
}

function SetupsView({ feed, rows, lag, v3Published, onPick }: { feed: SignalsFeed; rows: ReturnType<typeof useBook>['rows']; lag: Lag | null; v3Published: boolean; onPick: (k: SignalsTab) => void }) {
  const active = rows.filter((r) => r.s.status === 'open' || r.s.status === 'pending');
  const reasons = useMemo(() => setupReasons(feed, lag, v3Published), [feed, lag, v3Published]);
  const issued = feed.signals.length;
  const lc = swingLifecycle(feed);
  return (
    <>
      <LagNotice feed={feed} lag={lag} />
      <RuleBoard />

      <section className="section2 sg-sec" aria-labelledby="sg-setups-h">
        <div className="sg-family">
          <div style={{ minWidth: 0 }}>
            <h2 id="sg-setups-h" className="sec-title">Paper setups</h2>
            <p className="sec-sub">{active.length ? `${active.length} from the ${sessionLabel(feed.data_through)} close, filed under Swing v2's tested rulebook. Paper only.` : `None for the ${sessionLabel(feed.data_through)} session. ${feed.gate.on ? 'No stock passed every rule.' : `The market gate is off (${feed.gate.passed} of ${feed.gate.checks.length} rules pass), so none is filed.`}`}</p>
          </div>
          <span className={`pill ${LIFECYCLE_TONE[lc]}`} title="Lifecycle: Research, Paper, Validated, Paused, Retired or Blocked (data)">{lc}{feed.alertable ? '' : ' · alerts off'}</span>
        </div>
        {active.length > 0 && (
          <>
            <div className="grid-2 sg-cards">{active.map((r) => <SetupCard key={r.s.id} row={r} feed={feed} />)}</div>
            <p className="dim sg-note">A price touching a stop or target during the session is a provisional mark, not an execution event; the evening run books it from the day&apos;s full range.</p>
          </>
        )}
        <details className="wk sg-why">
          <summary>Why {active.length ? 'these, and where the gate stands' : 'none, and where the gate stands'}</summary>
          <ul className="rows">
            {reasons.map((x) => (
              <li key={x.key} className="row kvrow sg-reason">
                <span className="row-s">{x.label}</span>
                <span><span className={`pill ${x.tone} nodot`}>{x.blocking ? 'Stops new setups' : x.tone === 'ok' ? 'OK' : 'Note'}</span> {x.text}</span>
              </li>
            ))}
          </ul>
          <div className="grid-lead sg-gate-grid">
            <GatePanel feed={feed} />
            <Funnel feed={feed} issued={issued} />
          </div>
          <p className="dim sg-note">Evaluated {istStamp(new Date(feed.generated))}. <button type="button" className="link sg-linkbtn" onClick={() => onPick('method')}>How the rules were tested and what each research engine is</button>.</p>
        </details>
      </section>
    </>
  );
}

/** S01: the funnel the feed can support, by gate and setup. Fewer setups are reported as the rules working, never as a fault. */
function Funnel({ feed, issued }: { feed: SignalsFeed; issued: number }) {
  const h = feed.gate_history ?? [];
  const on = h.filter((x) => x.on).length;
  const bySetup = Object.keys(feed.rules.setups).map((k) => [k, feed.signals.filter((s) => s.setup === k).length] as const);
  return (
    <section className="card" aria-labelledby="sg-funnel-h">
      <div className="card-h"><h3 id="sg-funnel-h">Where the book stopped</h3></div>
      <ol className="sg-funnel">
        <li><span>Sessions on file</span><b className="num">{h.length}</b></li>
        <li><span>Gate on (stock rules applied)</span><b className="num">{on}</b></li>
        {bySetup.map(([k, n]) => <li key={k}><span>{k} signals in the feed</span><b className="num">{n}</b></li>)}
        <li><span>All signals in the feed (open, waiting, closed or skipped)</span><b className="num">{issued}</b></li>
      </ol>
      <p className="card-foot">{on === 0 ? `The gate was off on every one of the ${h.length} sessions on file, so the stock and setup rules were never reached.` : `The stock and setup rules ran on ${on} of ${h.length} sessions.`} The feed does not publish a per-stock or per-check funnel. A quieter book is not a worse one, and more setups would not be evidence of quality.</p>
    </section>
  );
}
