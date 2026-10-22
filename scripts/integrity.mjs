// integrity.mjs — the behavioural gates of Pro §32.1 and the walkthroughs of §22.1 and §17, on the frozen snapshot:
//   numeric   every change figure says the same number it shows (DOM text = spoken label); breadth adds up and equals the data
//   motion    reduced motion leaves nothing hidden; a hidden tab renders everything once shown; navigating mid-animation
//             throws nothing and leaves the page visible
//   ladder    Today, Company, Screen and Compare each serve Glance, Understand, Verify and Record, by keyboard, with no hover
//   back      a company opened from a filtered Screen returns to that same filtered Screen
// Usage: npm run build && node scripts/integrity.mjs   (CHROMIUM_PATH to use a preinstalled browser)
import { frozenContext, launch, loadFixtures, newFrozenPage, settle, startWorker } from './visual-lib.mjs';

const fails = [], passes = [];
const ok = (name, cond, detail = '') => (cond ? passes : fails).push(`${name}${detail ? ` (${detail})` : ''}`);
const w = await startWorker(8802);
const browser = await launch();
const fx = loadFixtures();
const open = async (path, opt = {}) => {
  const ctx = await frozenContext(browser, fx, { width: 1366, height: 900, ...opt });
  if (opt.hidden) await ctx.addInitScript(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis ?? 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => (window.__vis ?? 'hidden') === 'hidden' }); });
  const p = await newFrozenPage(ctx, fx);
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  await p.goto(w.base + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(p);
  return { ctx, p, errors };
};
// a revealed element still hidden INSIDE the viewport is a stuck state; below the fold it is simply waiting for its scroll
const hiddenInView = (p) => p.evaluate(() => [...document.querySelectorAll('[data-rv]')].filter((el) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.height > 0 && (s.opacity === '0' || s.visibility === 'hidden'); }).length);
/** Hidden elements found anywhere on the page, scrolling through it a screen at a time (each gets its chance to reveal). */
async function hiddenReveals(p) {
  let n = 0;
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 700) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(120); await p.clock.runFor(600).catch(() => undefined); n += await hiddenInView(p); }
  await p.evaluate(() => window.scrollTo(0, 0));
  return n;
}

