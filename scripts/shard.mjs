// shard.mjs — runs before every build. Splits the big company feeds into one small file per company, public/c/<SYM>.json,
// so a company page downloads about 6 KB instead of 1.5 MB and parses none of the other 988. If a feed cannot be read the
// build carries on without shards: the page falls back to the full feeds (slower, never wrong).
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';

const RAW = 'https://raw.githubusercontent.com/caakshayk1-boop/trading-dashboard/main/docs';
const SIG = 'https://raw.githubusercontent.com/caakshayk1-boop/signal/main/public';
const get = async (u) => { const r = await fetch(u, { signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(`${u} answered ${r.status}`); const t = await r.text(); return JSON.parse(t.replace(/\bNaN\b/g, 'null')); };

try {
  const [screen, detail, swot, season, inst] = await Promise.all([get(`${RAW}/screen.json`), get(`${RAW}/screen-detail.json`), get(`${RAW}/swot.json`), get(`${RAW}/seasonality.json`), get(`${SIG}/institutional.json`).catch(() => ({ rows: {} }))]);
  if (!Array.isArray(screen.rows) || screen.rows.length < 500) throw new Error('screen looks empty: refusing to shard');
  rmSync('public/c', { recursive: true, force: true });
  mkdirSync('public/c', { recursive: true });
  let n = 0;
  for (const row of screen.rows) {
    const s = row.sym;
    if (!/^[A-Za-z0-9&-]{1,20}$/.test(s)) continue;
    writeFileSync(`public/c/${s}.json`, JSON.stringify({ sym: s, built_on: screen.built_on, count: screen.count, row, years: detail.detail?.[s]?.years ?? null, swot: swot.swot?.[s] ?? null, inst: inst.rows?.[s] ?? null, season: season.stocks?.[s] ?? null }));
    n++;
  }
  console.log(`shard: ${n} companies, screen built ${screen.built_on}`);
  // The live-price universe: every screened symbol with its sector, name, 200-day average and 52-week high (the live Barometer's
  // breadth inputs, as of the screen build), read by /api/live (worker) and lib/live.ts. Sorted, so
  // the Worker's two halves are stable between requests.
  const uni = screen.rows.filter((r) => /^[A-Za-z0-9&-]{1,20}$/.test(r.sym)).map((r) => [r.sym, r.sector ?? '', r.name ?? r.sym, Number.isFinite(r.sma200) ? r.sma200 : null, Number.isFinite(r.high52) ? r.high52 : null]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  writeFileSync('public/universe.json', JSON.stringify({ built_on: screen.built_on, as_of: screen.breadth?.as_of ?? null, count: uni.length, rows: uni }));
  console.log(`shard: universe.json with ${uni.length} symbols`);
  // One URL per company page (app/company/[slug]), dated with the screen build those pages were rendered from.
  const slug = (sym) => sym.replace(/&/g, '_');
  const urls = readdirSync('public/c').filter((f) => f.endsWith('.json')).map((f) => `<url><loc>https://alpha.askakshay.com/company/${slug(f.slice(0, -5))}/</loc><lastmod>${screen.built_on}</lastmod></url>`);
  writeFileSync('public/sitemap-companies.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
  console.log(`shard: sitemap-companies.xml with ${urls.length} pages`);
} catch (e) {
  console.warn(`shard: skipped (${e.message}). Company pages will use the full feeds.`);
  if (!existsSync('public/c')) mkdirSync('public/c', { recursive: true });
  // no shards means no company pages are built, so the company sitemap must list none
  if (!readdirSync('public/c').some((f) => f.endsWith('.json'))) writeFileSync('public/sitemap-companies.xml', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n');
}
