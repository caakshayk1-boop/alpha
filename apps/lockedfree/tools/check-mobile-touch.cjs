// Chromium touch emulation, not physical iOS or Android certification. Run after astro build.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||undefined});
try{for(const width of [320,375]){
const c=await browser.newContext({viewport:{width,height:740},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
const base='https://lockedfree.test',bars=Array.from({length:60},(_,i)=>({t:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),c:101+i,h:103+i,l:99+i,o:100+i,v:1000}));
await c.route(base+'/**',r=>{const u=decodeURIComponent(new URL(r.request().url()).pathname);if(u==='/api/chart')return r.fulfill({json:{points:bars}});const f=path.join('dist',u,u.endsWith('/')?'index.html':'');return fs.existsSync(f)?r.fulfill({path:f}):r.fulfill({status:404,body:''});});
const p=await c.newPage(),dev=await c.newCDPSession(p);await dev.send('Emulation.setEmulatedMedia',{features:[{name:'display-mode',value:'standalone'}]});
await p.goto(base+'/terminal/');await p.evaluate(()=>scrollTo(0,400));const brand=await p.locator('.brand-name').boundingBox();assert.ok(brand && brand.y>=0 && brand.y<80 && brand.x>=0 && brand.x+brand.width<=width);
await p.goto(base+'/calls/');const row=p.locator('.exit-line').first();await row.scrollIntoViewIfNeeded();assert.match(await row.innerText(),/Close ₹[\s\S]*stop ₹[\s\S]*Target ₹/i);assert.ok(await row.evaluate(e=>[...e.children].every(x=>x.getBoundingClientRect().right<=innerWidth+1 && x.getBoundingClientRect().left>=0)));
await p.goto(base+'/stock/TCS/');const plot=p.locator('[data-price-chart]');await plot.locator('svg').waitFor();await plot.evaluate(e=>e.scrollIntoView({block:'center'}));
const b=await plot.boundingBox(),x=b.x+50,y=b.y+b.height/2;
async function touch(type,px,py){await dev.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:px,y:py}]});}
const start=await p.evaluate(()=>scrollY);await touch('touchStart',x,y);await touch('touchMove',x+90,y);assert.equal(await plot.locator('.xh').getAttribute('visibility'),'visible');assert.equal(await p.evaluate(()=>scrollY),start);await touch('touchEnd');
await touch('touchStart',x,y);for(let i=1;i<=5;i++)await touch('touchMove',x,y-20*i);await touch('touchEnd');await p.waitForFunction(n=>scrollY>n+20,start,{timeout:3000});console.log(width+'px: header, prices and both touch gestures passed');await c.close();
}}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
