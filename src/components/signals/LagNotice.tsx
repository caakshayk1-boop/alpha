'use client';
/** A05: when the engines dataset is behind the calendar (useDatasetStatus 'engines', lib/status.ts expectedSession), a view leads
 *  with the last decision session, how far behind it is and the next expected run, so no decision reads as current. */
import { useEffect, useState } from 'react';
import { sessionLabel } from '@/lib/price';
import { istStamp, nextRun, type Lag } from '@/lib/signalsView';
import type { SignalsFeed } from '@/lib/types';

export function LagNotice({ feed, lag }: { feed: SignalsFeed; lag: Lag | null }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  if (!lag || lag.state === 'current' || lag.lagSessions <= 0) return null;
  return (
    <div className="state sg-lag" role="status">
      <b>Last successful decision session: {sessionLabel(feed.data_through)}; {lag.lagSessions} session{lag.lagSessions === 1 ? '' : 's'} behind; next expected run: {now ? istStamp(nextRun(now)) : 'the next evening run'}.</b>
      <p>The calendar expects the {lag.reference ? sessionLabel(lag.reference) : 'latest'} session. Everything below describes {sessionLabel(feed.data_through)} and is not a decision for a later session. Sessions follow NSE's published holiday calendar.</p>
    </div>
  );
}
