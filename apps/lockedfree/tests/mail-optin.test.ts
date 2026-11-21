import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src=readFileSync(new URL('../worker.js',import.meta.url),'utf8').replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject {}');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'))).default;
test('only explicit delivery consent with configured provider can request double opt-in',async t=>{
  let requests=0;const mock=t.mock.method(globalThis,'fetch',async(_url:string,init:RequestInit)=>{requests++;assert.deepEqual(JSON.parse(String(init.body)).includeListIds,[7]);return new Response(null,{status:201})});
  const env={SUBSCRIBERS:{idFromName:()=>1,get:()=>({add:async()=>true})}};
  const configured={...env,BREVO_API_KEY:'mock',BREVO_LIST_ID:7,BREVO_DOI_TEMPLATE_ID:12};
  const post=(delivery:string,config:object)=>worker.fetch(new Request('https://example.test/api/subscribe',{method:'POST',body:new URLSearchParams({email:'test@example.invalid',consent:'weekly-note-v1',delivery})}),config);
  assert.equal((await(await post('',configured)).json()).delivery,'registered');
  assert.equal((await(await post('email-v1',env)).json()).delivery,'registered');assert.equal(requests,0);
  assert.equal((await(await post('email-v1',configured)).json()).delivery,'confirmation');assert.equal(requests,1);
  mock.mock.mockImplementation(async()=>new Response(null,{status:401}));assert.equal((await post('email-v1',configured)).status,503);
});
