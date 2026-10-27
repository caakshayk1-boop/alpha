/** ONE model of how current the news is, used by Today, the News page, Profile's service line and the Data screen. Pure: the clock and the documents are arguments.
 *
 *  Four states and no fifth. There is no "live": the sources are free feeds read on a schedule, so the best the page can honestly say is that a check succeeded recently.
 *   fresh        the last check succeeded, within what its schedule allows, and every source answered
 *   partial      the last check succeeded but some sources did not answer: what is shown is real, coverage is not complete
 *   delayed      the last good snapshot is older than its schedule allows, or the latest check failed, or the service could not be reached just now: cached stories stay readable, labelled
 *   unavailable  there is no snapshot at all
 *  Three different times are never mixed: when a story was PUBLISHED (its own), when the news was last CHECKED successfully, and when the next check is due. All are shown in Indian time, with the zone. */
import { DELAY_AFTER } from '../news/config.js';
import { cadenceMin } from '../news/schedule.js';
import { fmtIst } from './stamp.ts';

export interface StatusDoc { snapshotVersion: number; status: 'ok' | 'partial' | 'failed'; checkedAt: string | null; lastSuccessfulAt: string | null; nextScheduledAt: string | null; cadenceMin?: number; sourcesTotal?: number; sourcesFailed?: number; lastError?: string | null }
export type NewsState = 'fresh' | 'partial' | 'delayed' | 'unavailable';
export interface NewsHealth {
  state: NewsState; tone: 'ok' | 'warn' | 'bad'; word: string;
  /** The full sentence for the health line. */
  line: string;
  /** The same facts as separate labelled parts, for a layout that shows three timestamps. */
  checked: string | null; lastGood: string | null; next: string | null;
  checkedSec: number | null; lastGoodSec: number | null; nextSec: number | null; ageMin: number | null; reason: string | null;
}
const sec = (iso: string | null | undefined) => { const t = iso ? Date.parse(iso) : NaN; return Number.isFinite(t) ? Math.floor(t / 1000) : null; };
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** How long the page lets the last successful check age before it says "delayed": two cadences (of the session the check ran in) plus ten minutes of grace for GitHub's cron to be late. */
export const allowedAgeMin = (checkedMs: number) => DELAY_AFTER.cadences * cadenceMin(checkedMs) + DELAY_AFTER.graceMin;

/** `doc`: the latest status document (null when none has been read). `unreachable`: reading it failed just now. `remembered`: the last document this browser held, for the unreachable case. */
export function newsHealth({ doc, unreachable = false, remembered = null, nowMs }: { doc: StatusDoc | null; unreachable?: boolean; remembered?: StatusDoc | null; nowMs: number }): NewsHealth {
  const nowSec = nowMs / 1000; const d = doc ?? remembered;
  const out = (state: NewsState, line: string, extra: Partial<NewsHealth> = {}): NewsHealth => {
    const checkedSec = sec(d?.checkedAt), lastGoodSec = sec(d?.lastSuccessfulAt), nextSec = sec(d?.nextScheduledAt);
    return { state, tone: state === 'fresh' ? 'ok' : state === 'unavailable' ? 'bad' : 'warn', word: { fresh: 'Fresh', partial: 'Partial', delayed: 'Delayed', unavailable: 'Unavailable' }[state], line,
      checked: checkedSec != null ? fmtIst(checkedSec, nowMs) : null, lastGood: lastGoodSec != null ? fmtIst(lastGoodSec, nowMs) : null, next: nextSec != null ? fmtIst(nextSec, nowMs) : null, checkedSec, lastGoodSec, nextSec,
      ageMin: lastGoodSec != null ? Math.max(0, Math.round((nowSec - lastGoodSec) / 60)) : null, reason: null, ...extra };
  };
  if (!d || sec(d.lastSuccessfulAt) == null) return out('unavailable', unreachable ? 'News unavailable: the news service could not be reached and no earlier check is saved.' : 'News unavailable: no check has succeeded yet.');
  const good = sec(d.lastSuccessfulAt) as number; const lastGood = fmtIst(good, nowMs);
  if (good > nowSec + 600) return out('delayed', `News delayed - the saved check time (${lastGood}) is in the future and is not trusted.`, { reason: 'future check time' });
  const ageMin = (nowSec - good) / 60; const allowed = allowedAgeMin(good * 1000);
  if (unreachable && !doc) return out('delayed', `News delayed - last successful check ${lastGood}. The news service did not answer just now; the saved copy is shown.`, { reason: 'unreachable' });
  if (d.status === 'failed') return out('delayed', `News delayed - last successful check ${lastGood}. The latest check failed${d.lastError ? ` (${d.lastError})` : ''}; the last good stories are shown.`, { reason: 'latest check failed' });
  if (ageMin > allowed) return out('delayed', `News delayed - last successful check ${lastGood}, ${Math.round(ageMin)} minutes ago; checks run every ${cadenceMin(good * 1000)} minutes at that time of day.`, { reason: 'older than the schedule allows' });
  if (d.status === 'partial') { const f = d.sourcesFailed ?? 0, t = d.sourcesTotal ?? 0; return out('partial', `Partial coverage${t ? `: ${plural(f, 'source')} of ${t} not answering` : ''}. Last successful check ${lastGood}.`, { reason: 'some sources failed' }); }
  const next = sec(d.nextScheduledAt);
  return out('fresh', `Checked ${lastGood}${next && next > nowSec ? ` · next check about ${fmtIst(next, nowMs)}` : ''}`);
}

/** Profile and Data: the same model in the words of a service list. */
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
