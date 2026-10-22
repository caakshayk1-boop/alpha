/** Sentences the upstream screen writes that misstate what was measured, rewritten to the measure itself before display.
 *  The screen (trading-dashboard repo) is a separate project; until its own text changes, every renderer passes upstream flag
 *  text through here, so the page never repeats the error. Pure; tested in tests/lib.test.ts. */
const RULES: [RegExp, (...m: string[]) => string][] = [
  // ATR is the average high-to-low range including gaps, not an average daily move (C16)
  [/^Moves ([\d.]+)% a day on average\.?$/i, (_, x) => `Average true range is ${x}% of price`],
  // the ratio is operating cash flow over net profit, not "cash profit" (C17)
  [/\bcash profit\b/gi, () => 'operating cash flow / net profit'],
];
export function fixCopy(text: string): string {
  let out = text;
  for (const [re, f] of RULES) out = out.replace(re, f as (s: string, ...a: string[]) => string);
  return out;
}
