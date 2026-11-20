import { loadFeed } from '../../lib/feed.ts';
import { ledger } from '../../lib/data.ts';

export function GET() {
  const feed = loadFeed(), book = ledger();
  const { counted, advancing, declining, above200_count, above200_eligible, above200 } = feed.meta.breadth;
  return Response.json({
    schema: 'rulebook-snapshot/1',
    close: feed.asOf, built: feed.builtOn, tracked: feed.rows.length,
    breadth: { source: 'daily screen rows', counted, advancing, declining,
      unchanged: counted - advancing - declining, above200_count, above200_eligible, above200_percent: above200 },
    ledger: { date: book.as_of, schema: book.schema, charges: book.config.charges_version },
    screens: book.screens.map(screen => ({ id: screen.id, version: screen.version,
      latestRun: book.runs.filter(run => run.screen_id === screen.id).at(-1)?.run_date ?? null }))
  });
}
