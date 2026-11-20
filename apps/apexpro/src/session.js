import {finite,number as num,percent as pct,escape as esc} from './model.js';
export const indexNames={NIFTY:'Nifty 50',BANKNIFTY:'Nifty Bank',VIX:'India VIX'};
export const quoteChange=q=>finite(q?.px)&&finite(q?.prev)&&q.prev>0?(q.px/q.prev-1)*100:null;
export function quoteTime(t){return finite(t)?new Date(t*1000).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})+' IST':'Time unavailable';}
export function sessionStatus(quotes,now=Date.now()){
 const d=new Date(now+19800000),minutes=d.getUTCHours()*60+d.getUTCMinutes(),regular=d.getUTCDay()>0&&d.getUTCDay()<6&&minutes>=555&&minutes<930;
 const measured=Object.values(quotes||{}).filter(q=>finite(q?.px)&&q.px>0),recent=measured.length>0&&measured.every(q=>q.live===true&&finite(q.pt)&&now-q.pt*1000>=0&&now-q.pt*1000<=180000);
 return recent?'Recent index quotes':!regular?'Outside regular NSE hours':'Awaiting fresh index quotes';
}
export function marketSummary(market,previous){
 const q=market?.quotes||{},n=quoteChange(q.NIFTY),b=quoteChange(q.BANKNIFTY),v=quoteChange(q.VIX);
 const day=t=>finite(t)&&t>0?new Date((t+19800)*1000).toISOString().slice(0,10):null;
 const aligned=day(q.NIFTY?.pt)!==null&&day(q.NIFTY?.pt)===day(q.BANKNIFTY?.pt);
 const headline=finite(n)&&finite(b)?!aligned?'Index snapshots have different dates.':n<0&&b<0?'Both tracked indices lower.':n>0&&b>0?'Both tracked indices higher.':'Indices are moving differently.':'Waiting for index data.';
 const spread=aligned&&finite(n)&&finite(b)?b-n:null,old=previous?.quotes?.NIFTY;
 const delta=finite(old?.px)&&finite(q.NIFTY?.px)&&q.NIFTY.pt>=old.pt?q.NIFTY.px-old.px:null;
 return {headline,n,b,v,spread,delta};
}
export function marketBrief(market,previous,meta={}){
 const q=market?.quotes||{},s=marketSummary(market,previous),status=meta.error?'Refresh failed · last available quotes':(meta.offline||market?._offline)?'Cached quotes · offline':sessionStatus(q),checked=meta.checked?new Date(meta.checked).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Kolkata'})+' IST':'Not checked yet';
 return `<div class="session-brief"><div class="session-top"><span class="session-state">${esc(status)}</span><span>INDEX SNAPSHOT</span></div><h2>${s.headline}</h2><div class="session-facts"><div><span>Banking vs Nifty</span><strong class="${s.spread>=0?'up':'down'}">${finite(s.spread)?(s.spread>0?'+':'')+num(s.spread,2)+' pp':'—'}</strong><small>Difference in session returns</small></div><div><span>VIX change</span><strong class="${s.v>=0?'down':'up'}">${pct(s.v)}</strong><small>${finite(s.v)?s.v>0?'Implied volatility rose':s.v<0?'Implied volatility fell':'Unchanged vs previous close':'Source unavailable'}</small></div><div><span>Nifty since last check</span><strong>${s.delta===null?'—':s.delta===0?'No change':(s.delta>0?'+':'')+num(s.delta,2)+' pts'}</strong><small>${s.delta===null?'Baseline starts with this visit':'Compared with previous fetched quote'}</small></div></div><div class="session-foot"><span>Quote: ${quoteTime(q.NIFTY?.pt)}</span><span>Checked: ${checked}</span></div></div>`;
}
export function marketHero(market,previous,meta){return `<section class="session-hero"><div class="session-intro"><div class="eyebrow">APEXPRO / MARKET DESK</div><h1 aria-label="Your market workspace">What matters<br><em>right now.</em></h1><p>One market view.<br>Fresh context, clearly dated.</p><button class="button" data-action="search">Research a company ↗</button></div><div id="market-brief">${marketBrief(market,previous,meta)}</div></section><div class="refresh-toolbar"><span>Quote feeds · <b id="refresh-state">${meta.busy?'Checking…':'Automatic checks while this page is visible'}</b></span><div><label>Refresh every <select id="market-cadence" aria-label="Quote refresh interval">${[60,120,180].map(n=>`<option value="${n}" ${meta.cadence===n?'selected':''}>${n/60} min</option>`).join('')}</select></label><button class="text-button" data-action="market-refresh">Check now ↻</button></div></div>`;}
export function indexStrip(market,index,coverage,stamp){return `${Object.entries(indexNames).map(([key,name])=>{const q=market?.quotes?.[key],change=quoteChange(q);return `<button class="market-card quote-tile ${index===key?'selected':''}" data-action="index" data-index="${key}" aria-pressed="${index===key}"><div class="market-label">${name}<span>${index===key?'Chart selected':'View chart ↗'}</span></div><div class="market-value">${num(q?.px,key==='VIX'?2:0)} <span class="change ${change>=0?'up':'down'}">${pct(change)}</span></div><small>${quoteTime(q?.pt)}</small></button>`;}).join('')}<a href="#/discover" class="market-card coverage-card"><div class="market-label">Company universe ↗</div><div class="market-value">${num(coverage,0)} <span class="pill">NSE</span></div><small>${esc(stamp)} · Daily snapshot</small></a>`;}
export function macroPanel(data,error){
 const items=[['USDINR','USD / INR','₹ per USD'],['BRENT','Brent crude','USD / barrel · futures'],['GOLD','Gold','USD / troy oz · futures'],['BTC','Bitcoin','USD']];
 return `<section class="panel global-context"><div class="panel-heading"><div><div class="eyebrow">BEYOND THE INDEX</div><h2>Global context</h2></div><span class="pill">${error?'Refresh failed':data?._offline?'Cached':'Quote feed'}</span></div><div class="macro-grid">${items.map(([key,label,unit])=>{const q=data?.quotes?.[key],change=quoteChange(q);return `<div class="macro-tile"><span>${label}</span><strong>${num(q?.px,2)}</strong><span class="${change>=0?'up':'down'}">${pct(change)}</span><small>${unit}</small><small>${quoteTime(q?.pt)}</small></div>`;}).join('')}</div><div class="panel-foot">Yahoo Finance · Different trading hours and quote delays apply.${error?' Last available values retained.':''}</div></section>`;
}
export function createQuotePoller({refresh,enabled,delay,setTimer=setTimeout,clearTimer=clearTimeout}){
 let timer=null,busy=false,stopped=false;
 function schedule(){if(!stopped)timer=setTimer(tick,delay());}
 async function tick(){timer=null;if(stopped||busy)return;if(!enabled()){schedule();return;}busy=true;try{await refresh();}finally{busy=false;schedule();}}
 return {restart(immediate=false){if(timer!==null)clearTimer(timer);timer=null;stopped=false;if(!busy){if(immediate)void tick();else schedule();}},stop(){stopped=true;if(timer!==null)clearTimer(timer);timer=null;}};
}
