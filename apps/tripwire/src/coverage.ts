/** What a row count in the Data screen's file table MEANS, per file. Pure, so the sentences are tested.
 *
 *  Two different files both get called "signals" in conversation and were read as one count: `/data/signals.json` is the swing-signal feed, whose list is empty by design while its gate is OFF;
 *  the Picks on the Signals screen are the three engines' observations in the forward record (`/api/ledger`). The first can be 0 while the second is not, and neither is the other's error. */
import type { Ledger } from './ledger.ts';
import { observationsOf } from './observations.ts';

export function signalsRowNote(rows: number | null | undefined, gate: { on: boolean; text: string } | null): string | undefined {
  if (rows == null) return undefined;
  if (rows === 0) return `0 rows is not a failure: this file lists swing signals only while its gate is ON${gate ? ` (${gate.text})` : ''}. The Picks on the Signals screen are the engines' own observations from the forward record, a different file with its own count (see Forward record).`;
  return `${rows.toLocaleString('en-IN')} swing signal${rows === 1 ? '' : 's'} listed by the gate. Not the same count as the engines' Picks (see Forward record).`;
}
export function ledgerRowNote(l: Ledger | null | undefined): string | undefined {
  if (!l) return undefined;
  const o = observationsOf(l, null);
  const left = l.picks.length - o.observations;
  return `Rows are pick observations (one engine naming one company on one night), not positions. ${o.observations.toLocaleString('en-IN')} are counted and name ${o.names.toLocaleString('en-IN')} companies${left > 0 ? `; ${left} more ${left === 1 ? 'is' : 'are'} kept in the file but left out of every total (voided, or from a retired engine)` : ''}.`;
}
