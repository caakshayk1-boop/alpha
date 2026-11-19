import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setQuotes,livePrice,liveLabel,liveListLabel,clearQuotes} from '../src/liveprice.js';

// Thursday 19 Nov 2026. 12:00 IST is 06:30 UTC, inside the 09:15-15:30 session; 16:30 IST is 11:00 UTC, after it.
const open=Date.parse('2026-11-19T06:30:00Z'),after=Date.parse('2026-11-19T11:00:00Z'),sat=Date.parse('2026-11-21T06:30:00Z');
const sec=ms=>Math.floor(ms/1000);
const q=(over={})=>({px:1100,prev:1000,pt:sec(open-60000),live:true,...over});

test('a fresh live print during the session is offered, with its change against the previous close',()=>{
  clearQuotes();setQuotes({INFY:q()});
  const l=livePrice('INFY',open);assert.equal(l.px,1100);assert.ok(Math.abs(l.chg-10)<1e-9);assert.equal(l.basis,'live');
  assert.match(liveLabel(l),/^Live price · \d\d:\d\d IST$/);
});
test('a stale, unflagged, missing or malformed print is never offered',()=>{
  clearQuotes();setQuotes({A:q({pt:sec(open-400000)}),B:q({live:false}),C:q({px:0}),D:q({prev:NaN}),E:q({pt:sec(open+60000)})});
  for(const s of ['A','B','C','D','E','NONE'])assert.equal(livePrice(s,open),null,s);
});
test('after the close only a print dated today counts, and it is labelled as the last price',()=>{
  clearQuotes();setQuotes({T:q({pt:sec(Date.parse('2026-11-19T10:00:00Z')),live:false}),Y:q({pt:sec(Date.parse('2026-11-18T10:00:00Z')),live:false})});
  assert.equal(livePrice('T',after).basis,'today');assert.match(liveLabel(livePrice('T',after)),/^Last price today · /);
  assert.equal(livePrice('Y',after),null);
});
test('on a weekend the published close is kept',()=>{clearQuotes();setQuotes({W:q({pt:sec(sat-60000)})});assert.equal(livePrice('W',sat),null);});

test('the list pill says prices are live and the rest is the published close',()=>{
  clearQuotes();setQuotes({A:q(),B:q({pt:sec(open-120000)})});
  const ls=['A','B'].map(x=>livePrice(x,open));assert.match(liveListLabel(ls),/^Prices live · \d\d:\d\d IST · scores and fundamentals: published close$/);
  clearQuotes();setQuotes({T:q({pt:sec(Date.parse('2026-11-19T10:00:00Z')),live:false})});
  assert.match(liveListLabel([livePrice('T',after)]),/^Prices last traded today · /);
});
