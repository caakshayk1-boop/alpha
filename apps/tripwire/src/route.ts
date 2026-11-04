/** Which hash addresses the app answers. Anything else is a "Not found" page, never a silent fall-through to Today. Pure, so it is unit-tested. */

/** The first path segment of every address the app routes. `#/` and `#/today` are Today. */
export const KNOWN_HEADS: readonly string[] = ['', 'today', 'discover', 'desk', 'more', 'signals', 'settings', 'profile', 'data', 'methodology', 'help', 'ops', 'live', 'paper', 'book', 'news', 'markets', 'lab', 'c', 'm', 'compare', 'report', 'privacy', 'terms'];

export type Resolved = { kind: 'ok'; head: string } | { kind: 'notfound'; asked: string };
const TOO_LONG = 80;
/** The address as the person typed it, shortened for display. Always printed as text, never as markup or a link. */
export function askedPath(path: readonly string[]): string {
  const raw = '/' + path.map((p) => { try { return decodeURIComponent(p); } catch { return p; } }).join('/');
  return raw.length > TOO_LONG ? raw.slice(0, TOO_LONG - 1) + '…' : raw;
}
/** Addresses are lower case: `#/Today` is not a route (it used to open Today by accident, and a link that works by accident breaks the day the accident is fixed). */
/** The heads that take exactly one more segment (a symbol or an instrument). Every other head takes none: the rest of its address is the query string. */
export const NEEDS_ARGUMENT: readonly string[] = ['c', 'm', 'report'];
export function resolveRoute(path: readonly string[]): Resolved {
  const segs = [...path]; while (segs.length && segs[segs.length - 1] === '') segs.pop();   // `#/today/` is `#/today`
  const head = segs[0] ?? '';
  /* a known first word is not enough: `#/c` (no company), `#/m`, `#/report` and `#/today/extra` each used to fall through to another screen by accident */
  const want = NEEDS_ARGUMENT.includes(head) ? 2 : 1;
  const shapeOk = head === '' ? segs.length === 0 : segs.length === want && (want === 1 || !!segs[1]);
  return KNOWN_HEADS.includes(head) && shapeOk ? { kind: 'ok', head } : { kind: 'notfound', asked: askedPath(path) };
}
