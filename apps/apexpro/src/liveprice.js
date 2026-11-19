import {nseRegular,afterClose,istTime,MAX_AGE_MS} from './heatlive.js';
import {finite} from './model.js';
/* 19 Nov 2026: live prices for the pages that show one price per company. The nightly screen carries the previous close; this holds the newest
 * quote the Worker returned for a name and offers it only when it is trustworthy: during the session the print must be flagged live and at most
 * five minutes old; after the close it must be dated today (IST). Anything else, or no quote, leaves the published close on the page. */
const store={};
export const setQuotes=q=>{for(const [s,v] of Object.entries(q||{}))if(v&&typeof v==='object')store[s]=v;};
const istDay=ms=>new Date(ms+19800000).toISOString().slice(0,10);
export function livePrice(sym,now=Date.now()){
  const q=store[sym];if(!q||!finite(q.px)||!finite(q.prev)||q.px<=0||q.prev<=0||!finite(q.pt))return null;
  const age=now-q.pt*1000;if(age<0)return null;
  const regular=nseRegular(now),today=!regular&&afterClose(now);
  if(regular){if(q.live!==true||age>MAX_AGE_MS)return null;}
  else if(today){if(istDay(q.pt*1000)!==istDay(now))return null;}
  else return null;
  return {px:q.px,chg:(q.px/q.prev-1)*100,pt:q.pt,basis:regular?'live':'today'};
}
export const liveLabel=l=>(l.basis==='today'?'Last price today · ':'Live price · ')+istTime(l.pt);
export const clearQuotes=()=>{for(const k of Object.keys(store))delete store[k];};
/** The pill on a list of companies when some prices on it are live: says so, and says the rest (scores, returns beyond the day, fundamentals) is still the published close. */
export const liveListLabel=ls=>{const t=Math.max(...ls.map(l=>l.pt));return `Prices ${ls.every(l=>l.basis==='today')?'last traded today':'live'} · ${istTime(t)} · scores and fundamentals: published close`;};
