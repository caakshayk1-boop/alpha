import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceAt, confirmedDivergences } from '../src/chartEvidence.ts';
const start=Date.UTC(2025,0,1)/1000;
const points=(cs:number[])=>cs.map((c,i)=>({t:start+i*86400,c}));
test('historical inspector never reads future closes and requires complete moving-average windows',()=>{
 const past=points(Array.from({length:210},(_,i)=>i+100)); const cutoff=past[199].t;
 const a=evidenceAt(past,cutoff)!;assert.equal(a.close,299);assert.equal(a.ma20,289.5);assert.equal(a.ma50,274.5);assert.equal(a.ma200,199.5);assert.equal(a.trend,'Uptrend');assert.equal(a.momentum[0].value,100);assert.equal(a.fromHigh,null);
 const full=points(Array.from({length:400},(_,i)=>100+i));assert.equal(evidenceAt(full,full.at(-1)!.t)!.fromHigh,0);
 assert.deepEqual(evidenceAt([...past,{t:past.at(-1)!.t+86400,c:1e8}],cutoff),a);
 const short=evidenceAt(past,past[4].t)!;assert.equal(short.ma20,null);assert.equal(short.trend,'Unmeasured');assert.equal(short.momentum[0].value,null);assert.equal(evidenceAt([],cutoff),null);
});
test('divergences require confirmed strict pivots and never appear early',()=>{
 const bars=points([...Array.from({length:30},(_,i)=>100+i%2),90,70,50,60,70,80,90,100,95,90,85,80,75,70,65,60,55,48,52,56,60]);
 const ds=confirmedDivergences(bars,14);assert.ok(ds.length>0);
 for(const d of ds){const end=bars.findIndex(p=>p.t===d.to);assert.equal(d.confirmed,bars[end+3].t);assert.ok(d.kind==='bullish'?d.priceTo<d.priceFrom&&d.rsiTo>d.rsiFrom:d.priceTo>d.priceFrom&&d.rsiTo<d.rsiFrom);
 assert.ok(!confirmedDivergences(bars.slice(0,end+3),14).some(v=>v.to===d.to));
 assert.ok(confirmedDivergences(bars.slice(0,end+4),14).some(v=>v.to===d.to));}
 const mirrored=confirmedDivergences(bars.map(p=>({...p,c:200-p.c})),14);assert.ok(mirrored.some(d=>d.kind==='bearish'));
 assert.deepEqual(confirmedDivergences(points(Array(100).fill(10))),[]);
});
