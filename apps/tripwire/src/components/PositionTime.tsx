import type { View } from '../tracker.ts';
import type { Outcome } from '../ledger.ts';
import { positionTime } from '../positiontime.ts';
import { dayWord } from '../fmt.ts';

export function PositionTime({ signal, view, outcome }: { signal: string; view: View; outcome?: Outcome | null }) {
  const t = positionTime(signal, view, outcome);
  return <span className="position-time" data-position-time title={t.note}>
    <span><small>Signal</small><b>{dayWord(t.signal)}</b></span>
    <span><small>Entry date</small><b>{t.entry ? dayWord(t.entry) : view.status === 'open' || t.final ? 'Unavailable' : 'Not entered'}</b></span>
    {t.final && <span><small>Exit date</small><b>{t.exit ? dayWord(t.exit) : 'Unavailable'}</b></span>}
    <span><small>{t.final ? 'Sessions held · final' : t.retained ? 'Sessions held · recorded' : 'Sessions held'}</small><b>{t.sessions ?? '—'}{!t.final && t.sessions != null && view.left != null && <em> / {t.sessions + (view.left ?? 0)}</em>}</b></span>
    {t.retained && <span className="position-time-note">{t.note}</span>}
  </span>;
}
