/** What Tripwire can and cannot do, said once. Three honest states and no fourth:
 *    working      a real feature or data source that is configured and used now (its live status, where it has one, comes from /api/health)
 *    not set up   the code could use it, but nothing is configured (no key, no provider): the control does not exist rather than failing
 *    not built    there is no code for it at all
 *  Nothing here is "coming soon" and nothing is shown as a button that does nothing. The same list is the table in docs/tripwire/INTEGRATIONS.md (a test keeps them equal). */
export type ServiceState = 'working' | 'not set up' | 'not built';
export interface Service { id: string; label: string; state: ServiceState; what: string; needs: string | null; /** the service is set up in the app, but whether THIS device can use it is a separate fact (see `publicStatus`) */ device?: true }
export const SERVICES: Service[] = [
  { id: 'prices', label: 'Live prices', state: 'working', what: 'Yahoo Finance, read by the Worker at /api/tick and /api/bars. Unofficial: it can throttle or change without notice, and the app says so when it does not answer.', needs: null },
  { id: 'news', label: 'News headlines', state: 'working', what: 'Google News and Bing News RSS, read by the Worker, filtered to what bears on a decision.', needs: null },
  { id: 'screen', label: 'Published screen and the forward ledger', state: 'working', what: 'The screen is fetched when the site is built; the ledger is written by one nightly workflow and is append-only.', needs: null },
  { id: 'backup', label: 'Backup and restore', state: 'working', what: 'Export, import and merge as a file, plus a journal CSV, tested end to end. Your data lives only in this browser until you export it.', needs: null },
  { id: 'lock', label: 'Screen lock', state: 'working', what: "Uses the phone's own unlock. It locks the screen; it does not encrypt what is stored.", needs: null, device: true },
  { id: 'accounts', label: 'Accounts and sign-in', state: 'not set up', what: 'No identity provider is configured, so there is no account and nothing is tied to a person.', needs: 'A provider with its client id, secret and callback URL set as Worker secrets, and a privacy notice update.' },
  { id: 'sync', label: 'Sync between devices', state: 'not built', what: 'State lives in this browser. Two devices do not share it.', needs: 'Accounts first, then a per-user store and a conflict rule.' },
  { id: 'notifications', label: 'Notifications and alerts', state: 'not built', what: 'Nothing is sent. Review dates and changes appear on Today when the app is opened.', needs: 'Web Push keys as Worker secrets, a subscription store tied to an account, a push handler, and on iPhone the app added to the Home Screen.' },
  { id: 'email', label: 'E-mail', state: 'not set up', what: 'Tripwire sends none. The separate waitlist for the Pro app is a different service.', needs: 'A sender domain and a mail API key.' },
  { id: 'broker', label: 'Broker connection and orders', state: 'not built', what: 'None, by design. Every position is paper and no order is ever placed.', needs: null },
];
export const STATE_WORD: Record<ServiceState, string> = { working: 'Working', 'not set up': 'Not set up', 'not built': 'Not built' };

/** What the public settings page says about one service, in plain words. Two separate facts are never merged: whether the app is set up for it (`state`, a fact about the build)
 *  and whether THIS device can use it (`device`: true, false, or null while it is still being asked). A feature the device cannot use is never called "Working". */
export interface PublicStatus { word: string; tone: 'lime' | 'peach' | ''; deviceLine: string | null }
export function publicStatus(v: Service, probe: { ok: boolean } | null, device: boolean | null): PublicStatus {
  if (v.state !== 'working') return { word: STATE_WORD[v.state], tone: 'peach', deviceLine: null };
  if (probe && !probe.ok) return { word: 'Not answering', tone: 'peach', deviceLine: null };
  if (!v.device) return { word: STATE_WORD.working, tone: 'lime', deviceLine: null };
  return { word: 'Configured', tone: device ? 'lime' : '', deviceLine: device === null ? 'This device: checking' : device ? 'This device: supported' : 'This device: not supported in this browser' };
}
/** What the haptics row says. Having the API or the switch control is not proof that a tap happens, and the page does not claim it. */
export function hapticsNote(kind: 'vibrate' | 'ios-switch' | 'none'): string {
  return { vibrate: 'This browser offers the vibration call, and Tripwire asks it for a short tap. Whether this phone actually vibrates has not been verified here; some devices and settings ignore the request.',
    'ios-switch': 'This iPhone browser reports the system switch control, which Tripwire toggles to ask for the system tap. That route is not documented by Apple and has not been verified on a real device.',
    none: 'Not supported in this browser or device, so this switch is off.' }[kind];
}
