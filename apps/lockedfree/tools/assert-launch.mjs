// Post-build launch gate (audit items 5, 6, 9): every page has a unique title, description, canonical, Open Graph and Twitter tags; icons and manifest exist;
// the disclaimer is on every decision page; no third-party links other than the owner's sites (askakshay.com and, since 28 Nov 2026, the family bar's alpha., tripwire. and apexpro. home pages); legal pages exist. Usage: node tools/assert-launch.mjs dist
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'; import { join } from 'node:path';
const root = process.argv[2] || 'dist'; const bad = []; const titles = new Map(); let pages = 0;
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f === 'index.html' || f === '404.html') check(p); } };
const must = (p, ok, what) => { if (!ok) bad.push(`${p}: ${what}`); };
function check(p) { pages++; const h = readFileSync(p, 'utf8'); const rel = p.slice(root.length);
  const title = (h.match(/<title>([^<]*)/) || [])[1]; must(rel, title, 'no title'); if (title) { if (titles.has(title)) bad.push(`${rel}: title duplicates ${titles.get(title)}`); titles.set(title, rel); }
  for (const t of ['name="description"', 'rel="canonical"', 'property="og:title"', 'property="og:image"', 'name="twitter:card"', 'name="twitter:image"', 'rel="manifest"', 'rel="apple-touch-icon"']) must(rel, h.includes(t), 'missing ' + t);
  must(rel, (h.match(/<h1/g) || []).length === 1, 'not exactly one h1');
  // 20 Nov 2026 (owner request): the notice is the last block of every page, inside the footer and after the main content, not a banner at the top
  must(rel, h.includes('class="notice') && h.lastIndexOf('class="notice') > h.lastIndexOf('</main>'), 'the notice is not after the main content'); must(rel, !h.includes('class="disc"'), 'a top disclaimer banner is still present');
  must(rel, /SEBI/.test(h), 'no SEBI wording in the page (footer)');
  for (const m of h.matchAll(/href="(https?:\/\/[^"]+)"/g)) if (!['https://www.nseindia.com/static/invest/first-time-investor-sebi-turnover-fees-stt-other-levies','https://nsearchives.nseindia.com/content/circulars/FA73061.pdf', 'https://www.sebi.gov.in/media-and-notifications/press-releases/sep-2024/updated-sebi-study-reveals-93-of-individual-traders-incurred-losses-in-equity-fando-between-fy22-and-fy24-aggregate-losses-exceed-1-8-lakh-crores-over-three-years_86906.html', 'https://github.com/caakshayk1-boop/alpha/tree/main/apps/lockedfree/src/lib'].includes(m[1]) && !/^https:\/\/((alpha|tripwire|apexpro)\.)?askakshay\.com\/?$/.test(m[1]) && !/canonical/.test(m[0]) && !m[1].startsWith('https://lockedfree.askakshay.com')) bad.push(`${rel}: external link ${m[1]}`);
}
walk(root);
for (const f of ['favicon.ico', 'icon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml', 'privacy/index.html', 'terms/index.html', '404.html']) must(f, existsSync(join(root, f)), 'file missing');
const sm = readFileSync(join(root, 'sitemap.xml'), 'utf8'); for (const u of ['/privacy/', '/terms/']) must('sitemap.xml', sm.includes(u), 'does not list ' + u);
const mail = readFileSync(join(root, 'privacy/index.html'), 'utf8'); must('privacy', mail.includes('mailto:ca.akkothari@askakshay.com'), 'contact email missing');
if (bad.length) { console.error(bad.slice(0, 40).join('\n') + `\n${bad.length} launch-gate failures in ${pages} pages`); process.exit(1); } console.log(`launch gate: ${pages} pages, unique titles, tags, icons, disclaimers, legal pages: all present`);
