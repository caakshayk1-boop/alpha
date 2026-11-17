import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {homeSettings,peersFor,sectorData,captureVisit,visitChanges} from '../src/cockpit.js';
import {screen,chart,company,pulse} from './fixtures.mjs';
assert.deepEqual(homeSettings({profile:'__proto__',layouts:{research:{order:['brief','brief','evil'],sizes:{brief:'invalid'}}}}),homeSettings({layouts:{research:{order:['brief']}}}));
const rows=[{sym:'A',sector:'Tech',ind:'Software',tier:'large',mcap_cr:100},{sym:'B',sector:'Tech',ind:'Software',tier:'large',mcap_cr:130},{sym:'C',sector:'Tech',ind:'Hardware',tier:'large',mcap_cr:100},{sym:'D',sector:'Tech',ind:'Software',tier:'large',mcap_cr:105},{sym:'E',sector:'Energy'}];
assert.deepEqual(peersFor(rows[0],rows).map(r=>r.sym),['D','B']);assert.deepEqual(peersFor({sym:'Z'},rows),[]);
const groups=sectorData([{sector:'Tech',r1d:2},{sector:'Tech',r1d:null},{sector:'Tech',r1d:-1},{sector:'Energy'}]);assert.equal(groups[0].change,.5);assert.equal(groups[0].measured,2);assert.equal(groups[1].change,null);
const prior=captureVisit(screen.rows,['TCS'],screen.as_of);assert.equal(visitChanges(screen.rows,['TCS'],prior)[0].price,0);
const changed=[{...screen.rows[0],price:2640,risk:{flags:[{t:'New risk'}]}}];assert.ok(Math.abs(visitChanges(changed,['TCS'],prior)[0].price-10)<.00001);assert.deepEqual(visitChanges(changed,['TCS'],prior)[0].flags,['New risk']);assert.ok(visitChanges([{...changed[0],last_date:'2020-01-01'}],['TCS'],prior)[0].newFollow);
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch();try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({'/api/screen':screen,'/api/market':pulse,'/api/chart':chart,'/api/company':company,'/api/spark':chart}[new URL(r.request().url()).pathname]||{})}));
 await page.goto('http://localhost:8810');await page.getByRole('heading',{name:'Since your last visit'}).waitFor();
 await page.locator('.home-editor summary').click();await page.locator('[data-home-visible="radar"]').uncheck();assert.equal(await page.locator('.cockpit-widget[data-widget="radar"]').count(),0);
 await page.locator('[data-home-size="brief"]').selectOption('wide');assert.ok(await page.locator('.cockpit-widget[data-widget="brief"]').evaluate(e=>e.classList.contains('size-wide')));
 await page.getByRole('button',{name:'Move Visit brief later',exact:true}).click();assert.equal(await page.locator('.cockpit-widget').first().getAttribute('data-widget'),'market');
 await page.reload();await page.getByRole('heading',{name:'Since your last visit'}).waitFor();assert.equal(await page.locator('.cockpit-widget[data-widget="radar"]').count(),0);assert.equal(await page.locator('.cockpit-widget').first().getAttribute('data-widget'),'market');
 await page.getByRole('button',{name:'Market',exact:true}).click();assert.equal(await page.locator('.cockpit-widget[data-widget="radar"]').count(),1);
 await page.getByRole('button',{name:'3M',exact:true}).click();await page.locator('.sector-cell').filter({hasText:'Technology'}).click();await page.getByRole('heading',{name:'Company research',exact:true}).waitFor();assert.equal(await page.locator('#sector-filter').inputValue(),'Technology');
 await page.goto('http://localhost:8810/#/company/TCS');await page.getByRole('heading',{name:'The business in focus'}).waitFor();await page.getByRole('button',{name:'Compare peers',exact:false}).click();await page.getByRole('heading',{name:'Compare the evidence'}).waitFor();assert.equal(await page.locator('.compare-card').count(),2);assert.match(await page.locator('.comparison-slots').innerText(),/INFY/);
 await page.goto('http://localhost:8810/#/company/TCS');await page.getByRole('button',{name:'Follow TCS',exact:true}).click();await page.reload();await page.getByRole('heading',{name:'The business in focus'}).waitFor();
 await page.goto('http://localhost:8810/#/');await page.getByRole('heading',{name:'Since your last visit'}).waitFor();assert.match(await page.locator('.visit-brief').innerText(),/No comparable changes/);
 await page.evaluate(()=>{const prior=JSON.parse(localStorage.getItem('apexpro:visit'));prior.companies.TCS.price=2000;prior.companies.TCS.date='2026-11-11';prior.asOf='2026-11-11';localStorage.setItem('apexpro:visit',JSON.stringify(prior));const desk=JSON.parse(localStorage.getItem('apexpro:desk'));desk.notes.TCS={thesis:'Keep this thesis',review:'2020-01-01'};localStorage.setItem('apexpro:desk',JSON.stringify(desk));});
 await page.reload();await page.getByRole('heading',{name:'Since your last visit'}).waitFor();assert.match(await page.locator('.visit-brief').innerText(),/\+20%/);assert.match(await page.locator('.visit-brief').innerText(),/Review due 2020-01-01/);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('apexpro:desk')).notes.TCS.thesis),'Keep this thesis');
 for(const width of [1920,960,390,320]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overview overflow '+width);}
 await page.screenshot({path:'/tmp/apexpro-checks/'+name+'-cockpit-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/apexpro-checks/'+name+'-cockpit.png',fullPage:true});
 await page.goto('http://localhost:8810/#/company/TCS');await page.getByRole('heading',{name:'The business in focus'}).waitFor();await page.setViewportSize({width:320,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'company overflow');assert.deepEqual(errors,[]);
 console.log(name+': layout persistence, independent profiles, widget ordering/sizing, sector drilldown, automatic peers, visit baseline and responsive layouts passed');
 }finally{await browser.close();}
}
