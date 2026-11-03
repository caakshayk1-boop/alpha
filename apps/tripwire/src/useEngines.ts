import { useMemo } from 'react';
import { useLedger, useScreen } from './data.ts';
import { useAppState } from './app.tsx';
import { planAutoBook } from './autobook.ts';
import { lastFinishedSession } from './calendar.ts';
import { runSignalEngines } from './signalengine.ts';
import type { Q } from './quant.ts';
const cache = new WeakMap<object, Map<string, ReturnType<typeof runSignalEngines>>>();
export function useEngines() {
  const scr = useScreen(); const ledger = useLedger(); const s = useAppState(); const expected = lastFinishedSession();
  const held = useMemo(() => new Set([
    ...s.paper.filter((p) => !p.closedByUser && !['closed', 'skipped'].includes(p.lastView?.status ?? '')).map((p) => p.sym),
    // Positions from earlier nights only. The picks recorded for the data night on screen are the ones this run reproduces; they stay visible, labelled "In the auto book".
    ...(ledger.data?.ledger ? planAutoBook(ledger.data.ledger).taken.filter((p) => !ledger.data!.ledger.outcomes[p.pick.id]?.final && p.pick.asOf !== scr.data?.as_of).map((p) => p.pick.sym) : []),
  ]), [s.paper, ledger.data, scr.data]);
  // A dataset one session behind (the nightly build is pending) is shown against its own session, so the list stays readable. It is labelled as previous-session data and entries stay off until the build lands.
  // Rows that are stale WITHIN the dataset still never vote, and the nightly recorder stays strict about the expected session.
  const behind = !!scr.data && scr.data.as_of < expected; const evalDay = scr.data ? (behind ? scr.data.as_of : expected) : expected;
  const key = JSON.stringify([evalDay, s.signalAgreement, [...held].sort()]);
  const out = useMemo(() => { if (!scr.data) return null; let variants = cache.get(scr.data); if (!variants) { variants = new Map(); cache.set(scr.data, variants); } let r = variants.get(key); if (!r) { r = runSignalEngines(scr.data.rows as Q[], scr.data.as_of, evalDay, s.signalAgreement, held); variants.set(key, r); } return r; }, [scr.data, key]);
  // holdingsReady: a 404 means no record exists yet, so there is nothing to duplicate; a failed fetch means holdings are unknown
  return { scr, out, holdingsReady: (!!ledger.data && !ledger.err) || ledger.err === 'not published', held, behind, expected };
}
