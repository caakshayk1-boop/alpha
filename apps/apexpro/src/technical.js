import {finite,number as num,escape as esc} from './model.js';
import {movingAverage} from './research.js';
export const intervals={daily:'Daily',weekly:'Weekly',monthly:'Monthly'};
export function wilderRSI(closes,period=14){
 const result=closes.map(()=>null);let gain=0,loss=0,count=0,previous=null;
 for(let i=0;i<closes.length;i++){
  const c=closes[i];if(!finite(c)||c<=0){gain=loss=count=0;previous=null;continue;}
  if(previous===null){previous=c;continue;}const delta=c-previous;previous=c;
  if(count<period){gain+=Math.max(delta,0);loss+=Math.max(-delta,0);count++;if(count<period)continue;gain/=period;loss/=period;}
  else{gain=(gain*(period-1)+Math.max(delta,0))/period;loss=(loss*(period-1)+Math.max(-delta,0))/period;}
  result[i]=loss===0?(gain===0?50:100):100-100/(1+gain/loss);
 }return result;
}
function bucket(t,interval){const d=new Date((t+19800)*1000);if(interval==='monthly')return d.toISOString().slice(0,7);if(interval==='weekly'){d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}return d.toISOString().slice(0,10);}
export function aggregate(data,interval='daily',paired=false){
 const rows=(data?.t||[]).map((t,i)=>({t,c:data.c?.[i],o:data.o?.[i],h:data.h?.[i],l:data.l?.[i],v:data.v?.[i],n:data.n?.[i]})).filter(p=>finite(p.t)&&finite(p.c)&&p.c>0&&(!paired||(finite(p.n)&&p.n>0))).sort((a,b)=>a.t-b.t);
 const unique=[...new Map(rows.map(r=>[r.t,r])).values()];
 if(interval==='daily')return unique;
 const groups=new Map();for(const r of unique){const key=bucket(r.t,interval);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 return [...groups.values()].map(a=>({t:a.at(-1).t,start:a[0].t,o:finite(a[0].o)?a[0].o:null,h:a.every(p=>finite(p.h))?Math.max(...a.map(p=>p.h)):null,l:a.every(p=>finite(p.l))?Math.min(...a.map(p=>p.l)):null,c:a.at(-1).c,v:a.every(p=>finite(p.v)&&p.v>=0)?a.reduce((s,p)=>s+p.v,0):null,n:a.at(-1).n,sessions:a.length}));
}
// Regular divergence on strict closing-price pivots. Two bars on each side;
// the latest bucket is excluded so it cannot confirm a still-forming pivot.
export function divergences(points){
 const out=[],previous={low:null,high:null},end=points.length-1;
 for(let i=2;i<end-2;i++){
  const p=points[i];if(!finite(p.rsi))continue;
  for(const kind of ['low','high']){
   const neighbours=[points[i-2],points[i-1],points[i+1],points[i+2]];
   if(!neighbours.every(x=>kind==='low'?p.c<x.c:p.c>x.c))continue;
   const before=previous[kind];previous[kind]=i;
   if(before===null||i-before<5||i-before>60)continue;const q=points[before];
   if(kind==='low'?p.c<q.c&&p.rsi>q.rsi:p.c>q.c&&p.rsi<q.rsi)out.push({kind:kind==='low'?'bullish':'bearish',from:before,to:i,confirmed:i+2,t:p.t,confirmedAt:points[i+2].t});
  }
 }return out;
}
export function technicalSeries(data,{interval='daily',range=126,rsiPeriod=14,benchmark=false}={}){
 const full=aggregate(data,interval,benchmark),rsi=wilderRSI(full.map(p=>p.c),rsiPeriod),ma20=movingAverage(full.map(p=>p.c),20),ma50=movingAverage(full.map(p=>p.c),50);
 const all=full.map((p,i)=>({...p,rsi:rsi[i],ma20:ma20[i],ma50:ma50[i]})),daily=aggregate(data,'daily',benchmark),cutoff=daily.slice(-range)[0]?.t??Infinity;
 const start=all.findIndex(p=>p.t>=cutoff),visible=start<0?[]:all.slice(start),events=divergences(all).filter(e=>e.from>=start&&e.to>=start).map(e=>({...e,from:e.from-start,to:e.to-start,confirmed:e.confirmed-start}));
 const first=visible[0];return {points:visible.map(p=>({...p,y:benchmark?p.c/first.c*100:p.c,...(benchmark?{benchmark:p.n/first.n*100}:{})})),events,all};
}
export function divergenceContext(data,options){
 if(!data?.t)return '<div class="divergence-context"><span class="eyebrow">MOMENTUM / RSI</span><p>Loading history for divergence analysis…</p></div>';
 const result=technicalSeries(data,{...options,range:50000,benchmark:false}),events=divergences(result.all),last=events.at(-1),recent=last&&result.all.length-1-last.confirmed<=10,latest=result.all.at(-1)?.rsi;
 const date=t=>new Date(t*1000).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'});
 return `<div class="divergence-context"><div class="eyebrow">${intervals[options.interval]||'Daily'} MOMENTUM / RSI ${options.rsiPeriod||14}</div><strong class="${recent?last.kind:''}">${recent?`${last.kind==='bullish'?'Bullish':'Bearish'} RSI divergence`:finite(latest)?'No recent confirmed divergence':'Insufficient RSI history'}</strong><p>${finite(latest)?`Latest RSI ${num(latest)}. `:''}${recent?`Confirmed ${esc(date(last.confirmedAt))}; pivot ${esc(date(last.t))}.`:last?`Last detected pattern confirmed ${esc(date(last.confirmedAt))}, over 10 bars ago.`:'Regular divergence requires two confirmed closing-price pivots.'}</p><small>2 bars on each side · 5–60 bars between pivots · Latest bucket excluded from confirmation. A pattern is not a reversal prediction.</small></div>`;
}
export function divergenceBadge(data,options){
 if(!data?.t)return '';
 const result=technicalSeries(data,{...options,range:50000,benchmark:false}),event=divergences(result.all).at(-1),recent=event&&result.all.length-1-event.confirmed<=10,latest=result.all.at(-1)?.rsi;
 return `<span class="pill divergence-badge ${recent?event.kind:''}">${intervals[options.interval]||'Daily'} RSI ${options.rsiPeriod||14}: ${finite(latest)?num(latest):'unavailable'}${recent?' · '+(event.kind==='bullish'?'Bullish':'Bearish')+' divergence':''}</span>`;
}
