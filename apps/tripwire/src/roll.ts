/** Rolling digits: which character positions changed between two strings. Positions are counted from the END, so a number that grows a digit
 *  on the left (999 to 1,000) still lines its units up with its units. Only digits roll; commas, signs and symbols change in place. */
export interface RollChange { fromEnd: number; from: string; to: string; dir: 'u' | 'd' }
const isDigit = (c: string) => c >= '0' && c <= '9';
export function rollDiff(prev: string, next: string): RollChange[] {
  const a = [...prev], b = [...next]; const out: RollChange[] = [];
  for (let k = 0; k < b.length; k++) {
    const to = b[b.length - 1 - k]; const from = a[a.length - 1 - k];
    if (from === undefined || from === to) continue;
    if (isDigit(to) && isDigit(from)) out.push({ fromEnd: k, from, to, dir: to > from ? 'u' : 'd' });
  }
  return out;
}
