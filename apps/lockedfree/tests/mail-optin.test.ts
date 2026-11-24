import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src=readFileSync(new URL('../worker.js',import.meta.url),'utf8').replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject {}');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'))).default;
test('only explicit delivery consent with configured provider can request double opt-in',async t=>{
  let requests=0;const mock=t.mock.method(globalThis,'fetch',async(_url:string,init:RequestInit)=>{requests++;assert.deepEqual(JSON.parse(String(init.body)).includeListIds,[7]);return new Response(null,{status:201})});
  const env={SUBSCRIBERS:{idFromName:()=>1,get:()=>({add:async()=>true,mayConfirm:async()=>true,confirmed:async()=>true})}};
  const configured={...env,BREVO_API_KEY:'mock',BREVO_LIST_ID:7,BREVO_DOI_TEMPLATE_ID:12};
  const post=(delivery:string,config:object)=>worker.fetch(new Request('https://example.test/api/subscribe',{method:'POST',body:new URLSearchParams({email:'test@example.invalid',consent:'weekly-note-v1',delivery})}),config);
  assert.equal((await(await post('',configured)).json()).delivery,'registered');
  assert.equal((await(await post('email-v1',env)).json()).delivery,'registered');assert.equal(requests,0);
  assert.equal((await(await post('email-v1',configured)).json()).delivery,'confirmation');assert.equal(requests,1);
  mock.mock.mockImplementation(async()=>new Response(null,{status:401}));assert.equal((await post('email-v1',configured)).status,503);
});

test('a second request for the same address within a day sends no second confirmation email, and the reply does not say so',async t=>{
  let requests=0;t.mock.method(globalThis,'fetch',async()=>{requests++;return new Response(null,{status:201})});
  const seen=new Map<string,number>();const stub={add:async()=>true,mayConfirm:async(e:string,now:string)=>{const at=seen.get(e);return at===undefined||Date.parse(now)-at>=864e5},confirmed:async(e:string,now:string)=>{seen.set(e,Date.parse(now));return true}};
  const env={SUBSCRIBERS:{idFromName:()=>1,get:()=>stub},BREVO_API_KEY:'mock',BREVO_LIST_ID:7,BREVO_DOI_TEMPLATE_ID:12};
  const post=()=>worker.fetch(new Request('https://example.test/api/subscribe',{method:'POST',body:new URLSearchParams({email:'victim@example.invalid',consent:'weekly-note-v1',delivery:'email-v1'})}),env);
  assert.equal((await(await post()).json()).delivery,'confirmation');assert.equal(requests,1);
  for(let i=0;i<5;i++)assert.equal((await(await post()).json()).delivery,'confirmation');assert.equal(requests,1,'five repeats, still one email');
  seen.set('victim@example.invalid',Date.now()-25*3600e3);assert.equal((await(await post()).json()).delivery,'confirmation');assert.equal(requests,2,'a day later a retry is allowed');
});
test('a failed confirmation request is not recorded, so the visitor can try again at once',async t=>{
  let requests=0,recorded=0;t.mock.method(globalThis,'fetch',async()=>{requests++;return new Response(null,{status:500})});
  const env={SUBSCRIBERS:{idFromName:()=>1,get:()=>({add:async()=>true,mayConfirm:async()=>true,confirmed:async()=>{recorded++;return true}})},BREVO_API_KEY:'mock',BREVO_LIST_ID:7,BREVO_DOI_TEMPLATE_ID:12};
  const post=()=>worker.fetch(new Request('https://example.test/api/subscribe',{method:'POST',body:new URLSearchParams({email:'a@example.invalid',consent:'weekly-note-v1',delivery:'email-v1'})}),env);
  assert.equal((await post()).status,503);assert.equal((await post()).status,503);assert.equal(requests,2);assert.equal(recorded,0);
});
