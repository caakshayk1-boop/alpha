import test from 'node:test';
import assert from 'node:assert/strict';
import {liveSample,liveChanges,liveUsable,chunk,nseRegular,afterClose,istTime,lastSession,sessionsBehind,printBasis,liveWindow} from '../src/heatlive.js';
import {sectorStats} from '../src/canvas.js';

const OPEN=Date.parse('2026-11-16T05:30:00Z'),SHUT=Date.parse('2026-11-16T17:30:00Z'),SAT=Date.parse('2026-11-14T05:30:00Z');
const R=(sym,sector,t,x={})=>({sym,sector,liquid:true,turnover_cr:t,r1d:.5,...x});
const rows=[R('A1','Tech',500),R('A2','Tech',400),R('A3','Tech',300),R('A4','Tech',10),R('B1','Bank',900),R('B2','Bank',100),R('B3','Bank',50),R('Z1','Tech',9999,{liquid:false}),R('Z2','Tech',9999,{stale:true}),R('Z3','Tech',9999,{sector:null}),R('Z4','Tech',0)];
const Q=(px,prev,age=60,x={})=>({px,prev,pt:OPEN/1000-age,live:true,...x});

test('the sample is the top names by traded value in each sector; illiquid, stale, sector-less and zero-turnover rows are never in it',()=>{
  assert.deepEqual(liveSample(rows,2),['A1','A2','B1','B2']);assert.deepEqual(liveSample(rows,6).sort(),['A1','A2','A3','A4','B1','B2','B3']);
});
test('the session clock: Monday 11:00 IST is on; 23:00 IST and a Saturday are not',()=>{assert.equal(nseRegular(OPEN),true);assert.equal(nseRegular(SHUT),false);assert.equal(nseRegular(SAT),false);});
test('the live change is price over previous close; a missing, stale, malformed or not-live quote leaves the name out',()=>{
  const h=liveChanges(['A1','A2','A3','B1','B2','B3'],{A1:Q(102,100),A2:Q(99,100),A3:Q(101,100,3600),B1:Q(NaN,100),B2:Q(100,100,60,{live:false}),B3:null},OPEN);
  assert.deepEqual(Object.keys(h.changes),['A1','A2']);assert.ok(Math.abs(h.changes.A1-2)<1e-9&&Math.abs(h.changes.A2+1)<1e-9);assert.equal(h.measured,2);assert.equal(h.asked,6);assert.equal(h.obs,OPEN/1000-60);
  assert.equal(liveChanges(['A1'],{A1:Q(100,0)},OPEN).measured,0);assert.equal(liveChanges(['A1'],{A1:Q(-1,100)},OPEN).measured,0);
});
test('after the close only prints dated today count, as basis "today"; a weekend, a holiday-style gap or the morning before the open measure nothing',()=>{
  const at=(iso,age=30)=>({A1:{...Q(102,100),pt:Date.parse(iso)/1000-age,live:false}});
  assert.equal(afterClose(SHUT),true);assert.equal(afterClose(OPEN),false);assert.equal(afterClose(SAT),false);
  const t=liveChanges(['A1'],at('2026-11-16T17:30:00Z'),SHUT);assert.equal(t.measured,1);assert.equal(t.basis,'today');
  assert.equal(liveChanges(['A1'],{A1:{...Q(102,100),pt:Date.parse('2026-11-13T09:59:00Z')/1000}},SHUT).measured,0,"Friday's print is not today's");
  assert.equal(liveChanges(['A1'],{A1:{...Q(102,100),pt:Date.parse('2026-11-14T09:59:00Z')/1000}},SAT).measured,0,'a Saturday has no session');
  const morning=Date.parse('2026-11-16T02:00:00Z');assert.equal(liveChanges(['A1'],{A1:{...Q(102,100),pt:Date.parse('2026-11-12T09:59:00Z')/1000}},morning).measured,0,'07:30 IST Monday: Thursday is not the newest close (Friday is)');
  assert.equal(liveChanges(['A1'],{A1:Q(102,100)},OPEN).basis,'live');
});
test('the live view is offered only when most of the sample answered, and at least 12 names',()=>{const mk=(a,m)=>({asked:a,measured:m});assert.equal(liveUsable(mk(66,39)),false);assert.equal(liveUsable(mk(66,40)),true);assert.equal(liveUsable(mk(10,10)),false);assert.equal(liveUsable(null),false);});
test('the sector 1D value is the MEDIAN of the live changes (equal weight, as the close column); under 3 names it is missing, never estimated',()=>{
  const live={changes:{A1:2,A2:-1,A3:1,B1:3,B2:0}};const s=sectorStats(rows,live);
  assert.deepEqual(s.find(x=>x.name==='Tech').returns.r1d,{value:1,count:3,live:true});assert.deepEqual(s.find(x=>x.name==='Bank').returns.r1d,{value:null,count:2,live:true});
  assert.equal(sectorStats(rows).find(x=>x.name==='Tech').returns.r1d.live,undefined,'without live the close column is untouched');
});
test('chunking and IST time',()=>{assert.deepEqual(chunk([1,2,3,4,5],2),[[1,2],[3,4],[5]]);assert.deepEqual(chunk([],30),[]);assert.equal(istTime(OPEN/1000),'11:00 IST');});