try {
  // ── numeric integrity ───────────────────────────────────────────────────────────────────────────────────────────
  for (const path of ['/', '/screen/', '/company/TCS/', '/compare/?s=TCS,INFY,HDFCBANK', '/desk/']) {
    const { ctx, p, errors } = await open(path);
    const bad = await p.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('span.num.up, span.num.down, span.num.flat')) {
        const shown = el.querySelector('[aria-hidden]')?.textContent ?? '', said = el.querySelector('.sr')?.textContent ?? '';
        if (!said) continue;
        const n = (s) => (s.match(/\d+(?:[.,]\d+)*/) ?? [''])[0].replace(/,/g, '');
        if (n(shown) !== n(said)) out.push(`"${shown}" is spoken as "${said}"`);
        const dir = el.classList.contains('up') ? 'up' : el.classList.contains('down') ? 'down' : 'flat';
        if (dir === 'up' && !/^up /.test(said)) out.push(`"${shown}" is coloured up but spoken "${said}"`);
        if (dir === 'down' && !/^down /.test(said)) out.push(`"${shown}" is coloured down but spoken "${said}"`);
      }
      return out;
    });
    ok(`numeric ${path}: change figures say what they show`, bad.length === 0, bad.slice(0, 3).join('; '));
    ok(`numeric ${path}: no page error`, errors.length === 0, errors.join('; '));
    if (path === '/') {
      const b = await p.evaluate(() => {
        const s = document.querySelector('.breadth2');
        if (!s) return null;
        const int = (t) => Number((t ?? '').replace(/[^\d]/g, ''));
        return { counted: int(/([\d,]+) stocks/.exec(s.querySelector('.eyebrow')?.textContent ?? '')?.[1]), up: int(s.querySelector('.n.up')?.firstChild?.textContent), down: int(s.querySelector('.n.down')?.firstChild?.textContent), flat: int(/([\d,]+) unchanged/.exec(s.textContent ?? '')?.[1]), pctUp: int(/(\d+)% rose/.exec(s.textContent ?? '')?.[1]) };
      });
      if (!b || !b.counted) ok('numeric /: breadth rendered', false, 'no breadth block with a count');
      else {
        ok('numeric /: rose + fell + unchanged = counted (A01)', b.up + b.down + b.flat === b.counted, JSON.stringify(b));
        ok('numeric /: "% rose" is rose ÷ counted', b.pctUp === Math.round((b.up / b.counted) * 100), JSON.stringify(b));
        const sum = JSON.parse(fx.responses['/api/summary']?.body ?? 'null');
        const live = ['/api/live?part=0', '/api/live?part=1'].some((k) => fx.responses[k]);
        if (sum?.day && !live) ok('numeric /: breadth equals the data it came from', sum.day.up === b.up && sum.day.down === b.down, `page ${b.up}/${b.down}, data ${sum.day.up}/${sum.day.down}`);
      }
    }
    await ctx.close();
  }

  // ── motion ──────────────────────────────────────────────────────────────────────────────────────────────────────
  for (const path of ['/', '/company/TCS/', '/reads/']) {
    const r = await open(path, { reduced: true });
    await r.p.mouse.wheel(0, 3000); await r.p.waitForTimeout(800);
    ok(`motion ${path}: reduced motion leaves nothing hidden`, (await hiddenReveals(r.p)) === 0);
    await r.ctx.close();
    const h = await open(path, { reduced: false, hidden: true });
    await h.p.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
    await h.p.clock.runFor(3000); await h.p.waitForTimeout(600);
    ok(`motion ${path}: a tab opened hidden shows everything once visible`, (await hiddenReveals(h.p)) === 0);
    ok(`motion ${path}: hidden-tab run has no page error`, h.errors.length === 0, h.errors.join('; '));
    await h.ctx.close();
  }
  {
    const m = await open('/', { reduced: false });
    for (const href of ['/screen/', '/markets/', '/company/TCS/', '/research/', '/desk/', '/reads/', '/']) {
      await m.p.evaluate((h) => { const a = [...document.querySelectorAll('a')].find((x) => x.getAttribute('href') === h); if (a) a.click(); else location.assign(h); }, href);
      await m.p.clock.runFor(150); await m.p.waitForTimeout(150);      // leave mid-animation
    }
    await m.p.waitForTimeout(1500); await m.p.clock.runFor(2000);
    ok('motion: navigating mid-animation throws nothing', m.errors.length === 0, m.errors.join('; '));
    ok('motion: the page after rapid navigation is visible', (await hiddenReveals(m.p)) === 0 && (await m.p.evaluate(() => !!document.querySelector('h1'))));
    await m.ctx.close();
  }

  // ── decision ladder (§22.1), keyboard only ──────────────────────────────────────────────────────────────────────
  {
    const { ctx, p } = await open('/company/TCS/');
    ok('ladder company · glance: name, price and as-of above the fold', await p.evaluate(() => { const v = (s) => { const el = document.querySelector(s); const r = el?.getBoundingClientRect(); return !!r && r.top < innerHeight && r.height > 0; }; return v('h1') && v('.co-price .px') && v('.stamp-item, [class*="stamp"]'); }));
    ok('ladder company · understand: case and countercase side by side, countercase not collapsed', await p.evaluate(() => { const g = document.querySelector('.case-grid'); return !!g && g.querySelectorAll('.case-col').length === 2 && [...g.querySelectorAll('.case-col')].every((c) => c.getBoundingClientRect().height > 40); }));
    const sBtn = p.locator('.case-grid button', { hasText: /^S$/ }).first();
    if (await sBtn.count()) { await sBtn.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(300); }
    ok('ladder company · verify: a source opens from the keyboard', await p.evaluate(() => /source|filing|screen close|Yahoo|NSE/i.test(document.querySelector('.case-grid')?.textContent ?? '')));
    const save = p.getByRole('button', { name: /Save research card/i }).first();
    const before = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('alpha-cards-v1') ?? '[]').length; } catch { return -1; } });
    if (await save.count()) { await save.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(500); }
    const after = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('alpha-cards-v1') ?? '[]').length; } catch { return -1; } });
    ok('ladder company · record: a research card saves from the keyboard', after === before + 1, `${before} → ${after}`);
    await ctx.close();
  }
  {
    const { ctx, p } = await open('/');
    ok('ladder today · glance: one-line takeaway with as-of', await p.evaluate(() => !!document.querySelector('h1') && /\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(document.body.innerText.slice(0, 1500))));
    ok('ladder today · understand: breadth and the barometer reading are shown', await p.evaluate(() => !!document.querySelector('.breadth2') && /Barometer/i.test(document.body.innerText)));
    ok('ladder today · verify: data dates are one link away', await p.evaluate(() => [...document.querySelectorAll('a')].some((a) => /data-dates|about/.test(a.getAttribute('href') ?? ''))));
    ok('ladder today · record: the journal or My Desk is one link away', await p.evaluate(() => [...document.querySelectorAll('a')].some((a) => /\/(journal|desk)\//.test(a.getAttribute('href') ?? ''))));
    await ctx.close();
  }
  {
    const { ctx, p } = await open('/screen/');
    await p.locator('#nlq').fill('roe > 14 and debt_to_equity < 0.5'); await p.waitForTimeout(500);
    ok('ladder screen · glance: a count of matches against the universe', await p.evaluate(() => /\bmatch(es)? of [\d,]+/.test(document.body.innerText)));
    ok('ladder screen · understand: each clause shown as words', (await p.locator('button.tag.acc').count()) >= 2);
    const which = p.locator('summary', { hasText: 'Which companies?' }).first();
    if (await which.count()) { await which.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(200); }
    ok('ladder screen · verify: the universe and its exclusions open from the keyboard', await p.evaluate(() => /delisted, merged or suspended/.test(document.body.innerText)));
    ok('ladder screen · record: a saved card or saved screen is offered', await p.evaluate(() => [...document.querySelectorAll('button')].some((b) => /Save (this screen|as research card)/i.test(b.textContent ?? ''))));
    await ctx.close();
  }
  {
    const { ctx, p } = await open('/compare/?s=TCS,INFY,HDFCBANK');
    ok('ladder compare · glance: the companies side by side with as-of', await p.evaluate(() => document.querySelectorAll('.cmp-linked thead th').length >= 4 && /\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(document.body.innerText)));
    ok('ladder compare · understand: a lender is marked not comparable, not ranked', await p.evaluate(() => /not compara/i.test(document.body.innerText)));
    ok('ladder compare · verify: every company links to its own page', await p.evaluate(() => ['TCS', 'INFY', 'HDFCBANK'].every((s) => !!document.querySelector(`.cmp-linked thead a[href*="/company/${s}/"]`))));
    ok('ladder compare · record: each company page is one link away to save its card', await p.evaluate(() => document.querySelectorAll('.cmp-linked thead a').length >= 3));
    await ctx.close();
  }

  // ── back keeps context (§17) ────────────────────────────────────────────────────────────────────────────────────
  {
    const { ctx, p } = await open('/screen/?size=large');
    const from = new URL(p.url());
    const first = p.locator('table a[href*="/company/"]').first();
    if (await first.count()) {
      await first.focus(); await p.keyboard.press('Enter'); await p.waitForURL(/\/company\//, { timeout: 15000 }).catch(() => undefined); await settle(p, 600);
      const back = p.locator('a', { hasText: /^←\s*(Back to )?Screen$/ }).first();
      const href = (await back.count()) ? await back.getAttribute('href') : null;
      ok('back: the company page links back to the screen it came from', !!href && href.includes(from.search || '?'), `came from ${from.search}, back link ${href}`);
    } else ok('back: a company link on the screen', false, 'no company link found in the table');
    await ctx.close();
  }
} finally {
  await browser.close();
  w.stop();
}
for (const x of passes) console.log(`PASS  ${x}`);
for (const x of fails) console.error(`FAIL  ${x}`);
console.log(`integrity: ${passes.length} of ${passes.length + fails.length} checks passed`);
process.exitCode = fails.length ? 1 : 0;
