/** The results date on a company page (12 Nov 2026 fix). The data holds ONE estimated "next results" date per name and nothing refreshes it once it passes, so on Wed 12 Nov the
 *  Calendar read "Thu 8 Oct: Next results, estimated date". A date before today (IST) is not a next date. It is the last estimate we were given, and it says so; the app never
 *  rolls a date forward by guessing a quarter, and never calls it upcoming until a newer one is supplied. Pure: the clock is a parameter, the session day is the IST calendar day. */
import { istClock } from './calendar.ts';
import { dayWord } from './fmt.ts';

export type ResultsState = 'upcoming' | 'today' | 'past' | 'missing';
/** Provenance carried as supplied. None of it is invented: an absent field prints nothing. */
export interface ResultsMeta { source?: string | null; status?: string | null; asOf?: string | null }
export interface ResultsDate {
  state: ResultsState; date: string | null;
  /** is this a NEXT date a reader may plan around (upcoming, or today) */ next: boolean;
  /** the day word on the tag: "Thu 20 Nov", or "Today" */ tag: string;
  /** one sentence for the Calendar row */ line: string;
  /** a few words for a summary or a grid cell */ short: string;
  /** days from today (IST) to the date: negative when it has passed; null when there is no usable date */ days: number | null;
}
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const dn = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86400000;
const noWd = (w: string) => w.replace(/^\w+ /, '');
const prov = (m?: ResultsMeta): string => { const bits = [m?.source ? `source ${m.source}` : null, m?.status ? `status ${m.status}` : null, m?.asOf ? `supplied ${dayWord(m.asOf)}` : null].filter(Boolean); return bits.length ? ` (${bits.join(', ')})` : ''; };

export function resultsDate(next: string | null | undefined, nowMs: number, meta?: ResultsMeta): ResultsDate {
  const raw = typeof next === 'string' ? next.slice(0, 10) : '';
  if (!ISO.test(raw) || !Number.isFinite(dn(raw))) return { state: 'missing', date: null, next: false, tag: 'Unknown', line: 'No results date is published', short: 'Not published', days: null };
  const days = dn(raw) - dn(istClock(nowMs).day); const w = dayWord(raw);
  if (days < 0) return { state: 'past', date: raw, next: false, tag: w, line: `Last supplied estimate: ${noWd(w)}; next date unavailable${prov(meta)}`, short: 'Next date unavailable', days };
  if (days === 0) return { state: 'today', date: raw, next: true, tag: 'Today', line: `Results expected today, estimated date${prov(meta)}`, short: 'Expected today (estimate)', days };
  return { state: 'upcoming', date: raw, next: true, tag: w, line: `Next results, estimated date${prov(meta)}`, short: `${noWd(w)} (estimate)`, days };
}
