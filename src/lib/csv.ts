/** One CSV cell, safe to open in a spreadsheet (Pro §10): quoted, inner quotes doubled, and text that a spreadsheet would
 *  run as a formula (=, +, -, @, tab, carriage return at the start) prefixed with an apostrophe. Numbers pass through. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
export const csvRow = (cells: unknown[]) => cells.map(csvCell).join(',');
/** The two rows every export starts with: where the figures come from and as of when (Pro §28 P2 "as-of and source rows"). */
export const csvProvenance = (source: string, asOf: string) => [csvRow(['source', source]), csvRow(['as_of', asOf]), ''];
