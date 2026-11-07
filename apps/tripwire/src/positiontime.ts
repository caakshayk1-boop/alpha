import type { View } from './tracker.ts';
import type { Outcome } from './ledger.ts';

/** Display the engine's observed sessions, never elapsed calendar days. No state changes. */
export function positionTime(signalDay: string, v: View, outcome?: Outcome | null) {
  const day = (t?: number) => t != null && Number.isFinite(t) && t > 0 ? new Date((t + 19800) * 1000).toISOString().slice(0, 10) : null;
  const entered = v.status === 'open' || v.status === 'closed';
  const final = v.status === 'closed';
  const entry = entered ? day(v.entryT) ?? outcome?.entryDay ?? null : null;
  const exit = final ? day(v.exitT) ?? outcome?.exitDay ?? null : null;
  const sessions = entered && Number.isInteger(v.sessions) && v.sessions > 0 ? v.sessions : null;
  return { signal: signalDay, entry, exit, sessions, final, retained: !!v.dataNote,
    note: v.dataNote || (entered ? 'Trading sessions observed, including entry and any current session. Weekends and holidays are excluded.' : 'No entry has been recorded.') };
}
