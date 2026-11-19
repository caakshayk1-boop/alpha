import test from 'node:test';
import assert from 'node:assert/strict';
import { trend, evidence, filterRows, sectors, normalizeDesk, chartPoints, money, percent, escape } from '../src/model.js';
import { upstream } from '../worker.mjs';
test('missing financials never become zero or qualify as quality/value', () => {
  assert.equal(money(null), '—'); assert.equal(percent(undefined), '—');
  assert.equal(trend({price:50,sma50:null,sma200:20}), 'Unknown');
  assert.equal(filterRows([{sym:'A',name:'A',roce:30,cfo_pat:null}], {preset:'quality'}).length, 0);
  assert.equal(filterRows([{sym:'A',name:'A',roce:30,pe:-5}], {preset:'value'}).length, 0);
});
test('quality selection and sort put unavailable values last', () => {
  const rows = [{sym:'A',name:'Alpha',roce:21,cfo_pat:1,pe:18,comp:60},{sym:'B',name:'Beta',roce:40,cfo_pat:.8,pe:null,comp:90},{sym:'C',name:'Gamma',roce:30,cfo_pat:2,pe:10,comp:null}];
  assert.deepEqual(filterRows(rows,{preset:'quality'}).map(r=>r.sym),['A','C']);
  assert.deepEqual(filterRows(rows,{sort:'pe',direction:1}).map(r=>r.sym),['C','A','B']);
  assert.deepEqual(filterRows(rows,{query:'alpha'}).map(r=>r.sym),['A']);
});
test('trend requires price and averages in the correct order',()=>{
 assert.equal(trend({price:120,sma50:110,sma200:100}),'Uptrend');
 assert.equal(trend({price:90,sma50:95,sma200:100}),'Downtrend');
 assert.equal(trend({price:110,sma50:90,sma200:100}),'Mixed');
});
test('sector averages exclude missing values and retain zero returns',()=>{
 assert.deepEqual(sectors([{sector:'Tech',r1d:0},{sector:'Tech',r1d:4},{sector:'Tech',r1d:null}]),[{name:'Tech',change:2,count:2}]);
});
test('evidence includes risks and escapes source strings',()=>{
 const e=evidence({roce:10,fy:'<FY>',cfo_pat:.3,risk:{flags:[{t:'<script>bad</script>'}]}});
 assert.equal(e.yes.length,0); assert.match(e.no.join(' '),/&lt;script&gt;/); assert.match(e.no[0],/&lt;FY&gt;/);
 assert.equal(escape('"<&'), '&quot;&lt;&amp;');
});
test('backup import validates symbols, bounds text, and removes duplicate follows',()=>{
 const d=normalizeDesk({watch:['TCS','TCS','../secret'],notes:{TCS:{thesis:'x'.repeat(6000),review:'bad'},'../secret':{thesis:'bad'}}});
 assert.deepEqual(d.watch,['TCS']); assert.equal(d.notes.TCS.thesis.length,5000); assert.equal(d.notes.TCS.review,''); assert.equal(Object.keys(d.notes).length,1);
 assert.throws(()=>normalizeDesk([]));
});
test('chart dates stay paired when incomplete values are removed',()=>{
 assert.deepEqual(chartPoints({t:[1,2,3,4],c:[100,null,102,0]},2),[{t:1,v:100},{t:3,v:102}]);
});
test('proxy only permits fixed upstreams and valid symbols',()=>{
 assert.equal(upstream(new URL('https://apex.test/api/company?s=../../private')),null);
 assert.equal(upstream(new URL('https://apex.test/api/chart?s=https://evil.test')),null);
 assert.equal(upstream(new URL('https://apex.test/api/proxy?url=https://evil.test')),null);
 assert.equal(upstream(new URL('https://apex.test/api/company?s=M%26M'))[0],'https://alpha.askakshay.com/c/M%26M.json');
});

import { chartSeries, chartStats, movingAverage, healthChecks, snapshot, changesSince } from '../src/research.js';
test('benchmark rebasing starts on first shared date and retains the date alignment',()=>{
 const result=chartSeries({t:[1,2,3,4],c:[10,20,22,24],n:[null,100,null,120]},4,true);
 assert.deepEqual(result.map(p=>[p.t,p.y,p.benchmark]),[[2,100,100],[4,120,120]]);
 assert.deepEqual(chartSeries({t:[1,2],c:[10,11]},2,true),[]);
});
test('moving averages use preceding sessions and never fill missing observations',()=>{
 assert.deepEqual(movingAverage([10,20,30,40],3),[null,null,20,30]);
 assert.deepEqual(movingAverage([10,null,30],2),[null,null,null]);
 const full={t:Array.from({length:60},(_,i)=>i+1),c:Array.from({length:60},(_,i)=>i+1)};
 assert.equal(chartSeries(full,5)[0].ma50,31.5);
});
test('drawdown uses each preceding peak, not just the first price',()=>{
 const result=chartStats([100,200,150,180]);
 assert.equal(result.change,80);assert.equal(result.drawdown,-25);assert.ok(result.volatility>0);
 assert.equal(chartStats([100]).volatility,null);
 assert.equal(chartStats([100,100,100]).volatility,0);
});
test('health checks distinguish missing data from failed rules',()=>{
 const checks=healthChecks({roce:null,cfo_pat:0,rev_cagr:20,de:.4});
 assert.deepEqual(checks.map(c=>c.pass),[null,false,true,true]);
});
test('review snapshot captures evidence, detects trend crossing and remains compatible with old backups',()=>{
 const before=snapshot({price:100,pe:20,roce:15,sma200:105,last_date:'2026-11-12'});
 const changes=changesSince({price:110,pe:22,roce:15,sma200:106},before);
 assert.equal(changes.length,3);assert.ok(Math.abs(changes[0].value-10)<1e-9);
 assert.match(changes[2].text,/crossed above/);
 assert.deepEqual(normalizeDesk({watch:['TCS'],notes:{}}).snapshots,{});
 assert.equal(normalizeDesk({snapshots:{TCS:before}}).snapshots.TCS.price,100);
});

import { displaySettings } from '../src/terminal.js';
test('display preferences validate stored values and do not accept arbitrary themes or density',()=>{
 assert.deepEqual(displaySettings({density:'giant',colorblind:'true',reduced:true,collapsed:true}),{density:'comfortable',colorblind:false,reduced:true,collapsed:true,timeMachine:true});
 assert.equal(displaySettings(null).density,'comfortable');
 assert.match(upstream(new URL('https://apex.test/api/spark?s=TCS'))[0],/^https:\/\/alpha\.askakshay\.com\/v1\/market\/chart\?s=TCS$/);
 assert.equal(upstream(new URL('https://apex.test/api/spark?s=..%2Fsecret')),null);
});
