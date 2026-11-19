// The live view of the sector map in a real browser (18 Nov 2026), on synthetic data: while the session is on, the 1D column is the median of live changes of the most traded names per sector,
// it says so, and "Show the close" returns the published close; when the market is shut nothing live is offered. Expected values are computed here independently.
// Usage: APEX_BASE=http://localhost:8810 node apps/apexpro/tests/heat-live.mjs
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {pulse} from './fixtures.mjs';
const base=process.env.APEX_BASE||'http://localhost:8810';
const OPEN=new Date('2026-11-16T05:30:00Z'),SHUT=new Date('2026-11-16T17:30:00Z');   // Monday 11:00 IST and 23:00 IST
const chg=sym=>(([...sym].reduce((a,c)=>a+c.charCodeAt(0),0)%9)-4)/2;               // -2.0 to +2.0, a pure function of the symbol
const sectors=['Technology','Energy','Utilities'];
const rows=sectors.flatMap((sec,si)=>Array.from({length:10},(_,i)=>({sym:`${sec.slice(0,3).toUpperCase()}${i}`,name:`${sec} ${i} Ltd.`,sector:sec,liquid:true,turnover_cr:1000-i*50-si,price:100,last_date:'2026-11-13',r1d:1,r1m:2,r3m:3,r1y:4,comp:60+i,q:70,g:70,roce:25,cfo_pat:1.1,high52:130,low52:80,fy:'FY26',sma20:99,sma50:98,sma200:97,rsi:50,pe:15,de:.2,rev_cagr:9})));
const SAMPLE=sectors.flatMap(sec=>rows.filter(r=>r.sector===sec).slice(0,6).map(r=>r.sym));
const median=v=>{const a=[...v].sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
const expectLive=Object.fromEntries(sectors.map(sec=>[sec,median(rows.filter(r=>r.sector===sec&&SAMPLE.includes(r.sym)).map(r=>chg(r.sym)))]));
const b=await chromium.launch();
async function open(at,age=20){
  const ctx=await b.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});
  await ctx.clock.install({time:at});const nowS=Math.floor(at.getTime()/1000);
  await ctx.route('**/api/screen',r=>r.fulfill({json:{ok:true,as_of:'2026-11-13',built_on:'2026-11-14',price_date:'2026-11-13',rows}}));
  await ctx.route('**/api/market',r=>r.fulfill({json:{ok:true,quotes:Object.fromEntries(Object.entries(pulse.quotes).map(([k,q])=>[k,{...q,pt:nowS-20,live:true}]))}}));
  await ctx.route('**/api/macro',r=>r.fulfill({json:{ok:true,quotes:{}}}));
  const asked=[];await ctx.route('**/api/quotes*',r=>{const u=new URL(r.request().url());const list=(u.searchParams.get('s')||'').split(',').filter(Boolean);asked.push(list);
    r.fulfill({json:{ok:true,quotes:Object.fromEntries(list.map(s=>[s,{px:100*(1+chg(s)/100),prev:100,pt:nowS-age,live:true,t:[],c:[]}])),missing:[]}});});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto(base+'/');await p.waitForSelector('.sector-matrix');await p.clock.runFor(5000);await p.waitForTimeout(400);return {ctx,p,errs,asked};
}
{
  const {ctx,p,errs,asked}=await open(OPEN);
  assert.equal(await p.locator('[data-heat-live-note]').count(),1,'session on: the live note is present');
  assert.match(await p.locator('[data-heat-live-note]').innerText(),/1D is live · 11:00 IST|1D is live · 10:59 IST/);assert.match(await p.locator('[data-action="canvas-sort"][data-key="r1d"]').innerText(),/1D live/);
  {const got=new Set(asked.flat());assert.deepEqual([...SAMPLE].filter(x=>!got.has(x)),[],'it asked for the top 6 names of each sector');}   /* 19 Nov 2026: names shown on the page (live prices) may be asked for too, so the sample must be included, not equal */assert.ok(asked.every(l=>l.length<=30),'never more than 30 names a call');
  const cells=await p.locator('.matrix-row').evaluateAll(r=>r.map(x=>[x.querySelector('.matrix-name').childNodes[0].textContent,x.querySelectorAll('.matrix-value')[0].textContent,x.querySelectorAll('.matrix-value')[0].querySelector('small').textContent]));
  assert.equal(cells.length,3);for(const [name,txt,cov] of cells){const v=parseFloat(txt.replace('−','-').replace('+',''));assert.ok(Math.abs(v-expectLive[name])<.06,`${name}: ${v} vs ${expectLive[name]}`);assert.equal(cov,'6/10',`${name} coverage reads measured/total`);}
  await p.locator('[data-action="canvas-live"]').click();assert.equal(await p.locator('[data-heat-live-note]').innerText().then(t=>/published close/.test(t)),true);assert.doesNotMatch(await p.locator('[data-action="canvas-sort"][data-key="r1d"]').innerText(),/live/);
  const closeCells=await p.locator('.matrix-row').first().locator('.matrix-value').first().innerText();assert.match(closeCells,/\+?1(\.0)?%|1%/);
  await p.locator('[data-action="canvas-live"]').click();assert.match(await p.locator('[data-action="canvas-sort"][data-key="r1d"]').innerText(),/1D live/);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll');assert.deepEqual(errs,[]);await ctx.close();
  console.log('PASS  live view: sample, medians, coverage, switch to the close and back, no overflow');
}
{
  // after the close (23:00 IST, prints dated today): today's last prints, labelled as such, not "live"
  const {ctx,p,asked}=await open(SHUT);
  assert.equal(await p.locator('[data-heat-live-note]').count(),1);assert.match(await p.locator('[data-heat-live-note]').innerText(),/1D is today's session, market closed · last prints \d\d:\d\d IST/);
  assert.match(await p.locator('[data-action="canvas-sort"][data-key="r1d"]').innerText(),/1D today/);assert.doesNotMatch(await p.locator('[data-heat-live-note]').innerText(),/is live/);
  assert.deepEqual([...new Set(asked.flat())].sort(),[...SAMPLE].sort());
  const cells=await p.locator('.matrix-row').evaluateAll(r=>r.map(x=>[x.querySelector('.matrix-name').childNodes[0].textContent,x.querySelectorAll('.matrix-value')[0].textContent]));
  for(const [name,txt] of cells){const v=parseFloat(txt.replace('−','-').replace('+',''));assert.ok(Math.abs(v-expectLive[name])<.06,`${name}: ${v} vs ${expectLive[name]}`);}
  await p.locator('[data-action="canvas-live"]').click();assert.match(await p.locator('[data-heat-live-note]').innerText(),/published close/);assert.doesNotMatch(await p.locator('[data-action="canvas-sort"][data-key="r1d"]').innerText(),/today|live/);await ctx.close();
  console.log('PASS  after the close: today\'s last prints, labelled, switchable');
}
{
  // a Saturday: prints are from Friday, so nothing is measured, nothing is requested, the published close stays
  const {ctx,p,asked}=await open(new Date('2026-11-14T05:30:00Z'),86400);
  assert.equal(await p.locator('[data-heat-live-note]').count(),0);assert.equal(asked.length,0,'no quotes requested on a weekend');assert.doesNotMatch(await p.locator('[data-action="canvas-sort"][data-key="r1d"]').innerText(),/live|today/);await ctx.close();
  console.log('PASS  weekend: no live or today view');
}
{
  // rows per page (18 Nov 2026): 25 by default, 50 and 100 on request, back to page 1 when it changes (30 synthetic companies)
  const {ctx,p}=await open(SHUT);
  assert.equal(await p.locator('.candidate-row').count(),25);assert.match(await p.locator('.canvas-pagination').innerText(),/30 matches · 1 \/ 2/);
  await p.locator('[data-action="canvas-page"][aria-label="Next candidates"]').click();assert.equal(await p.locator('.candidate-row').count(),5);
  await p.locator('[data-action="canvas-size"][data-value="50"]').click();assert.equal(await p.locator('.candidate-row').count(),30);assert.match(await p.locator('.canvas-pagination').innerText(),/30 matches · 1 \/ 1/);
  assert.equal(await p.locator('[data-action="canvas-size"][data-value="50"]').getAttribute('aria-pressed'),'true');assert.ok(await p.evaluate(()=>document.activeElement?.dataset.value==='50'),'focus stays on the control that was pressed');await ctx.close();
  console.log('PASS  rows per page: 25 default, 50 and 100 on request, page resets, focus kept');
}
await b.close();
