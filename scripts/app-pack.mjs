/** Pack the app edition: take the app build (out-app-build/), keep only the app's pages and their assets, and write what the app's own
 *  host needs: a _redirects that sends every other page of the full site to that page on the full site, the app's manifest, a sitemap
 *  and robots.txt for the app's address, and a report. Run by `npm run build:app`; deterministic; touches nothing outside out-app/.
 *    NEXT_PUBLIC_APP_URL   the address the app is launched at. Unset: robots disallow everything and nothing is indexed. */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ROUTES, FULL_SITE, inApp } from '../src/lib/edition.ts';
import { FULL_PAGES } from '../src/lib/routes.ts';

const SRC = 'out-app-build', DEST = 'out-app';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
if (!existsSync(SRC)) { console.error(`${SRC}/ is missing: run \`npm run build:app\`.`); process.exit(1); }
rmSync(DEST, { recursive: true, force: true });
cpSync(SRC, DEST, { recursive: true });

// 1. Every top-level folder that is a page (has an index.html) and is not in the app is removed. Assets, data and shards are not pages.
const NOT_PAGES = new Set(['_next', 'c', 'data', 'icons', 'og', '404']);
const removed = [];
for (const d of readdirSync(DEST)) {
  const full = join(DEST, d);
  if (!statSync(full).isDirectory() || NOT_PAGES.has(d)) continue;
  if (existsSync(join(full, 'index.html')) && !inApp(`/${d}/`)) { rmSync(full, { recursive: true, force: true }); removed.push(`/${d}/`); }
}
// pages of the full site that are listed in the manifest but have no folder of their own are still redirected
const excluded = [...new Set([...removed, ...FULL_PAGES.map((p) => p.href).filter((h) => h !== '/' && !inApp(h))])].filter((h) => h !== '/404/').sort();
// data only an excluded page reads, and files the app does not publish
for (const f of ['signal_brief.json', 'sitemap-companies.xml', 'sitemap.xml', 'robots.txt', 'manifest.webmanifest', '_redirects']) rmSync(join(DEST, f), { force: true });

// 2. Redirects: the rules the full site already has, then one per excluded page. Cloudflare takes absolute targets and :splat.
const base = existsSync('public/_redirects') ? readFileSync('public/_redirects', 'utf8').trimEnd() : '';
const lines = [base, '', '# Pages of the full site that are not part of the app go to the same page there.'];
for (const h of excluded) { const bare = h.replace(/\/$/, ''); lines.push(`${bare} ${FULL_SITE}${h} 302`, `${bare}/* ${FULL_SITE}${h}:splat 302`); }
writeFileSync(join(DEST, '_redirects'), lines.join('\n') + '\n');

// 3. The app's manifest: same mark and colours, its own shortcuts.
const full = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
writeFileSync(join(DEST, 'manifest.webmanifest'), JSON.stringify({
  ...full, name: 'alpha: signals by rule, your names, your desk', short_name: 'alpha', start_url: '/?source=app', id: '/',
  description: 'The daily research app for Indian stocks: which names meet which rule, the evidence on the companies you follow, and position sizing. Working shown, never advice.',
  shortcuts: [{ name: 'Signals', url: '/engines/' }, { name: 'Find a company', url: '/screen/' }, { name: 'My Desk', url: '/desk/' }],
}, null, 2) + '\n');

// 4. Sitemap and robots for the app's own address. With no address set the app asks not to be indexed.
if (APP_URL) {
  const urls = APP_ROUTES.filter((r) => !['/watchlist/', '/journal/'].includes(r)).map((r) => `<url><loc>${APP_URL}${r}</loc></url>`).join('\n');
  writeFileSync(join(DEST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  writeFileSync(join(DEST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${APP_URL}/sitemap.xml\n`);
} else {
  writeFileSync(join(DEST, 'robots.txt'), 'User-agent: *\nDisallow: /\n# The app has no public address set (NEXT_PUBLIC_APP_URL), so it asks not to be indexed.\n');
}

// 5. Report.
const count = (d) => readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(join(d, e.name)) : 1), 0);
const pages = readdirSync(DEST).filter((d) => d !== '404' && existsSync(join(DEST, d, 'index.html'))).map((d) => `/${d}/`);
const report = { built: 'app', appUrl: APP_URL || null, indexable: !!APP_URL, pages: ['/', ...pages].sort(), removedPages: removed, redirectedToFullSite: excluded, files: count(DEST) };
writeFileSync(join(DEST, 'app-report.json'), JSON.stringify(report, null, 1) + '\n');
console.log(`app edition packed in ${DEST}/: ${report.pages.length} pages kept (${report.pages.join(' ')}), ${removed.length} removed, ${excluded.length} redirected to ${FULL_SITE}, ${report.files} files, ${report.indexable ? `indexable at ${APP_URL}` : 'not indexable (no NEXT_PUBLIC_APP_URL)'}`);
