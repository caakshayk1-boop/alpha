import { useMemo } from 'react';
import { useLedger } from '../data.ts';
import { DEFAULT_CFG, planAutoBook } from '../autobook.ts';
import { observationLines, observationsOf } from '../observations.ts';

/** Says, in words and next to a count, which of "observations" and "positions" it is. Reads the forward record; draws nothing until it has loaded and nothing when the record is empty.
 *  `parts` chooses what to show: the observation count, the position count, the outcome caveat. */
export function ObservationNote({ parts = ['observed', 'positions', 'outcomes'], className = 'small mute' }: { parts?: ('observed' | 'positions' | 'outcomes')[]; className?: string }) {
  const led = useLedger(); const l = led.data?.ledger ?? null;
  const o = useMemo(() => { if (!l) return null; const plan = planAutoBook(l, DEFAULT_CFG); return observationLines(observationsOf(l, plan), true); }, [l]);
  if (!o || !l?.picks.length) return null;
  return <div className={className} data-observations aria-label="Observations and positions">{parts.map((k) => (o[k] ? <p key={k} style={{ margin: '4px 0 0' }}>{o[k]}</p> : null))}</div>;
}
