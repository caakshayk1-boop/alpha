// STALE since 22 Nov 2026 (a manual proof; no workflow runs it): it was written for the 19 Nov data and for the per-row "Delayed" stamp on the Calls page. That stamp is gone (the basis is stated once above the table), and a live quote now moves the book only while the session is open (lib/quotes.ts bookQuote). The behaviour is covered by tests/review22.test.ts and tools/check-routes.cjs.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:8816';
const browser = await chromium.launch();
const ledger = JSON.parse(readFileSync('ledger/ledger.json','utf8'));
const fixedTime = Date.parse('2026-11-19T10:00:00Z')/1000;
const errors=[];
const monthly=Array.from({length:372},(_,i)=>{const c=100+i;return {t:`${1996+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}-01`,o:c,h:c+1,l:c-1,c,v:10};});
async function mock(ctx){
  await ctx.route('**/api/quotes?*', async route=>{const syms=new URL(route.request().url()).searchParams.get('s').split(',');const quotes=Object.fromEntries(syms.map(s=>{const p=ledger.picks.find(p=>p.symbol===s);return [s,{px:p?p.fills[0].price+10:100,prev:95,t:fixedTime,hi:110,lo:90}]}));await route.fulfill({json:{ok:true,quotes}});});
  await ctx.route('**/api/chart?*',route=>route.fulfill({json:{ok:true,points:monthly}}));
}
try {
for(const width of [360,390,1280]){
 const ctx=await browser.newContext({viewport:{width,height:900}, reducedMotion:'reduce'});await mock(ctx);const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 for(const path of ['/','/terminal/','/calls/','/screener/','/gate/','/plan/','/about/','/method/','/privacy/','/terms/','/stock/INFY/']){
  await p.goto(base+path);await p.waitForLoadState('networkidle');
  const overflow=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(overflow<=1,`${width} ${path}: overflow ${overflow}`);
  assert.ok(await p.locator('nav[aria-label="Main"]').isVisible(),`${width} ${path}: navigation missing`);
 }
 console.log(`PASS ${width}px: 11 routes, navigation and no page overflow`);await ctx.close();
}
const ctx=await browser.newContext({viewport:{width:390,height:844}});await mock(ctx);const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
await p.goto(base+'/calls/'); await p.waitForFunction(()=>document.querySelector('[data-call="CHENNPETRO"] [data-q-time]')?.textContent.includes('Delayed'));
const values=await p.locator('[data-call="CHENNPETRO"]').evaluate(tr=>({px:tr.querySelector('[data-q-px]').textContent,gross:tr.querySelector('[data-pl="gross"]').dataset.v,target:tr.cells[12].textContent,time:tr.querySelector('[data-q-time]').textContent}));
assert.equal(values.px,'1,418.90');assert.equal(+values.gross,2340);assert.equal(values.target,'1,620.24');assert.match(values.time,/19 Nov 2026.*15:30/);
await p.getByRole('tab',{name:'The record',exact:true}).click();assert.ok(await p.locator('[data-equity] details').getAttribute('open')!==null);assert.match(await p.locator('[data-equity]').innerText(),/starting benchmark close is missing/);
await p.getByRole('tab',{name:'The four screens',exact:true}).focus(); await p.keyboard.press('Enter'); await p.keyboard.press('ArrowLeft');assert.equal(await p.getByRole('tab',{name:/Open calls/}).getAttribute('aria-selected'),'true');
console.log('PASS dated quote and P&L agree, target correct, sparse record table and keyboard tabs');
await p.goto(base+'/screener/?q=zzzz-no-such-stock&preset=quality');await p.getByRole('button',{name:'Clear search and filters'}).click();await p.waitForFunction(()=>document.querySelectorAll('[data-body] tr').length>1);assert.equal(new URL(p.url()).search,'');
await ctx.route('**/data/universe.json',route=>route.fulfill({status:503,body:'unavailable'}));await p.reload();assert.ok(await p.getByRole('button',{name:'Reload stocks'}).isVisible());await ctx.unroute('**/data/universe.json');
console.log('PASS screener empty result recovery and network error recovery');
await p.goto(base+'/stock/INFY/');await p.waitForSelector('[data-price-chart] svg');assert.match(await p.locator('[data-chart-note]').innerText(),/monthly observations/);assert.equal(await p.locator('[data-ivl="D"]').isDisabled(),true);assert.doesNotMatch(await p.locator('[data-trend]').innerText(),/50-day|200-day/);
console.log('PASS monthly history labels and no fictitious daily averages');
await p.goto(base+'/plan/');const next=p.getByRole('button',{name:'Next',exact:true});await p.getByRole('radio',{name:'Retirement',exact:true}).focus(); await p.keyboard.press('ArrowRight'); assert.equal(await p.getByRole('radio',{name: `Child's education`,exact:true}).getAttribute('aria-checked'),'true'); await p.getByRole('radio',{name:'Retirement',exact:true}).click();await next.click();await p.getByRole('radio',{name:'10 years',exact:true}).click();await next.click();await p.getByRole('radio',{name:'₹10,000',exact:true}).click();await next.click();await p.getByRole('radio',{name:'25%',exact:true}).click();await next.click();await p.getByRole('radio',{name:'The goal changes',exact:true}).click();await next.click();await p.getByRole('button',{name:'Finish',exact:true}).click();await p.getByRole('button',{name:'Download my plan'}).waitFor();assert.match(await p.locator('main').innerText(),/Kept in this browser only/);const saved=await p.evaluate(()=>localStorage.getItem('rulebook-plan/1'));await p.reload();await p.getByRole('button',{name:'Download my plan'}).waitFor();assert.equal(await p.evaluate(()=>localStorage.getItem('rulebook-plan/1')),saved);
console.log('PASS Plan six-step flow, persistence unchanged and backup warning');
await p.goto(base+'/scoreboard/');assert.ok(p.url().endsWith('/calls/#record'));assert.ok(await p.locator('#tab-record').isVisible());await p.goto(base+'/rulebook/');assert.equal(new URL(p.url()).pathname,'/');
const numbers=await p.locator('[data-count]').allTextContents();await p.waitForTimeout(400);assert.deepEqual(await p.locator('[data-count]').allTextContents(),numbers);assert.match(await p.locator('main').innerText(),/LockedFree/);
await p.screenshot({path:'/private/tmp/rulebook-review-mobile.png',fullPage:true});
assert.deepEqual(errors,[]);console.log('PASS aliases, stable first-paint figures and no uncaught page errors');await ctx.close();
} finally { await browser.close(); }
