/** What Tripwire can and cannot do, and how anyone knows. Nothing is "Working" because it is configured.
 *
 *  Two separate facts, never merged:
 *    `kind`      what the BUILD contains (a fact about the code):
 *                  probe       a source or a feature with a runtime check: a live probe, a last-success timestamp, a data date or a device test
 *                  not set up  the code could use it, but nothing is configured (no key, no provider): the control does not exist rather than failing
 *                  not built   there is no code for it at all
 *    the status  what the evidence says RIGHT NOW (`serviceStatus`): a word built from a real probe or a last-success time, or "Not verified" when there is none.
 *  A configured service with no evidence reads "Not verified" (or "Configured, not verified" where the configuration is itself a fact), never "Working".
 *  Nothing is "coming soon" and nothing is shown as a button that does nothing. The same list is the table in docs/tripwire/INTEGRATIONS.md (a test keeps them equal).
 *  These details are for whoever runs the service: they are on the Operations page (#/ops), not in the consumer Settings. */
import { freshness } from './fresh.ts';
import type { NewsHealth } from './newshealth.ts';
import { fmtIst } from './stamp.ts';

export type ServiceKind = 'probe' | 'not set up' | 'not built';
export interface Service { id: string; label: string; kind: ServiceKind; what: string; needs: string | null; /** how the status is known: the one thing that makes the word true */ evidence: string }
export const SERVICES: Service[] = [
  { id: 'prices', label: 'Live prices', kind: 'probe', what: 'Yahoo Finance, read by the Worker at /api/tick and /api/bars. Unofficial: it can throttle or change without notice, and the app says so when it does not answer.', needs: null, evidence: 'the Worker asks Yahoo for the Nifty and reads the exchange time of the last print' },
  { id: 'news', label: 'News headlines', kind: 'probe', what: 'Google News and Bing News search feeds plus RBI and SEBI release feeds, read by a scheduled GitHub Actions job (every 15 minutes while the NSE session is on, 30 otherwise; best effort, and often late) and published as one snapshot. When that job is late the Worker may refresh the market stories on demand, labelled as such. Stories are admitted only if they name a covered company or an India-wide event.', needs: null, evidence: 'the time of the last SUCCESSFUL scheduled check, from the published status file' },
  { id: 'screen', label: 'Published screen', kind: 'probe', what: 'The company screen is built nightly in the research repository and fetched when this site is built.', needs: null, evidence: 'the data date inside the screen, against the exchange calendar' },
  { id: 'ledger', label: 'Forward ledger', kind: 'probe', what: 'Written by one workflow on GitHub\'s scheduler, append-only; the app reads it live.', needs: null, evidence: 'the time the ledger file says it was last written' },
  { id: 'backup', label: 'Saving on this device', kind: 'probe', what: 'Your notes, plans and paper trades are saved in this browser, and can be exported and imported as a file. Nothing is sent anywhere.', needs: null, evidence: 'a write and read of a test value in this browser\'s storage' },
  { id: 'lock', label: 'Screen lock', kind: 'probe', what: "Uses the phone's own unlock. It locks the screen; it does not encrypt what is stored.", needs: null, evidence: 'whether this device and browser offer a platform authenticator' },
  { id: 'nudge', label: 'Scheduler nudge', kind: 'not set up', what: 'A Cloudflare cron trigger that asks GitHub to start the news job on time, because GitHub\'s own scheduler starts hours late. The trigger and handler are built; with no token set the handler does nothing.', needs: 'A fine-grained GitHub token limited to this repository with Actions read and write, set as the Worker secret GITHUB_DISPATCH_TOKEN.', evidence: 'nothing is configured' },
  { id: 'accounts', label: 'Accounts and sign-in', kind: 'not set up', what: 'No identity provider is configured, so there is no account and nothing is tied to a person.', needs: 'A provider with its client id, secret and callback URL set as Worker secrets, and a privacy notice update.', evidence: 'nothing is configured' },
  { id: 'sync', label: 'Sync between devices', kind: 'not built', what: 'State lives in this browser. Two devices do not share it.', needs: 'Accounts first, then a per-user store and a conflict rule.', evidence: 'there is no code' },
  { id: 'notifications', label: 'Notifications and alerts', kind: 'not built', what: 'Nothing is sent. Review dates and changes appear on Today when the app is opened.', needs: 'Web Push keys as Worker secrets, a subscription store tied to an account, a push handler, and on iPhone the app added to the Home Screen.', evidence: 'there is no code' },
  { id: 'email', label: 'E-mail', kind: 'not set up', what: 'Tripwire sends none. The separate waitlist for the Pro app is a different service.', needs: 'A sender domain and a mail API key.', evidence: 'nothing is configured' },
  { id: 'broker', label: 'Broker connection and orders', kind: 'not built', what: 'None, by design. Every position is paper and no order is ever placed.', needs: null, evidence: 'there is no code, by design' },
];
/** The word the INTEGRATIONS.md table uses for a kind of service (the build's fact, not the live status). */
export const KIND_WORD: Record<ServiceKind, string> = { probe: 'Checked at runtime', 'not set up': 'Not set up', 'not built': 'Not built' };

