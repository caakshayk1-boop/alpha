import { create } from 'xmlbuilder2';
import { DEMO } from '../lib/data.ts';
import { feedAvailable, loadFeed } from '../lib/feed.ts';

export function GET() {
  const paths = ['/', '/terminal/', '/calls/', '/screener/', '/gate/', '/plan/', '/about/', '/method/', '/privacy/', '/terms/'];
  if (feedAvailable()) {
    for (const row of loadFeed().rows) paths.push(`/stock/${encodeURIComponent(row.sym)}/`);
  }
  const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('urlset', { xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9' });
  if (!DEMO) {
    for (const path of paths) root.ele('url').ele('loc').txt(new URL(path, 'https://lockedfree.askakshay.com').href);
  }
  return new Response(root.end({ prettyPrint: true }), { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
