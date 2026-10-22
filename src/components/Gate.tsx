'use client';
/** The market gate: the four checks that must all hold before Swing v2 opens any new trade (engines/swing.py market_gate).
 *  Read at the engines' latest close. Each check names its own value, so "off" always says why. The history line counts the
 *  sessions on file (gate_history holds on/off only, so per-check counts exist for the latest session alone). */
import { sessionLabel } from '@/lib/price';
import { gateFunnel } from '@/lib/signalsView';
import type { SignalsFeed } from '@/lib/types';

export function GatePanel({ feed, compact = false }: { feed: SignalsFeed; compact?: boolean }) {
  const g = feed.gate;
  const hist = feed.gate_history ?? [];
  const fn = gateFunnel(feed);
  return (
    <section className={`card sg-gate${g.on ? ' on' : ' off'}`} aria-labelledby="gate-h">
      <div className="card-h">
        <h3 id="gate-h">Market gate <span className="dim sg-h-note">· {sessionLabel(g.date)} close</span></h3>
        <span className={`pill ${g.on ? 'ok' : 'bad'}`}>{g.on ? 'On' : 'Off'} · {fn.passed} of {fn.total} pass</span>
      </div>
      <ul className="rows sg-checks">
        {g.checks.map((c) => (
          <li key={c.rule} className={`row ${c.ok ? 'ok' : 'no'}`}>
            <span className="sg-check-l"><span className="sg-mark" aria-hidden>{c.ok ? '✓' : '✕'}</span><span>{c.rule}<span className="sr">: {c.ok ? 'passes' : 'fails'}</span></span></span>
            <span className="row-r num">{c.value ?? ''}<small>{c.ok ? 'passes' : 'fails'}</small></span>
          </li>
        ))}
      </ul>
      {!compact && hist.length > 0 && (
        <div className="sg-strip-wrap">
          <div className="sg-strip" role="img" aria-label={`Gate on in ${fn.on} of the last ${fn.sessions} sessions`}>
            {hist.map((x) => <i key={x.d} className={x.on ? 'on' : ''} title={`${sessionLabel(x.d)}: ${x.on ? 'on' : 'off'}`} />)}
          </div>
          <p className="card-foot sg-strip-note">On in <b className="num">{fn.on}</b> of the last <b className="num">{fn.sessions}</b> sessions ({sessionLabel(fn.from)} to {sessionLabel(fn.to)}){fn.on === 0 ? '' : `; off for the last ${fn.offRun}`}. The feed keeps on or off per session, not each check, so the per-check counts above are for the latest close only.</p>
        </div>
      )}
    </section>
  );
}