/** The evidence the Operations page gathers. Every field is "unknown" (null/undefined) until a real check answers. */
export interface Evidence {
  nowMs: number;
  /** /api/health: null while loading or when it did not answer */
  health: { prices: { ok: boolean; last_print: string | null; age_sec: number | null; error: string | null }; checked_at: string } | null; healthErr: boolean;
  news: NewsHealth | null; screenAsOf: string | null; ledgerUpdated: string | null; storageOk: boolean | null; lockSupported: boolean | null;
}
export type Tone = 'lime' | 'peach' | '';
export interface ServiceStatus { word: string; tone: Tone; line: string }
const NOT_VERIFIED = (why: string): ServiceStatus => ({ word: 'Not verified', tone: 'peach', line: why });
/** The status of one service from the evidence in hand. A word is claimed only when its evidence exists; otherwise "Not verified". */
export function serviceStatus(v: Service, e: Evidence): ServiceStatus {
  if (v.kind === 'not set up') return { word: 'Not set up', tone: 'peach', line: v.what };
  if (v.kind === 'not built') return { word: 'Not built', tone: 'peach', line: v.what };
  switch (v.id) {
    case 'prices': {
      if (e.healthErr) return NOT_VERIFIED('The status check did not answer, so the price source could not be checked.'); if (!e.health) return NOT_VERIFIED('Checking the price source.');
      const p = e.health.prices; if (!p.ok) return { word: 'Not answering', tone: 'peach', line: `The price source did not answer (${p.error ?? 'no reply'}) at ${fmtIst(Date.parse(e.health.checked_at) / 1000, e.nowMs)}.` };
      return { word: 'Answering', tone: 'lime', line: `Answered at ${fmtIst(Date.parse(e.health.checked_at) / 1000, e.nowMs)}${p.last_print ? `; its last exchange print was ${fmtIst(Date.parse(p.last_print) / 1000, e.nowMs)}` : ''}.` };
    }
    case 'news': { const h = e.news; if (!h) return NOT_VERIFIED('The news status has not been read.'); return { word: h.word, tone: h.state === 'fresh' ? 'lime' : 'peach', line: h.line }; }
    case 'screen': {
      if (!e.screenAsOf) return NOT_VERIFIED('The screen carries no data date.'); const f = freshness(e.screenAsOf, new Date(e.nowMs));
      return { word: f.word, tone: f.tone, line: `Prices through the close of ${e.screenAsOf}${f.behind ? `; ${f.behind} session${f.behind === 1 ? '' : 's'} behind the last finished one` : ''}.` };
    }
    case 'ledger': {
      const t = e.ledgerUpdated ? Date.parse(e.ledgerUpdated) : NaN; if (!Number.isFinite(t)) return NOT_VERIFIED('The ledger has not been read, or has not been written yet.');
      return { word: 'Written', tone: 'lime', line: `The ledger file says it was last written ${fmtIst(t / 1000, e.nowMs)}.` };
    }
    case 'backup': return e.storageOk == null ? NOT_VERIFIED('Storage has not been tested yet.') : e.storageOk ? { word: 'Saving', tone: 'lime', line: 'A test value was written to and read back from this browser\'s storage.' } : { word: 'Not saving', tone: 'peach', line: 'This browser would not keep a test value (private mode or full storage). Notes would be lost when the tab closes; export a backup.' };
    case 'lock': return e.lockSupported == null ? NOT_VERIFIED('Checking what this device supports.') : e.lockSupported ? { word: 'Supported here', tone: 'lime', line: 'This device and browser offer a platform authenticator. Whether it is switched on is a setting.' } : { word: 'Not supported here', tone: 'peach', line: 'This browser has no device unlock Tripwire can use.' };
    default: return NOT_VERIFIED('No check exists for this service.');
  }
}
/** What the haptics row says. Having the API or the switch control is not proof that a tap happens, and the page does not claim it. */
export function hapticsNote(kind: 'vibrate' | 'ios-switch' | 'none'): string {
  return { vibrate: 'This browser offers the vibration call, and Tripwire asks it for a short tap. Whether this phone actually vibrates has not been verified here; some devices and settings ignore the request.',
    'ios-switch': 'This iPhone browser reports the system switch control, which Tripwire toggles to ask for the system tap. That route is not documented by Apple and has not been verified on a real device.',
    none: 'Not supported in this browser or device, so this switch is off.' }[kind];
}
