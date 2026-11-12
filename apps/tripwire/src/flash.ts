/** The price cue (12 Nov 2026, master prompt PHASE 4). Pure: no DOM, no clock of its own, so every row of the event table is a unit test.
 *
 *  A cue is a statement about ONE metric on ONE basis: the new accepted observation against the previous accepted observation of that same metric on that same basis.
 *  It is never the sign of a lifetime P&L (a profitable position can tick down) and never a gain or a loss when the basis itself changed (live to recorded).
 *
 *  Event table:
 *    initial load, quote restored, basis changed   -> 'neutral'  (a quiet reveal; no up or down)
 *    accepted value higher than the previous       -> 'up'
 *    accepted value lower than the previous        -> 'down'
 *    unchanged value (or the same text on screen)  -> 'none'     (no flash, no roll)
 *    stale, missing, failed poll                   -> 'none'     (the status is said in words by the caller; no pulse)
 *    recorded fallback                             -> 'none' on the same basis, 'neutral' when it replaces a live one (a basis change)
 *  A confirmed fill or exit is a separate dated lifecycle event and never comes from here. */
export type Cue = 'none' | 'neutral' | 'up' | 'down';
export type ObsState = 'live' | 'recorded' | 'stale' | 'missing' | 'failed';
export interface Obs {
  /** the number observed; null or undefined = nothing observed */
  v: number | null | undefined;
  /** what the number is a price OF: 'live', 'recorded', a session close... A change of basis is never a gain or a loss. */
  basis: string;
  /** default 'live'. stale, missing and failed are never accepted. */
  state?: ObsState;
  /** the text the reader sees; identical text is "unchanged" even if the underlying number moved below the shown precision */
  text?: string;
}
export const stateOf = (o: Obs): ObsState => o.state ?? (o.basis === 'recorded' ? 'recorded' : 'live');
/** An accepted observation is a finite number that came from a live or a recorded read. Anything else is a status, not a value. */
export function accepted(o: Obs | null | undefined): o is Obs & { v: number } {
  if (!o || typeof o.v !== 'number' || !Number.isFinite(o.v)) return false;
  const s = stateOf(o); return s === 'live' || s === 'recorded';
}
/** The cue for `next`, given the observation before it (any kind: a gap is read from `prev` not being accepted). */
export function nextCue(prev: Obs | null | undefined, next: Obs): Cue {
  if (!accepted(next)) return 'none';
  if (!accepted(prev)) return 'neutral';                       // initial load, or the quote is back after a gap
  if (prev.basis !== next.basis) return 'neutral';             // live to recorded (or back) is a basis change, not a gain or a loss
  if (stateOf(next) === 'recorded') return 'none';             // a recorded value on its own basis has no live movement to show
  if (prev.text !== undefined && next.text !== undefined && prev.text === next.text) return 'none';
  if (next.v === prev.v) return 'none';
  return next.v > prev.v ? 'up' : 'down';
}
/** The word a screen reader gets in place of the colour. */
export const cueWord = (c: Cue): string => (c === 'up' ? 'up' : c === 'down' ? 'down' : '');

/** Coalescing: updates arriving inside one window are one update. The first observation commits at once; later ones inside the window wait, the latest wins, and the cue is
 *  worked out against what was last COMMITTED, so up-then-down inside a window that nets to nothing shows nothing. The effect is never restarted by a render or an unchanged poll. */
export const COALESCE_MS = 500;
export interface FlashState { committed: Obs | null; pending: Obs | null; at: number }
export const flashInit = (): FlashState => ({ committed: null, pending: null, at: -Infinity });
export interface FlashStep { state: FlashState; cue: Cue; /** ms until flush() must be called, or null */ flushIn: number | null }
export function flashPush(s: FlashState, o: Obs, now: number, windowMs = COALESCE_MS): FlashStep {
  const wait = s.at + windowMs - now;
  if (wait > 0 && s.committed) return { state: { ...s, pending: o }, cue: 'none', flushIn: wait };
  return commit(s, o, now);
}
export function flashFlush(s: FlashState, now: number): FlashStep {
  return s.pending ? commit({ ...s, pending: null }, s.pending, now) : { state: s, cue: 'none', flushIn: null };
}
function commit(s: FlashState, o: Obs, now: number): FlashStep {
  const cue = nextCue(s.committed, o);
  // an observation that is not accepted is still recorded as committed: it is the gap the next accepted value is "restored" from
  return { state: { committed: o, pending: null, at: now }, cue, flushIn: null };
}

/** How long a cue stays on the page, ms: the halo fades fully in this long (tokens.css --halo-dur is 600 ms). */
export const CUE_MS = 640;
