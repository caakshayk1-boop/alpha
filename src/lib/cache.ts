/** How long a response may be reused before it is fetched again (A12, 21 Oct 2026). A tab left open across the close and
 *  into the next session must not keep showing the first answer it got, which is what a cache with no lifetime did. */
export function ttlFor(url: string): number {
  if (/\/api\/(quotes|px|live|intraday|summary)/.test(url)) return 2 * 60_000;
  if (/\/api\//.test(url)) return 15 * 60_000;          // chart, ipo-live, instrument
  if (/\/c\/[^/]+\.json/.test(url)) return 30 * 60_000;  // a company's shard
  return 10 * 60_000;                                   // feeds, signals, rotation, universe
}
