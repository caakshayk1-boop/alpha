const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
const b=await chromium.launch({channel:process.env.BROWSER_CHANNEL || undefined});
try {
const c=await b.newContext({reducedMotion:'reduce',serviceWorkers:'block'});
await c.route('https://lockedfree.test/**',async route=>{
 const p=decodeURIComponent(new URL(route.request().url()).pathname);
 if(p.startsWith('/api/'))return route.fulfill({status:503,body:'{}'});
 const file=path.join(process.cwd(),'dist',p,p.endsWith('/')?'index.html':'');
 if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
 return route.fulfill({path:file});
});
const pg=await c.newPage();pg.setDefaultTimeout(6500);const errors=[];pg.on('pageerror',e=>errors.push(e.message));
const problems=[];
for(const width of [320,375,768,1280]){
await pg.setViewportSize({width,height:800});
let pageSize;for(const p of ['/','/terminal/','/calls/','/screener/','/gate/','/plan/','/practice/','/about/','/privacy/','/terms/','/method/','/stock/360ONE/','/stock/M&M/']){
 await pg.goto('https://lockedfree.test'+p);const w=await pg.evaluate(()=>document.documentElement.scrollWidth);
 if(p!=='/') {const h=pg.locator('main h1');assert.equal(await h.count(),1,p);const size=await h.evaluate(el=>getComputedStyle(el).fontSize);pageSize??=size;assert.equal(size,pageSize,`${p} at ${width}px`);}
 if(w>width+1)problems.push([width,p,w]);
}
}
await pg.goto('https://lockedfree.test/screener/');
await pg.locator('[data-next]').waitFor();const first=await pg.locator('[data-body] a').first().innerText();
let n=0;while(await pg.locator('[data-next]').isVisible()){n+=await pg.locator('[data-body] tr').count();await pg.locator('[data-next]').click();}
n+=await pg.locator('[data-body] tr').count();const expected=JSON.parse(fs.readFileSync('dist/data/universe.json')).rows.length;assert.equal(n,expected);const download=pg.waitForEvent('download');await pg.locator('[data-csv]').click();const csv=fs.readFileSync(await (await download).path(),'utf8');assert.equal(csv.split('\n').length,expected+1);
await pg.goto('https://lockedfree.test/gate/');const gate=pg.getByRole('tab').first();await gate.focus();await pg.keyboard.press('End');assert.equal(await pg.locator(':focus').innerText(),'Rules');assert.ok(await pg.getByRole('tabpanel',{name:'Rules'}).isVisible());
await pg.goto('https://lockedfree.test/calls/#record');assert.ok(await pg.locator('#tab-record').isVisible());
await pg.goto('https://lockedfree.test/plan/');
for(let step=0;step<5;step++){await pg.getByRole('radio').first().click();await pg.getByRole('button',{name:'Next',exact:true}).click();}
const list=await pg.locator('#plan-data').textContent();const chosen=Object.entries(JSON.parse(list)).find(([,x])=>x.symbols.length);if(chosen)await pg.locator('#scr').selectOption(chosen[0]);
await pg.getByRole('button',{name:'Finish'}).click();await pg.getByRole('heading',{name:'Your plan',exact:true}).waitFor();
if(chosen){await pg.getByRole('button',{name:/Record this month/}).click();assert.equal(await pg.locator('.cards tbody tr').count(),chosen[1].symbols.length);}
const saved=pg.waitForEvent('download');await pg.getByRole('button',{name:'Download my plan'}).click();const plan=JSON.parse(fs.readFileSync(await (await saved).path()));assert.equal(plan.plan.monthly,5000);if(chosen){const split=plan.deployments[0].split;assert.equal(split.length,chosen[1].symbols.length);assert.ok(split.every(x=>Math.round(x.amount*100)===Math.floor(500000/split.length)));}await pg.emulateMedia({media:'print'});assert.ok(await pg.getByRole('heading',{name:'Your plan',exact:true}).isVisible());const pdf=await pg.pdf();assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length,1,'completed plan prints on one page');await pg.emulateMedia({media:'screen'});
await pg.clock.setFixedTime(new Date('2026-11-17T06:30:00Z'));
const book={schema:'rulebook-book/1',rules:{accountSize:500000,riskPct:1,dailyLossLimit:100,maxTradesPerDay:3,ruleText:'Stop after a loss.',strictUntil:null,setOn:'2026-11-16'},trades:[]};await pg.evaluate(b=>localStorage.setItem('rulebook-book/1',JSON.stringify(b)),book);await pg.goto('https://lockedfree.test/gate/');
const enter=pg.getByRole('button',{name:/Enter paper trade/});assert.ok(await enter.isDisabled());await pg.fill('#sym','TCS');await pg.selectOption('#setup','Breakout from a base');await pg.fill('#trigger','Close above entry');await pg.fill('#stop','90');await pg.fill('#target','130');await pg.fill('#entry','100');assert.equal(await pg.inputValue('#qty'),'500');await enter.click();await pg.fill('input[aria-label^="Exit price"]','85');await pg.getByRole('button',{name:'Close',exact:true}).click();await pg.getByRole('button',{name:/Skip/}).click();await pg.locator('.lock').waitFor();
const backup=pg.waitForEvent('download');await pg.getByRole('button',{name:'Download my book'}).click();const file=await (await backup).path();await pg.evaluate(()=>localStorage.removeItem('rulebook-book/1'));await pg.reload();await pg.locator('input[type=file]').setInputFiles(file);await pg.locator('.lock').waitFor();await pg.clock.setFixedTime(new Date('2026-11-18T06:30:00Z'));await pg.reload();await pg.locator('#sym').waitFor();
await pg.goto('https://lockedfree.test/stock/TCS/');for(const tab of await pg.getByRole('tab').all()){await tab.click();const panel=pg.locator('#'+await tab.getAttribute('aria-controls'));assert.ok(await panel.isVisible());assert.ok(await panel.getByRole('heading').first().isVisible());}
await pg.goto('https://lockedfree.test/calls/');for(const tab of await pg.getByRole('tab').all()){await tab.click();assert.ok(await pg.locator('#'+await tab.getAttribute('aria-controls')).locator('h2').first().isVisible());}
await pg.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage disabled')};});await pg.goto('https://lockedfree.test/plan/');await pg.locator('#tb0').fill('12345');await pg.getByRole('alert').filter({hasText:'blocked storage'}).waitFor();const emergency=pg.waitForEvent('download');await pg.getByRole('button',{name:'Download my plan'}).click();assert.equal(JSON.parse(fs.readFileSync(await(await emergency).path())).plan.buckets[0].target,12345);
const nojs=await b.newContext({javaScriptEnabled:false});await nojs.route('https://lockedfree.test/**',r=>r.request().resourceType()==='document'?r.fulfill({path:path.join(process.cwd(),'dist',decodeURIComponent(new URL(r.request().url()).pathname),'index.html')}):r.abort());const fallback=await nojs.newPage();await fallback.goto('https://lockedfree.test/screener/');assert.equal(await fallback.locator('[data-body] tr').count(),Math.min(25,expected));await nojs.close();
console.log({widthProblems:problems,errors,pagination:n,csvLines:expected+1});assert.equal(errors.length,0);assert.equal(problems.length,0);
}finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
