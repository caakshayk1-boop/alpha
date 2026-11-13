// Settings: "Up and down colours" (13 Nov 2026, v5). The opt-in colour-blind-safe pair flips html[data-updown], the up/down tokens and the colours the page really paints follow with no component edit,
// the default is unchanged for an existing user, the choice persists, and the paper (print) palette has its own pair. AUTOMATED checks in a desktop Chromium; they do not replace looking at it with a colour-vision filter.
// Usage: node apps/tripwire/tests/updown.mjs [baseUrl]
import { chromium, newCtx } from './uimock.mjs';
const base = process.argv[2] ?? 'http://localhost:8801';
let fails = 0; const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fails++; };
const b = await chromium.launch();
const wait = (pg) => pg.waitForFunction(() => !document.querySelector('.routewait'), null, { timeout: 15000 }).catch(() => {});
const open = async (pg, route, sel) => { await pg.goto(base + '/'); await pg.goto(base + route); await pg.reload(); await wait(pg); if (sel) await pg.waitForSelector(sel, { timeout: 20000 }); await pg.waitForTimeout(300); };
const attr = (pg) => pg.evaluate(() => document.documentElement.dataset.updown ?? null);
/** the colours the page really paints: probes carrying the product's own classes, so a rule that stopped reading the token would not follow */
const paint = (pg) => pg.evaluate(() => {
  const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-9999px'; host.innerHTML = '<span class="up">u</span><span class="down">d</span><span class="tag peach">t</span><div class="ladder"><div class="rail" style="width:100px"></div></div>'; document.body.appendChild(host);
  const cs = (s, p) => getComputedStyle(host.querySelector(s))[p]; const out = { up: cs('.up', 'color'), down: cs('.down', 'color'), tag: cs('.tag.peach', 'backgroundColor'), tagText: cs('.tag.peach', 'color'), rail: cs('.rail', 'backgroundImage'),
    haloUp: getComputedStyle(document.documentElement).getPropertyValue('--halo-up').trim(), tintDown: getComputedStyle(document.documentElement).getPropertyValue('--down-tint').trim() };
  host.remove(); return out; });
const radio = (pg, name) => pg.locator('[role=radiogroup][aria-label="Up and down colours"]').getByRole('radio', { name, exact: true });
const GREEN = 'rgb(61, 220, 151)', RED = 'rgb(255, 122, 122)', BLUE = 'rgb(90, 174, 255)', ORANGE = 'rgb(255, 160, 64)';

