'use client';
/** The market gate: the four checks that must all hold before Swing v2 opens any new trade (engines/swing.py market_gate).
 *  Read at the engines' latest close. Each check names its own value, so "off" always says why. */
import Link from 'next/link';
import { sessionLabel } from '@/lib/price';
import type { SignalsFeed } from '@/lib/types';

export function GatePanel({ feed, compact = false }: { feed: SignalsFeed; compact?: boolean }) {
  const g = feed.gate;
  const hist = feed.gate_history ?? [];
  const onShare = hist.length ? Math.round((hist.filter((x) => x.on).length / hist.length) * 100) : null;
  return (
    <section className={`gate panel tight${g.on ? ' on' : ' off'}`} aria-labelledby="gate-h">
      <div className="gate-top">
        <div>
          <div className="eyebrow">Market gate · {sessionLabel(g.date)} close</div>
          <h2 id="gate-h" className="gate-h">{g.on ? 'On: new trades allowed' : 'Off: no new trades'} <span className="dim num">{g.passed} of 4</span></h2>
        </div>
        {!compact && hist.length > 0 && (
          <div className="gate-strip" role="img" aria-label={`Gate on for ${onShare}% of the last ${hist.length} sessions`}>
            {hist.map((x) => <i key={x.d} className={x.on ? 'on' : ''} title={`${sessionLabel(x.d)}: ${x.on ? 'on' : 'off'}`} />)}
            <span className="dim num">on {onShare}% of the last {hist.length} sessions</span>
          </div>
        )}
      </div>
      <ul className="gate-checks">
        {g.checks.map((c) => (
          <li key={c.rule} className={c.ok ? 'ok' : 'no'}>
            <span className="gate-mark" aria-hidden>{c.ok ? '✓' : '✕'}</span>
            <span>{c.rule}<span className="sr">: {c.ok ? 'passes' : 'fails'}</span></span>
            {c.value && <span className="dim num">{c.value}</span>}
          </li>
        ))}
      </ul>
      {compact && <Link href="/engines/" className="more">Rules and record →</Link>}
    </section>
  );
}
