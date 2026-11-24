import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{upstream} from '../worker.mjs';
const u=p=>new URL('https://apexpro.askakshay.com'+p);
test('/api/quotes accepts 1 to 30 valid symbols and goes to the tick feed; anything else is refused',()=>{
  assert.deepEqual(upstream(u('/api/quotes?s=TCS,INFY')),['https://alpha.askakshay.com/v1/market/tick?s=TCS,INFY',30,'https://tripwire.askakshay.com/api/tick?s=TCS,INFY']);
  const thirty=Array.from({length:30},(_,i)=>'S'+i).join(',');assert.ok(upstream(u('/api/quotes?s='+thirty)));
  assert.equal(upstream(u('/api/quotes?s='+thirty+',EXTRA')),null,'31 names');assert.equal(upstream(u('/api/quotes')),null,'none');
  assert.equal(upstream(u('/api/quotes?s=TCS,../x')),null);assert.equal(upstream(u('/api/quotes?s=tcs')),null,'lower case');assert.equal(upstream(u('/api/quotes?s=TCS,,INFY')),null,'empty name');
});
test('the routes read the hub, with Tripwire named as the market fallback',()=>{assert.equal(upstream(u('/api/market'))[0],'https://alpha.askakshay.com/v1/market/pulse');assert.equal(upstream(u('/api/market'))[2],'https://tripwire.askakshay.com/api/pulse');assert.equal(upstream(u('/api/macro'))[0],'https://alpha.askakshay.com/v1/market/macro');assert.equal(upstream(u('/api/company?s=TCS'))[0],'https://alpha.askakshay.com/c/TCS.json');assert.equal(upstream(u('/api/nope')),null);});
test('font files are cached for a year; images a day; code and pages are revalidated; security headers stay',async()=>{
  const env={ASSETS:{fetch:async()=>new Response('x')}},ctx={waitUntil(){}};
  const get=async p=>(await worker.fetch(new Request('https://apexpro.askakshay.com'+p),env,ctx)).headers;
  assert.equal((await get('/fonts/geist-var.woff2')).get('cache-control'),'public, max-age=31536000, immutable');assert.equal((await get('/mono.woff2')).get('cache-control'),'public, max-age=31536000, immutable');
  assert.equal((await get('/icon-192.png')).get('cache-control'),'public, max-age=86400');assert.equal((await get('/app.js')).get('cache-control'),'no-cache');assert.equal((await get('/')).get('cache-control'),'no-cache');
  const h=await get('/fonts/geist-var.woff2');assert.ok(h.get('content-security-policy')&&h.get('x-frame-options')==='DENY'&&h.get('x-content-type-options')==='nosniff');
});
test('a too-long query is refused, except for /api/quotes which carries a name list',async()=>{
  const env={ASSETS:{fetch:async()=>new Response('x')}},ctx={waitUntil(){}};
  const r=await worker.fetch(new Request('https://apexpro.askakshay.com/api/market?x='+'a'.repeat(120)),env,ctx);assert.equal(r.status,400);
});

test('uncached /api calls are limited per client; cached answers never count; no binding means no limit',async()=>{
  const store=new Map();globalThis.caches={default:{match:async k=>store.get(k.url)?.clone(),put:async(k,v)=>{store.set(k.url,v)}}};
  const realFetch=globalThis.fetch;let upstreamCalls=0;globalThis.fetch=async()=>{upstreamCalls++;return new Response(JSON.stringify({ok:true,sym:'X'}),{headers:{'content-type':'application/json'}})};
  try{
    const ctx={waitUntil(p){}};let allowed=2;const seen=[];const env={ASSETS:{fetch:async()=>new Response('x')},API_LIMIT:{limit:async o=>{seen.push(o.key);return{success:allowed-->0}}}};
    const get=(p,ip='9.9.9.9')=>worker.fetch(new Request('https://apexpro.askakshay.com'+p,{headers:{'cf-connecting-ip':ip}}),env,ctx);
    assert.equal((await get('/api/company?s=AAA1')).status,200);assert.equal((await get('/api/company?s=AAA2')).status,200);
    const third=await get('/api/company?s=AAA3');assert.equal(third.status,429);assert.equal(upstreamCalls,2,'the refused call never reached the hub');assert.deepEqual(seen,['9.9.9.9','9.9.9.9','9.9.9.9']);
    allowed=0;assert.equal((await get('/api/company?s=AAA1')).status,200,'a cached answer is served even when the client is over its limit');assert.equal(seen.length,3,'and is not counted');
    const open={ASSETS:env.ASSETS};assert.equal((await worker.fetch(new Request('https://apexpro.askakshay.com/api/company?s=BBB1'),open,ctx)).status,200,'no binding, no limit');
  }finally{globalThis.fetch=realFetch;delete globalThis.caches}
});
