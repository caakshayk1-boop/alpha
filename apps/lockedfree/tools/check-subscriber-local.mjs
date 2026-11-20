// Run against an isolated Wrangler instance with --local --var ADMIN_TOKEN:local-test-only.
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8884/api/', email='audit@example.invalid';
const headers={authorization:'Bearer local-test-only'};
const rows=async()=>{const r=await fetch(base+'subscribers',{headers});assert.equal(r.status,200);return (await r.json()).rows;};
assert.equal((await rows()).length,0,'Use a fresh local persistence directory');
assert.equal((await fetch(base+'subscribers')).status,401);
for(const address of [email,email.toUpperCase()]){const r=await fetch(base+'subscribe',{method:'POST',body:new URLSearchParams({email:address,consent:'weekly-note-v1'})});assert.equal(r.status,200);}
const all=await rows();assert.equal(all.length,1);assert.equal(all[0].email,email);assert.equal(all[0].consent,'weekly-note-v1');assert.ok(Date.parse(all[0].at));
assert.equal((await fetch(base+'subscribers?'+new URLSearchParams({email}),{method:'DELETE',headers})).status,200);assert.equal((await rows()).length,0);console.log('Local Durable Object: signup, duplicate, authorization and deletion passed');
