/** ONE model of how current the news is, used by Today, the News page, the Operations page's service line and the Data screen. Pure: the clock and the documents are arguments.
 *
 *  Six states. `loading` (the first answer has not arrived: nothing is known yet, so nothing is claimed) and `error` (the service could not be reached and no earlier copy is saved) join the four below. There is no "live": the sources are free feeds read on a schedule, so the best the page can honestly say is that a check succeeded recently.
 *   fresh        the last check succeeded, within what its schedule allows, and every source answered
 *   partial      the last check succeeded but some sources did not answer: what is shown is real, coverage is not complete
 *   delayed      the last good snapshot is older than its schedule allows, or the latest check failed, or the service could not be reached just now: cached stories stay readable, labelled
 *                (when the Worker has refreshed the MARKET stories on demand inside its own allowance, the state is `partial` instead, and says which part is current)
 *   unavailable  there is no snapshot at all
 *  Three different times are never mixed: when a story was PUBLISHED (its own), when the news was last CHECKED successfully, and when the next check is due. All are shown in Indian time, with the zone. */
import { DELAY_AFTER } from '../news/config.js';
import { cadenceMin } from '../news/schedule.js';
import { fmtIst } from './stamp.ts';

export interface StatusDoc { snapshotVersion: number; status: 'ok' | 'partial' | 'failed'; checkedAt: string | null; lastSuccessfulAt: string | null; nextScheduledAt: string | null; cadenceMin?: number; sourcesTotal?: number; sourcesFailed?: number; lastError?: string | null }
export type NewsState = 'loading' | 'fresh' | 'partial' | 'delayed' | 'unavailable' | 'error';
export interface NewsHealth {
  state: NewsState; tone: 'ok' | 'warn' | 'bad'; word: string;
  /** The full sentence for the health line. */
  line: string;
  /** The same facts as separate labelled parts, for a layout that shows three timestamps. */
  checked: string | null; lastGood: string | null; next: string | null;
  checkedSec: number | null; lastGoodSec: number | null; nextSec: number | null; ageMin: number | null; reason: string | null;
  /** When the Worker ran a market-scope catch-up because the scheduled check was late (Indian time), or null. It never changes the state or the times above: the scheduled check is still late. */
  onDemand: string | null;
}
const sec = (iso: string | null | undefined) => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? Math.floor(t / 1000) : null; };
const agoWord = (min: number) => min < 90 ? `${Math.round(min)} minutes` : min < 2880 ? `${Math.round(min / 60)} hours` : `${Math.round(min / 1440)} days`;
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** How long the page lets the last successful check age before it says "delayed": two cadences (of the session the check ran in) plus ten minutes of grace for GitHub's cron to be late. */
export const allowedAgeMin = (checkedMs: number) => DELAY_AFTER.cadences * cadenceMin(checkedMs) + DELAY_AFTER.graceMin;

