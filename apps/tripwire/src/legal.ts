/** Facts the Privacy and Terms pages share. The date is a constant on purpose: it changes when the text changes, never with the clock. */
export const LEGAL_UPDATED = '2026-11-02';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "2026-11-02" -> "2 November 2026". Returns the input unchanged if it is not a plain ISO day. */
export function legalDate(iso: string = LEGAL_UPDATED): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso); if (!m) return iso;
  const mo = Number(m[2]), d = Number(m[3]); if (mo < 1 || mo > 12 || d < 1 || d > 31) return iso;
  return `${d} ${MONTHS[mo - 1]} ${m[1]}`;
}
