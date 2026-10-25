/** Check the packed app edition (out-app/) the way a visitor meets it: static facts first, then the app served by its own Worker config
 *  (wrangler.app.jsonc) and visited on a phone. Fails on: a removed page still shipped, a redirect missing for a page the full site has,
 *  a page that does not load or throws, a primary navigation link that leaves the app, or a hand-off that does not reach the full site.
 *  Links inside pages that point to a full-site page are not failures: they are counted, because the host hands them off.
 *    node --experimental-strip-types scripts/app-check.mjs */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { FULL_SITE, inApp } from '../src/lib/edition.ts';

const fail = []; const note = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fail.push(msg); };
const D = 'out-app';
if (!existsSync(`${D}/app-report.json`)) { console.error('out-app/ is missing: run `npm run build:app`.'); process.exit(1); }
const report = JSON.parse(readFileSync(`${D}/app-report.json`, 'utf8'));
const redirects = readFileSync(`${D}/_redirects`, 'utf8');

// 1. static facts
note(report.removedPages.every((p) => !existsSync(`${D}${p}index.html`)), `no removed page is shipped (${report.removedPages.length} removed)`);
note(report.redirectedToFullSite.every((p) => redirects.includes(`${p.replace(/\/$/, '')} ${FULL_SITE}${p} 302`)), `every full-site page outside the app has a redirect (${report.redirectedToFullSite.length})`);
note(report.pages.every((p) => p === '/' || inApp(p)), 'every shipped page is an app page');
const man = JSON.parse(readFileSync(`${D}/manifest.webmanifest`, 'utf8'));
note(man.start_url === '/?source=app' && man.theme_color === '#f6f5f1' && man.icons.every((i) => i.src.includes('?v=2')), 'manifest: app start URL, paper colours, versioned icons');
const robots = readFileSync(`${D}/robots.txt`, 'utf8');
note(report.indexable ? robots.includes('Allow: /') && existsSync(`${D}/sitemap.xml`) : robots.includes('Disallow: /') && !existsSync(`${D}/sitemap.xml`), report.indexable ? 'robots and sitemap name the app address' : 'no app address set: robots disallow everything');
note(!existsSync(`${D}/sitemap-companies.xml`), 'sitemaps only the full site uses are not shipped');

// 2. served by its own Worker config
const port = 8798;
const srv = spawn('npx', ['wrangler', 'dev', '--config', 'wrangler.app.jsonc', '--local', '--port', String(port)], { stdio: 'ignore', detached: true });
const base = `http://localhost:${port}`;
let up = false;
for (let i = 0; i < 90 && !up; i++) { try { up = (await fetch(`${base}/`)).ok; } catch { /* starting */ } if (!up) await new Promise((r) => setTimeout(r, 1000)); }
note(up, 'the app Worker starts on its own config');
const b = await chromium.launch();
try {
  if (up) {
    // 2a. a hand-off reaches the full site
    for (const p of ['/rotation/', '/news/', '/reads/?x=1', '/ipo']) {
      const r = await fetch(base + p, { redirect: 'manual' });
      const loc = r.headers.get('location') || '';
      note([301, 302, 307, 308].includes(r.status) && loc.startsWith(FULL_SITE), `${p} hands off to the full site (${r.status} ${loc})`);
    }
    // 2b. every app page loads on a phone without errors, with the app's own tabs
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const pages = report.pages.map((p) => (p === '/company/' ? '/company/TCS/' : p));
    let handoffTotal = 0;
    for (const p of pages) {
      const pg = await ctx.newPage();
      const errs = []; pg.on('pageerror', (e) => errs.push(String(e).slice(0, 140)));
      const res = await pg.goto(base + p, { waitUntil: 'load', timeout: 60000 }).catch(() => null);
      await pg.waitForTimeout(2500);
      const info = await pg.evaluate(() => ({
        title: document.title,
        tabs: [...document.querySelectorAll('nav.tabbar a')].map((a) => a.textContent.trim()),
        navLinks: [...document.querySelectorAll('nav.nav a, nav.tabbar a')].map((a) => a.getAttribute('href')),
        links: [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')),
        h1: document.querySelectorAll('h1').length,
      }));
      const out = info.links.filter((h) => !inApp(h));
      const navOut = info.navLinks.filter((h) => h && !inApp(h));
      handoffTotal += out.length;
      note(!!res && res.ok() && errs.length === 0, `${p} loads, no script errors${errs.length ? ': ' + errs[0] : ''}`);
      note(navOut.length === 0, `${p} navigation stays inside the app${navOut.length ? ': ' + navOut.join(', ') : ''}`);
      if (p === '/') {
        note(info.tabs.join('|').replace(/\s+/g, ' ').match(/Today.*Signals.*Find.*(My )?Desk/i) !== null, `the four tabs are Today, Signals, Find, Desk (${info.tabs.join(' | ')})`);
        note(/signals by rule/i.test(info.title) && !/research desk/i.test(info.title), `the app has its own title (${info.title})`);
      }
      console.log(`      ${p}: ${info.links.length} links, ${out.length} go to the full site${out.length ? ` (${[...new Set(out)].slice(0, 5).join(', ')})` : ''}`);
      await pg.close();
    }
    console.log(`      ${handoffTotal} links across ${pages.length} pages are handed to the full site by the host`);
  }
} finally { await b.close(); try { process.kill(-srv.pid); } catch { /* gone */ } }
console.log(fail.length ? `\napp-check: ${fail.length} failed` : '\napp-check: all passed');
process.exit(fail.length ? 1 : 0);
