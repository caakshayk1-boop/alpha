import { editions } from '../lib/data.ts'; import { weeksOf } from '../lib/edition.ts';
import { create } from 'xmlbuilder2';
import { DEMO, ledger, markFn, prices } from '../lib/data.ts'; import { callModels } from '../lib/callpage.ts';
import { feedAvailable, loadFeed } from '../lib/feed.ts';

export function GET() {
  const paths = ['/', '/terminal/', '/calls/', '/screener/', '/practice/', '/gate/', '/plan/', '/about/', '/method/', '/privacy/', '/terms/', '/editions/', '/status/'];
  for (const e of editions()) paths.push(`/editions/${e.date}/`);
  for (const w of weeksOf(editions())) paths.push(`/editions/week/${w[w.length - 1].date}/`);
  for (const c of callModels(ledger(), markFn(), prices)) paths.push(`/call/${c.slug}/`);
  if (feedAvailable()) {
    for (const row of loadFeed().rows) paths.push(`/stock/${encodeURIComponent(row.sym)}/`);
  }
  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('urlset', { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9' });
  if (!DEMO) {
    for (const path of paths) root.ele('url').ele('loc').txt(new URL(path, 'https://lockedfree.askakshay.com').href);
  }
  return new Response(root.end({ prettyPrint: true }), { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
