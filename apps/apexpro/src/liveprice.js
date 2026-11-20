import {printBasis,istTime} from './heatlive.js';
import {finite} from './model.js';
/* 20 Nov 2026: the same rules now also cover the time the session is shut (before the open, a weekend): a print dated the newest closed session is offered as 'close'. See printBasis in heatlive.js. */
/* 19 Nov 2026: live prices for the pages that show one price per company. The nightly screen carries the previous close; this holds the newest
 * quote the Worker returned for a name and offers it only when it is trustworthy: during the session the print must be flagged live and at most
 * five minutes old; after the close it must be dated today (IST). Anything else, or no quote, leaves the published close on the page. */
const store={};
export const setQuotes=q=>{for(const [s,v] of Object.entries(q||{}))if(v&&typeof v==='object')store[s]=v;};
export function livePrice(sym,now=Date.now()){
  const q=store[sym],basis=printBasis(q,now);
  return basis?{px:q.px,chg:(q.px/q.prev-1)*100,pt:q.pt,basis}:null;
}
const dm=iso=>new Date(iso+'T00:00:00Z').toLocaleDateString('en-GB',{timeZone:'UTC',day:'numeric',month:'short'});
export const liveLabel=l=>l.basis==='close'?'Last close · '+dm(new Date(l.pt*1000+19800000).toISOString().slice(0,10))+' · '+istTime(l.pt):(l.basis==='today'?'Last price today · ':'Live price · ')+istTime(l.pt);
export const clearQuotes=()=>{for(const k of Object.keys(store))delete store[k];};
/** The pill on a list of companies when some prices on it are live: says so, and says the rest (scores, returns beyond the day, fundamentals) is still the published close. */
export const liveListLabel=ls=>{const t=Math.max(...ls.map(l=>l.pt));return `Prices ${ls.every(l=>l.basis==='close')?'at the last close':ls.every(l=>l.basis==='today')?'last traded today':'live'} · ${istTime(t)} · scores and fundamentals: published close`;};
