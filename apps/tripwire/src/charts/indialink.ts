/** The India link of a macro instrument: which standing global cue (news/cues.js) explains how it reaches an Indian reader, and which sectors it names.
 *  PURE and rule-based. The text is the cue's standing description, written once and the same every day; it states an exposure, never a direction, a cause or a forecast.
 *  An instrument with no cue (Bitcoin, the ringgit crosses) has NO link: this returns null and the card shows nothing, never an invented connection.
 *  Added 12 Nov 2026 (revamp v3, charts). */
import { CUES } from '../../news/cues.js';

/** Macro key -> cue id. GOLD and SILVER are both "Gold and metals"; BRENT and WTI are both "Crude oil"; USDINR is "Dollar and currencies". Pinned by tests/indialink.test.ts
 *  against the cue's own `measure`, so the map cannot drift from news/cues.js. */
export const MACRO_CUE: Readonly<Record<string, string>> = { GOLD: 'metals', SILVER: 'metals', BRENT: 'crude', WTI: 'crude', USDINR: 'dollar' };
/** The measure a macro key stands behind in cues.js (SILVER shares the metals cue, whose measure is GOLD; WTI shares the crude cue, whose measure is BRENT). */
export const MEASURE_ALIAS: Readonly<Record<string, string>> = { SILVER: 'GOLD', WTI: 'BRENT' };

export interface IndiaLink { id: string; label: string; /** how it connects, one sentence or two */ channel: string; /** who is exposed, one line */ exposed: string; sectors: string[]; watch: string }
export function indiaLink(key: string): IndiaLink | null {
  const id = MACRO_CUE[key]; if (!id) return null;
  const c = (CUES as { id: string; label: string; channel: string; exposed: string; sectors: string[]; watch: string }[]).find((x) => x.id === id);
  if (!c) return null;
  return { id: c.id, label: c.label, channel: c.channel, exposed: c.exposed, sectors: [...c.sectors], watch: c.watch };
}
/** Discover opened on one sector, the screen's own sector name. */
export const sectorHref = (sector: string) => `#/discover?sector=${encodeURIComponent(sector)}`;
