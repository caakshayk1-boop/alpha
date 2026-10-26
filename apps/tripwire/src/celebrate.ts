/** A closed paper win is announced once, in words, and remembered so it never repeats. There is no confetti or other reward effect: a paper result from an
 *  experimental engine is a data point, and an effect that celebrates profit would make it feel like more than that. */
const KEY = 'tripwire:celebrated';
const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };
export const hasCelebrated = (id: string) => read().includes(id);
export function markCelebrated(ids: string[]) { try { localStorage.setItem(KEY, JSON.stringify([...new Set([...read(), ...ids])].slice(-200))); } catch { /* private mode: it may repeat once */ } }