{ // an existing user (no updown in the saved prefs): nothing changes
  const ctx = await newCtx(b, 390); const pg = await ctx.newPage(); await open(pg, '/#/settings', '[data-updown-group]');
  ok((await attr(pg)) === 'default', 'a saved state from before the setting reads as the default (html[data-updown=default])');
  const p0 = await paint(pg); ok(p0.up === GREEN && p0.down === RED, `default: the approved green and red are what is painted (${p0.up}, ${p0.down})`);
  ok(/rgba\(61, 220, 151, 0\.26\)/.test(p0.haloUp.replace(/\s+/g, ' ')) || /rgba\(61,220,151,\.26\)/.test(p0.haloUp), `default: the price halo is the green tint (${p0.haloUp})`);
  ok(p0.rail.includes('rgb(255, 107, 94)') && p0.rail.includes('rgb(61, 220, 151)'), 'default: the target ladder rail keeps its own red and green');
  const grp = pg.locator('[role=radiogroup][aria-label="Up and down colours"]'); ok(await grp.count() === 1 && await grp.getByRole('radio').count() === 2, 'Settings has one radiogroup "Up and down colours" with two choices');
  ok((await radio(pg, 'Green and red (default)').getAttribute('aria-checked')) === 'true' && (await radio(pg, 'Blue and orange (colour-blind safe)').getAttribute('aria-checked')) === 'false', 'the default is the checked one');
  for (const n of ['Green and red (default)', 'Blue and orange (colour-blind safe)']) ok((await radio(pg, n).boundingBox()).height >= 43.5, `"${n}" is a 44px target`);

  await radio(pg, 'Blue and orange (colour-blind safe)').click(); await pg.waitForTimeout(250);
  ok((await attr(pg)) === 'cb', 'choosing Blue and orange sets html[data-updown=cb]');
  const p1 = await paint(pg); ok(p1.up === BLUE && p1.down === ORANGE && p1.up !== p0.up && p1.down !== p0.down, `a computed colour changes: up ${p0.up} to ${p1.up}, down ${p0.down} to ${p1.down}`);
  ok(p1.tagText === ORANGE && p1.tag !== p0.tag, `the red tag follows (text ${p1.tagText}, wash ${p0.tag} to ${p1.tag})`); ok(p1.rail !== p0.rail && p1.rail.includes('rgb(255, 160, 64)') && p1.rail.includes('rgb(90, 174, 255)'), 'the ladder rail follows');
  ok(p1.haloUp !== p0.haloUp && p1.tintDown !== p0.tintDown, 'the halo and the tints follow');
  ok((await radio(pg, 'Blue and orange (colour-blind safe)').getAttribute('aria-checked')) === 'true' && /Rises are blue and falls are orange/.test(await pg.locator('[data-updown-note]').innerText()) && /signs, arrows and words stay/.test(await pg.locator('[data-updown-note]').innerText()), 'the radio and the note say what is chosen, and that signs, arrows and words stay');

  // a real screen, not only probes: the company page's change figure and its sign and arrow words
  await pg.waitForTimeout(400); ok(await pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('tripwire:v1')).prefs.updown === 'cb'; } catch { return false; } }), 'the choice is saved with the other preferences (prefs.updown)');   // a reload would re-seed the fixture state; the fresh-load case is the second block below
  await pg.evaluate(() => { location.hash = '#/c/TCS'; }); await pg.waitForSelector('.co-ch', { timeout: 20000 }); await pg.waitForTimeout(300);
  const ch = await pg.locator('.co-ch').evaluate((e) => ({ color: getComputedStyle(e).color, text: (e.textContent ?? '').trim() })); ok(/^[+−-]?\d/.test(ch.text), `the company page's change is a signed figure (${ch.text.slice(0, 24)}), so the sign stays beside the colour`);
  ok(![GREEN, RED].includes(ch.color), `and it is never painted the default green or red (${ch.color})`);

  // the paper palette: print is the light surface, with its own measured pair
  await pg.emulateMedia({ media: 'print' }); await pg.waitForTimeout(150);
  const pr = await pg.evaluate(() => { const r = getComputedStyle(document.documentElement); return { up: r.getPropertyValue('--up').trim(), down: r.getPropertyValue('--down').trim() }; });
  ok(pr.up.toLowerCase() === '#0b5cad' && pr.down.toLowerCase() === '#b34700', `print uses the paper pair (${pr.up}, ${pr.down})`); await pg.emulateMedia({ media: 'screen' });

  // and back: exactly the default again
  await pg.evaluate(() => { location.hash = '#/settings'; }); await pg.waitForSelector('[data-updown-group]'); await radio(pg, 'Green and red (default)').click(); await pg.waitForTimeout(250);
  const p2 = await paint(pg); ok((await attr(pg)) === 'default' && p2.up === GREEN && p2.down === RED && p2.tag === p0.tag && p2.rail === p0.rail, 'choosing Green and red again restores the default pixels exactly');
  await ctx.close();
}
{ // a saved cb choice is applied before the first paint of a fresh load (no flash of green and red for the person who chose otherwise)
  const ctx = await newCtx(b, 390, null, { state: undefined }); await ctx.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('tripwire:v1') ?? '{}'); s.prefs = { ...(s.prefs ?? {}), updown: 'cb' }; localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} });
  const pg = await ctx.newPage(); await open(pg, '/#/today', '[data-sec="brief"], .dsk'); ok((await attr(pg)) === 'cb', 'a saved choice of cb is in force on a fresh load');
  const p = await paint(pg); ok(p.up === BLUE && p.down === ORANGE, 'and what is painted is blue and orange'); await ctx.close();
}
{ // a bad saved value falls back to the default instead of breaking the page
  const ctx = await newCtx(b, 390); await ctx.addInitScript(() => { try { const s = JSON.parse(localStorage.getItem('tripwire:v1') ?? '{}'); s.prefs = { ...(s.prefs ?? {}), updown: 'neon' }; localStorage.setItem('tripwire:v1', JSON.stringify(s)); } catch {} });
  const pg = await ctx.newPage(); await open(pg, '/#/settings', '[data-updown-group]'); ok((await attr(pg)) === 'default' && (await paint(pg)).up === GREEN, 'an unknown saved value reads as the default'); await ctx.close();
}
await b.close(); console.log(fails ? `updown: ${fails} failed` : 'updown: all passed'); process.exit(fails ? 1 : 0);
