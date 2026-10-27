/** "1 company", "2 companies". One place for the rule, so a count never prints "1 companies" or "2 repeated line s".
 *  `many` defaults to `one` + "s"; pass it for the irregular ones ("company", "companies"). Indian digit grouping above 999. */
export const plural = (n: number, one: string, many: string = `${one}s`): string => `${Number.isFinite(n) ? n.toLocaleString('en-IN') : '0'} ${n === 1 ? one : many}`;
/** The word alone, for a sentence that already prints the number itself: `${n} ${pluralWord(n, 'name')}`. */
export const pluralWord = (n: number, one: string, many: string = `${one}s`): string => (n === 1 ? one : many);
