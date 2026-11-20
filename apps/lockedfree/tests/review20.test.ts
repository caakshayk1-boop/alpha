import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyLedger, validate, type Ledger } from '../src/lib/ledger.ts';
import { bookState, heroSeries, maxDrawdown, tradeRows } from '../src/lib/view.ts';
import { historyInterval, yearChange, trendWords, type C } from '../src/lib/pricechart.ts';
import { usableQuote, quoteStamp } from '../src/lib/quotes.ts';
import { liveMark } from '../src/lib/livecalls.ts';

test('cash reconciles buys, a partial exit and a full exit without counting charges twice', () => {
  const L = emptyLedger(); L.config.capital = 10000;
  L.picks = [{ id: 'a', screen_id: 'piotroski', symbol: 'A', first_listed_run: '2026-11-17', status: 'open', stop: 80, exit_after: null, exit_reason: null, voided: null, fills: [
    {date:'2026-11-17', side:'buy', qty:10, price:100, charges:[{kind:'buy',amount:2}]},
    {date:'2026-11-18', side:'sell', qty:4, price:120, charges:[{kind:'sell',amount:3}]}
  ] }];
  const b = bookState(L, () => 110)!;
  assert.equal(b.cash, 9475); assert.equal(b.deployed, 600); assert.equal(b.charges, 5); assert.equal(b.equity, 10135);
  L.picks[0].fills.push({date:'2026-11-19', side:'sell', qty:6, price:90, charges:[{kind:'sell',amount:4}]}); L.picks[0].status='closed';
  const closed=bookState(L,()=>null)!; assert.equal(closed.cash,10011); assert.equal(closed.equity,10011); assert.equal(closed.open,0); assert.equal(closed.charges,9);
});
test('drawdown includes first-day costs, and a missing starting benchmark is not zero return', () => {
  const L = emptyLedger(); L.config.capital=10000;
  L.book_days=[{date:'2026-11-17',screen_id:'all',equity:-10,committed:1000,realised:0,unrealised:-10,open_n:1,benchmark_close:null},{date:'2026-11-18',screen_id:'all',equity:-100,committed:1000,realised:0,unrealised:-100,open_n:1,benchmark_close:200}];
  assert.deepEqual(heroSeries(L).map(p=>[p.ret,p.dd,p.bench]),[[-0.1,-0.1,null],[-1,-1,null]]);
  assert.equal(maxDrawdown(L),-100);
  L.book_days[0].benchmark_close=100; assert.equal(heroSeries(L)[1].bench,100);
});
test('published ledger stops and displayed targets match each recorded rule; corruption is rejected', () => {
  const L: Ledger=JSON.parse(readFileSync(new URL('../ledger/ledger.json',import.meta.url),'utf8'));
  const rows=tradeRows(L,()=>100); assert.deepEqual(validate(L),[]);
  for (const p of L.picks.filter(p=>p.rule&&p.fills.length&&p.status!=='voided')) {
    const row=rows.find(r=>r.id===p.id)!;
    assert.ok(Math.abs(row.target! - p.fills[0].price*(1+p.rule!.target_pct/100))<0.011,p.symbol);
  }
  const c=rows.find(r=>r.symbol==='CHENNPETRO'); assert.equal(c?.target,1620.24);
  L.picks.find(p=>p.symbol==='CHENNPETRO')!.stop! += 8; assert.match(validate(L).join(' '),/initial stop/);
});
const point=(t:string,c:number):C=>({t,o:c,h:c,l:c,c,v:null});
test('monthly observations never become daily averages or a 252-month year',()=>{
  const d=Array.from({length:372},(_,i)=>point(`${1996+Math.floor(i/12)}-${String(i%12+1).padStart(2,'0')}-01`,100+i));
  assert.equal(historyInterval(d),'M'); assert.doesNotMatch(trendWords(d),/50-day|200-day/);
  const expected=(471/459-1)*100; assert.ok(Math.abs(yearChange(d)!-expected)<1e-9);
  assert.equal(yearChange([point('2026-10-01',100),point('2026-11-01',105)]),null);
});
test('quote validation rejects invalid, undated and older-session prices and shows actual print time',()=>{
  const t=Date.parse('2026-11-19T10:00:00Z')/1000;
  assert.ok(usableQuote({px:110,t},'2026-11-18'));
  assert.equal(usableQuote({px:110,t},'2026-11-20'),false);
  assert.equal(usableQuote({px:Infinity,t}),false); assert.equal(usableQuote({px:110,t:null}),false);
  assert.match(quoteStamp(t),/19 Nov 2026.*15:30 IST/);
  assert.equal(liveMark(10,100,Infinity),null);
});
