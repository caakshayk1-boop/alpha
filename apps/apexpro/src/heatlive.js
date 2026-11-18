/* The live view of the sector map (18 Nov 2026). The published screen is a close-to-close snapshot, so during the session the 1-day column showed yesterday. The live view reads the day's change
 * from live quotes for the MOST TRADED names of each sector and says so: a sample, never "the whole market". A name with no live print, a stale print or a bad number is left out, never read as zero.
 * The change is price against the previous close, the same definition as the 1-day column. The map's own statistic stays the sector MEDIAN, equal weight per company, so the two views compare. */
import {finite} from './model.js';
export const PER_SECTOR=6, MAX_AGE_MS=300000;
const eligible=r=>r.liquid&&!r.stale&&r.sector&&finite(r.turnover_cr)&&r.turnover_cr>0;
/* Is the regular NSE session on (Mon to Fri, 09:15 to 15:30 IST)? Holidays are not modelled here: on one, no print is fresh, so nothing is measured and the close view stays. */
export function nseRegular(now=Date.now()){const d=new Date(now+19800000),m=d.getUTCHours()*60+d.getUTCMinutes();return d.getUTCDay()>0&&d.getUTCDay()<6&&m>=555&&m<930;}
export function liveSample(rows,per=PER_SECTOR){
  const by=new Map();for(const r of rows)if(eligible(r))(by.get(r.sector)||by.set(r.sector,[]).get(r.sector)).push(r);
  return [...by.values()].flatMap(g=>g.sort((a,b)=>b.turnover_cr-a.turnover_cr||a.sym.localeCompare(b.sym)).slice(0,per).map(r=>r.sym));
}
export const chunk=(list,n)=>Array.from({length:Math.ceil(list.length/n)},(_,i)=>list.slice(i*n,(i+1)*n));
/* quotes: { SYM: {px,prev,pt,live} }. Returns the changes that count, how many were asked, and the newest print used. */
export function liveChanges(sample,quotes,now=Date.now()){
  const changes={};let obs=null;
  if(nseRegular(now))for(const sym of sample){const q=quotes?.[sym];if(!q||q.live!==true||!finite(q.px)||!finite(q.prev)||q.px<=0||q.prev<=0||!finite(q.pt)||now-q.pt*1000<0||now-q.pt*1000>MAX_AGE_MS)continue;changes[sym]=(q.px/q.prev-1)*100;if(obs===null||q.pt>obs)obs=q.pt;}
  return {changes,asked:sample.length,measured:Object.keys(changes).length,obs};
}
/* Offered only when most of the sample answered, so a few late prints do not redraw the map. */
export const liveUsable=h=>!!h&&h.asked>0&&h.measured>=Math.max(12,Math.ceil(h.asked*.6));
export const istTime=sec=>{const d=new Date(sec*1000+19800000);return String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0')+' IST';};
