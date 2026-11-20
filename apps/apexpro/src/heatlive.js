/* The live view of the sector map (18 Nov 2026). The published screen is a close-to-close snapshot, so during the session the 1-day column showed yesterday. The live view reads the day's change
 * from live quotes for the MOST TRADED names of each sector and says so: a sample, never "the whole market". A name with no live print, a stale print or a bad number is left out, never read as zero.
 * The change is price against the previous close, the same definition as the 1-day column. The map's own statistic stays the sector MEDIAN, equal weight per company, so the two views compare. */
import {finite} from './model.js';
export const PER_SECTOR=6, MAX_AGE_MS=300000;
const eligible=r=>r.liquid&&!r.stale&&r.sector&&finite(r.turnover_cr)&&r.turnover_cr>0;
/* Is the regular NSE session on (Mon to Fri, 09:15 to 15:30 IST)? Holidays are not modelled here: on one, no print is fresh, so nothing is measured and the close view stays. */
export function nseRegular(now=Date.now()){const d=new Date(now+19800000),m=d.getUTCHours()*60+d.getUTCMinutes();return d.getUTCDay()>0&&d.getUTCDay()<6&&m>=555&&m<930;}
/* After the close on a trading weekday (15:30 IST onwards): the session has ended, so no print is "live", but a print dated TODAY is the day's last print and is used, said to be so. A print from an
 * earlier day (a weekend, a holiday, the morning before the open) is never used: the published close stays. */
export function afterClose(now=Date.now()){const d=new Date(now+19800000),m=d.getUTCHours()*60+d.getUTCMinutes();return d.getUTCDay()>0&&d.getUTCDay()<6&&m>=930;}
const istDate=ms=>new Date(ms+19800000).toISOString().slice(0,10);
/* 20 Nov 2026: "today's basis" is the newest session that has CLOSED. Before the open (08:45 IST on a Friday) and over a weekend that is the previous weekday, so a print dated that day is the
 * latest close, not yesterday's news; the screen is built overnight and can sit one session behind it. Holidays are not modelled: on one the newest print is older than this date and is not used. */
export function lastSession(now=Date.now()){const d=new Date(now+19800000),m=d.getUTCHours()*60+d.getUTCMinutes();let t=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());const wd=()=>new Date(t).getUTCDay();if(!(wd()>0&&wd()<6&&m>=930))t-=864e5;while(wd()===0||wd()===6)t-=864e5;return new Date(t).toISOString().slice(0,10);}
/* Weekday sessions between the screen's price date and the newest closed session; 0 when the screen is current or the date is unknown. */
export function sessionsBehind(priceDate,now=Date.now()){const a=Date.parse(priceDate+'T00:00:00Z'),b=Date.parse(lastSession(now)+'T00:00:00Z');if(!Number.isFinite(a)||a>=b)return 0;let n=0;for(let t=a+864e5;t<=b;t+=864e5){const w=new Date(t).getUTCDay();if(w!==0&&w!==6)n++;}return n;}
/* How a print may be used right now: 'live' (session on, flagged live, under five minutes old), 'today' (after the close, dated today), 'close' (session shut for the day or the weekend, dated the newest closed session) or null. */
export function printBasis(q,now=Date.now()){
  if(!q||!finite(q.px)||!finite(q.prev)||q.px<=0||q.prev<=0||!finite(q.pt))return null;
  const age=now-q.pt*1000;if(age<0)return null;
  if(nseRegular(now))return q.live===true&&age<=MAX_AGE_MS?'live':null;
  if(afterClose(now))return istDate(q.pt*1000)===istDate(now)?'today':null;
  return istDate(q.pt*1000)===lastSession(now)?'close':null;
}
/* Is a quote check worth making? During the session and after the close always; otherwise only while the screen is behind the newest close. */
export const liveWindow=(priceDate,now=Date.now())=>nseRegular(now)||afterClose(now)||sessionsBehind(priceDate,now)>0;
export function liveSample(rows,per=PER_SECTOR){
  const by=new Map();for(const r of rows)if(eligible(r))(by.get(r.sector)||by.set(r.sector,[]).get(r.sector)).push(r);
  return [...by.values()].flatMap(g=>g.sort((a,b)=>b.turnover_cr-a.turnover_cr||a.sym.localeCompare(b.sym)).slice(0,per).map(r=>r.sym));
}
export const chunk=(list,n)=>Array.from({length:Math.ceil(list.length/n)},(_,i)=>list.slice(i*n,(i+1)*n));
/* quotes: { SYM: {px,prev,pt,live} }. Returns the changes that count, how many were asked, and the newest print used. */
export function liveChanges(sample,quotes,now=Date.now()){
  const changes={};let obs=null,basis=null;
  for(const sym of sample){const q=quotes?.[sym],b=printBasis(q,now);if(!b)continue;basis??=b;changes[sym]=(q.px/q.prev-1)*100;if(obs===null||q.pt>obs)obs=q.pt;}
  return {changes,asked:sample.length,measured:Object.keys(changes).length,obs,basis:basis||(nseRegular(now)?'live':afterClose(now)?'today':'close')};
}
/* Offered only when most of the sample answered, so a few late prints do not redraw the map. */
export const liveUsable=h=>!!h&&h.asked>0&&h.measured>=Math.max(12,Math.ceil(h.asked*.6));
export const istTime=sec=>{const d=new Date(sec*1000+19800000);return String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0')+' IST';};
