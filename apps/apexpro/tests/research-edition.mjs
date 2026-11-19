import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {census,cohortRows,median} from '../src/edition.js';
import {normalizeTrail,appendTrail,mergeTrail,observationEvents} from '../src/trail.js';
assert.equal(median([9,null,1,4,2]),3);
const rows=[0,9.9,10,99,100,null,-1,101].map((q,i)=>({sym:'S'+i,q})),c=census(rows);
assert.equal(c.measured,5);assert.equal(c.missing,3);assert.equal(c.median,10);
assert.deepEqual(c.bins.map(b=>b.rows.length),[2,1,0,0,0,0,0,0,0,2]);
for(const bin of c.bins)assert.deepEqual(cohortRows(rows,{kind:'bin',key:'q',low:bin.low}),bin.rows);
assert.equal(cohortRows([{has_stmts:false},{}, {has_stmts:true}],{kind:'gap',value:'statements'}).length,1);
assert.equal(normalizeTrail([{kind:'note',symbol:'<bad>',at:'today'}]).length,0);
const event={kind:'checkpoint',symbol:'TCS',at:'2026-11-16T10:00:00Z',price:200,date:'2026-11-13',fingerprint:'same'};
let events=appendTrail([],event);assert.equal(appendTrail(events,event).length,1);assert.equal(mergeTrail(events,events).length,1);
const desk={watch:['TCS'],conditions:{TCS:{target:250,direction:'above'}}},r={sym:'TCS',price:200,last_date:'2026-11-13',sma50:190,sma200:180};
events=observationEvents([r],desk,[]);assert.equal(events.length,2);assert.equal(observationEvents([r],desk,events).length,2);const changed=observationEvents([{...r,price:260}],desk,events);assert.equal(changed.length,4);assert.match(changed.at(-1).detail,/not a crossing timestamp/);
const base=process.env.APEX_BASE||'http://localhost:8810',out='docs/apexpro/research-edition/proof';
for(const [name,engine]of [['chromium',chromium],['webkit',webkit]]){
 const b=await engine.launch(),p=await b.newPage({serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base);await p.locator('#advanced-research > summary').click();await p.locator('#evidence-explorer').waitFor();assert.equal(await p.locator('#evidence-explorer').getAttribute('open'),null);await p.locator('#evidence-explorer > summary').click();await p.locator('#evidence-field').waitFor();await p.locator('#evidence-field').focus();await p.keyboard.press('Home');const first=await p.locator('#evidence-field').getAttribute('data-selected');await p.keyboard.press('End');assert.notEqual(await p.locator('#evidence-field').getAttribute('data-selected'),first);
 await p.locator('#field-axis').selectOption('tech');assert.equal(await p.locator('#evidence-field').getAttribute('data-axis'),'tech');
 assert.equal(await p.locator('.census-row').count(),4);const bin=p.locator('.census-row[data-key="g"] .census-bin').nth(4);await bin.click();await p.locator('.cohort-banner').waitFor();assert.match(await p.locator('.cohort-banner').innerText(),/Growth|growth/);
 await p.goto(base+'/#/company/TCS');await p.locator('[data-action="capture-evidence"]').waitFor();await p.locator('[data-action="capture-evidence"]').click();assert.match(await p.locator('.research-trail').innerText(),/Research checkpoint saved/);await p.reload();await p.locator('.research-trail').waitFor();assert.match(await p.locator('.research-trail').innerText(),/Research checkpoint saved/);
 const download=p.waitForEvent('download');await p.locator('[data-action="share-card"]').click();const dest=out+'/'+name+'-TCS.png';await(await download).saveAs(dest);const png=await fs.readFile(dest);assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),1600);
 await p.locator('[data-target="chart-chapter"]').click();assert.match(p.url(),/#\/company\/TCS$/);
 await p.goto(base);await p.locator('.matrix-row').first().click();assert.equal(await p.locator('.matrix-row[aria-pressed=true]').count(),1);await p.locator('.canvas-preview a').click();await p.locator('.company-price').waitFor();
 assert.deepEqual(errors,[]);await b.close();console.log(name+': score field keyboard, axes, cohort drill-through, checkpoint reload, PNG and sector navigation passed');
}
console.log('Research census, missing flags, bounded trail and condition observations passed');