/** `doc`: the latest status document (null when none has been read). `unreachable`: reading it failed just now. `remembered`: the last document this browser held, for the unreachable case. */
export function newsHealth({ doc, unreachable = false, remembered = null, nowMs, onDemandAt = null, loaded = true }: { doc: StatusDoc | null; unreachable?: boolean; remembered?: StatusDoc | null; nowMs: number; onDemandAt?: string | null; /** false until the first answer (or failure) has arrived: with nothing saved either, the state is `loading`, never `unavailable` */ loaded?: boolean }): NewsHealth {
  const nowSec = nowMs / 1000; const d = doc ?? remembered;
  const out = (state: NewsState, line: string, extra: Partial<NewsHealth> = {}): NewsHealth => {
    const checkedSec = sec(d?.checkedAt), lastGoodSec = sec(d?.lastSuccessfulAt), nextSec = sec(d?.nextScheduledAt);
    return { state, tone: state === 'fresh' ? 'ok' : state === 'unavailable' || state === 'error' ? 'bad' : 'warn', word: { loading: 'Checking', fresh: 'Fresh', partial: 'Partial', delayed: 'Delayed', unavailable: 'Unavailable', error: 'Could not load' }[state], line,
      checked: checkedSec != null ? fmtIst(checkedSec, nowMs) : null, lastGood: lastGoodSec != null ? fmtIst(lastGoodSec, nowMs) : null, next: nextSec != null ? fmtIst(nextSec, nowMs) : null, checkedSec, lastGoodSec, nextSec,
      ageMin: lastGoodSec != null ? Math.max(0, Math.round((nowSec - lastGoodSec) / 60)) : null, reason: null, onDemand: null, ...extra };
  };
  if (!d && !loaded && !unreachable) return out('loading', 'Checking for news…');
  if (!d || sec(d.lastSuccessfulAt) == null) return unreachable && !d ? out('error', 'News could not be loaded: the news service did not answer and no earlier check is saved on this device.') : out('unavailable', 'News unavailable: no check has succeeded yet.');
  const good = sec(d.lastSuccessfulAt) as number; const lastGood = fmtIst(good, nowMs);
  if (good > nowSec + 600) return out('delayed', `News delayed - the saved check time (${lastGood}) is in the future and is not trusted.`, { reason: 'future check time' });
  const ageMin = (nowSec - good) / 60; const allowed = allowedAgeMin(good * 1000);
  if (unreachable && !doc) return out('delayed', `News delayed - last successful check ${lastGood}. The news service did not answer just now; the saved copy is shown.`, { reason: 'unreachable' });
  if (d.status === 'failed') return out('delayed', `News delayed - last successful check ${lastGood}. The latest check failed${d.lastError ? ` (${d.lastError})` : ''}; the last good stories are shown.`, { reason: 'latest check failed' });
  if (ageMin > allowed) { const od = sec(onDemandAt); const odIst = od != null && od >= good && od <= nowSec + 600 ? fmtIst(od, nowMs) : null;
    // A market-scope refresh made by the Worker inside its own allowance means the market stories are current and the company stories are not: that is a partial state, said in those words, not "delayed".
    // The scheduled check keeps its own time and the words "last successful check" (they are still late); only the badge stops claiming that nothing is current.
    if (od != null && odIst && (nowSec - od) / 60 <= allowedAgeMin(od * 1000))
      return out('partial', `Market news refreshed ${odIst}. Company stories are from the scheduled check at ${lastGood}, ${agoWord(ageMin)} ago, which is running late.`, { reason: 'refreshed on demand', onDemand: odIst });
    return out('delayed', `News delayed - last successful check ${lastGood}, ${Math.round(ageMin)} minutes ago; scheduled checks run every ${cadenceMin(good * 1000)} minutes at that time of day.${odIst ? ` Market stories were refreshed on demand ${odIst}.` : ''}`, { reason: 'older than the schedule allows', onDemand: odIst }); }
  if (d.status === 'partial') { const f = d.sourcesFailed ?? 0, t = d.sourcesTotal ?? 0; return out('partial', `Partial coverage${t ? `: ${plural(f, 'source')} of ${t} not answering` : ''}. Last successful check ${lastGood}.`, { reason: 'some sources failed' }); }
  const next = sec(d.nextScheduledAt);
  return out('fresh', `Checked ${lastGood}${next && next > nowSec ? ` · next check about ${fmtIst(next, nowMs)}` : ''}`);
}

/** Operations and Data: the same model in the words of a service list. */
export function newsServiceView(h: NewsHealth): { tag: string; tone: 'lime' | 'peach'; line: string } { return { tag: h.word, tone: h.state === 'fresh' ? 'lime' : 'peach', line: h.line }; }

/** A story's own time. Missing, unreadable or in the future is "time unknown", never "just now". `ageWord` is relative; `ist` is the explicit Indian time. */
export function storyTime(publishedAt: string | null | undefined, nowMs: number): { known: boolean; ageWord: string; ist: string } {
  const s = sec(publishedAt); if (s == null || s * 1000 > nowMs + 600e3) return { known: false, ageWord: 'time unknown', ist: 'publication time unknown' };
  const m = Math.max(0, Math.round((nowMs / 1000 - s) / 60));
  return { known: true, ageWord: m < 2 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`, ist: `published ${fmtIst(s, nowMs)}` };
}
/** "New" means published after the reader's last visit AND first seen by the snapshot after it. An old event fetched again is neither: no badge. With no last visit nothing is "new". */
export function isNewStory(ev: { publishedAt: string | null; firstSeenAt: string | null }, lastVisitSec: number): boolean {
  if (!(lastVisitSec > 0)) return false; const p = sec(ev.publishedAt), f = sec(ev.firstSeenAt); return p != null && f != null && p > lastVisitSec && f > lastVisitSec;
}

/** Which of six screens the news area is in. Pure, so the six can be told apart in a test and a screen cannot show one while meaning another.
 *    loading   nothing has answered yet (or the list is still being assembled)    empty     answered, and there is nothing to list under this view
 *    delayed   the last good check is older than its schedule allows, or the latest check failed   partial   some sources did not answer
 *    error     the service could not be reached and nothing is saved   success   current, with rows
 *  "Unavailable" (nothing was ever published) reads as empty with its own sentence; it is never shown while the first answer is still on its way. */
export type NewsView = 'loading' | 'empty' | 'delayed' | 'partial' | 'error' | 'success';
export function newsViewState(h: Pick<NewsHealth, 'state'>, o: { loading: boolean; rows: number }): NewsView {
  if (o.loading || h.state === 'loading') return 'loading';
  if (h.state === 'error') return 'error';
  if (h.state === 'delayed') return 'delayed';
  if (h.state === 'partial') return 'partial';
  if (h.state === 'unavailable' || o.rows === 0) return 'empty';
  return 'success';
}