test('the newest closed session: today after 15:30, else the previous weekday; weekends and the morning before the open point at Friday / yesterday',()=>{
  assert.equal(lastSession(Date.parse('2026-11-20T03:15:00Z')),'2026-11-19','Fri 08:45 IST, before the open');
  assert.equal(lastSession(Date.parse('2026-11-20T06:00:00Z')),'2026-11-19','Fri 11:30 IST, session on');
  assert.equal(lastSession(Date.parse('2026-11-20T10:30:00Z')),'2026-11-20','Fri 16:00 IST, after the close');
  assert.equal(lastSession(Date.parse('2026-11-21T06:00:00Z')),'2026-11-20','Saturday');assert.equal(lastSession(Date.parse('2026-11-22T06:00:00Z')),'2026-11-20','Sunday');
  assert.equal(lastSession(Date.parse('2026-11-23T02:00:00Z')),'2026-11-20','Monday before the open');
});
test('the screen is behind by the weekday sessions between its price date and the newest close; unknown dates count as 0, never as stale-by-guess',()=>{
  const fri=Date.parse('2026-11-20T03:15:00Z');
  assert.equal(sessionsBehind('2026-11-18',fri),1);assert.equal(sessionsBehind('2026-11-19',fri),0);assert.equal(sessionsBehind('2026-11-17',fri),2);assert.equal(sessionsBehind('',fri),0);assert.equal(sessionsBehind('2026-11-20',fri),0);
  assert.equal(sessionsBehind('2026-11-19',Date.parse('2026-11-23T02:00:00Z')),1,'Thursday screen on Monday morning: Friday missing');
});
test('before the open the print dated the newest close is offered as "close" (the screen is one session behind); older, future or malformed prints are not',()=>{
  const fri=Date.parse('2026-11-20T03:15:00Z'),at=iso=>({px:102,prev:100,pt:Date.parse(iso)/1000,live:false});
  assert.equal(printBasis(at('2026-11-19T10:00:00Z'),fri),'close');assert.equal(printBasis(at('2026-11-18T10:00:00Z'),fri),null);assert.equal(printBasis(at('2026-11-20T10:00:00Z'),fri),null);assert.equal(printBasis({...at('2026-11-19T10:00:00Z'),px:NaN},fri),null);
  const h=liveChanges(['A1','A2'],{A1:at('2026-11-19T10:00:00Z'),A2:at('2026-11-18T10:00:00Z')},fri);assert.equal(h.measured,1);assert.equal(h.basis,'close');
});
test('quotes are worth asking for while the session is on, after the close, or while the screen is behind the newest close; not when it is current',()=>{
  const fri=Date.parse('2026-11-20T03:15:00Z');assert.equal(liveWindow('2026-11-18',fri),true);assert.equal(liveWindow('2026-11-19',fri),false);assert.equal(liveWindow('2026-11-19',OPEN),true);assert.equal(liveWindow('2026-11-12',SAT),true);assert.equal(liveWindow('2026-11-13',SAT),false,'a Friday screen on a Saturday is current');
});
