/** The exact number of companies Alpha screens and the day it describes, read at BUILD time from public/universe.json (written by scripts/shard.mjs from the published screen).
 *  Page metadata used to say "nearly 1,000"; this keeps the words and the data from drifting apart. If the file is missing or looks wrong, the wording falls back to the old vague phrase rather than guess a number. */
import { readFileSync } from 'node:fs';

export interface UniverseFacts { count: number | null; asOf: string | null }
export function universeFacts(read: (p: string) => string = (p) => readFileSync(p, 'utf8')): UniverseFacts {
  try {
    const j = JSON.parse(read('public/universe.json')) as { count?: unknown; rows?: unknown; as_of?: unknown };
    const n = Array.isArray(j.rows) ? j.rows.length : null;
    const count = typeof n === 'number' && n >= 100 ? n : null;
    const asOf = typeof j.as_of === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.as_of) ? j.as_of : null;
    return { count, asOf };
  } catch { return { count: null, asOf: null }; }
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dmy = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
/** "999 companies" or, when the count is not known, "about 1,000 companies". */
export const companiesPhrase = (f: UniverseFacts = universeFacts()) => (f.count ? `${f.count.toLocaleString('en-IN')} companies` : 'about 1,000 companies');
/** "999 companies as of 26 Nov 2026", or the plain phrase when either part is missing. */
export const companiesAsOf = (f: UniverseFacts = universeFacts()) => (f.count && f.asOf ? `${companiesPhrase(f)} as of ${dmy(f.asOf)}` : companiesPhrase(f));
