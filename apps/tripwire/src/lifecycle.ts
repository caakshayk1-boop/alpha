/** Lifecycle identity (12 Nov 2026). One position, from the night it was taken to the day it finished, has ONE stable id. A symbol may close one lifecycle and later open a genuinely new one:
 *  identity is never the symbol. Pure and dependency-free (the saved-state code imports it), so the id helpers cost nothing to load.
 *  The id is DERIVED from an id that is already immutable (a ledger pick id, or a paper trade's own id); `Paper.lifecycleId` is an additive field that older saved states do not have. */
export const lifecycleIdFor = (id: string): string => `lc:${id}`;
/** The lifecycle id of a position: the stored one when it is a non-empty string, else the derived one (an old payload, or a malformed field, migrates on read). */
export const lifecycleIdOf = (p: { id: string; lifecycleId?: unknown }): string => (typeof p.lifecycleId === 'string' && p.lifecycleId.trim() ? p.lifecycleId : lifecycleIdFor(p.id));
/** Give every position a lifecycle id and make them unique. A duplicate (a hand-edited or merged backup) is RE-KEYED from the position's own id, never dropped: both positions survive. */
export function normalizeLifecycles<T extends { id: string; lifecycleId?: unknown }>(ps: readonly T[]): (T & { lifecycleId: string })[] {
  const seen = new Set<string>();
  return ps.map((p) => {
    let id = lifecycleIdOf(p);
    if (seen.has(id)) { id = lifecycleIdFor(p.id); for (let n = 2; seen.has(id); n++) id = `${lifecycleIdFor(p.id)}#${n}`; }
    seen.add(id); return { ...p, lifecycleId: id };
  });
}
