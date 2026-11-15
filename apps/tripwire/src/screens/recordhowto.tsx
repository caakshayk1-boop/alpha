// "How to read the Record": the definitions that used to sit under a "How to read this" fold on the Record screen (v6 polish, 15 Nov 2026). They live on #/info?s=record now; the Record keeps one line that links here.
// The text is unchanged. The three sentences that quote the record's own data (the round-trip cost, the rule version by night, voided picks) read it with the same hook the Record uses, and are left out
// while it loads or when it is unavailable: they are never filled in with a guess.
import { useMemo } from 'react';
import { useLedger } from '../data.ts';
import { rulesOfRecord } from '../rules.ts';
import { RETIRED } from '../ledger.ts';
import { definitionLines } from '../recordview.ts';
import { DEFAULT_COST } from '../tracker.ts';
import { DEFAULT_CFG } from '../autobook.ts';
import { dayWord, inr0 } from '../fmt.ts';

export function RecordHowTo() {
  const feed = useLedger(); const l = feed.data?.ledger ?? null; const def = definitionLines();
  const voided = l?.voided ? Object.keys(l.voided).length : 0;
  const by = useMemo(() => { const m: Record<string, string[]> = {}; for (const d of l?.days ?? []) (m[rulesOfRecord(d.rules)] ??= []).push(d.asOf); return m; }, [l]);
  return <div className="card small info-body" data-rec-howto>
    <p><b>One R.</b> {def.r}</p>
    <p><b>One T2.</b> {def.targets} The same levels are drawn on every row in the Book and in the Record.</p>
    <p>It is a forward record: nothing before the first night counts. Each night's picks are replayed with the same rules as your own paper trades (next-open fill, stop first, time exit, costs {l?.cost ?? DEFAULT_COST}% round trip), and a closed outcome is never rewritten. {inr0(DEFAULT_CFG.ticket)} is the most the paper book puts in any one position, so a rupee figure depends on size and R does not. Thirty trades is a minimum, not proof.</p>
    <p><b>Original and restated.</b> A result is labelled by the rule it was produced under: <i>As filed</i> (written on or after 27 Oct 2026, under the profit-booking ladder from the start), <i>Original rule</i> (written earlier and finished under stop-and-time only, never re-evaluated) or <i>Restated rule</i> (written earlier, still open on 1 Nov 2026, so the ladder was applied to it from its entry bar). A restated position's earlier figure was never stored, so it is labelled, not shown beside an invented one.</p>
    {l && l.days.length > 0 && <p>Eligibility rule by night: {Object.entries(by).map(([v, ds]) => `${v} (${ds.length} ${ds.length === 1 ? 'night' : 'nights'}, ${dayWord(ds[0])}${ds.length > 1 ? ` to ${dayWord(ds[ds.length - 1])}` : ''})`).join(' · ')}. A night keeps the version it was written under.</p>}
    {voided > 0 && l?.voided && <p><b>{voided} pick{voided === 1 ? '' : 's'} voided.</b> They are kept in the record, left out of every total, and the reason is stated: {[...new Set(Object.values(l.voided))][0]}</p>}
    {RETIRED.size > 0 && <p>Retired engines stay in the stored record and are left out of every figure in the Record.</p>}
    {!l && !feed.loading && <p className="mute">The rule version by night and any voided picks come from the stored record, which is not available right now.</p>}
  </div>;
}
