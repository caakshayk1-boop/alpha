import {finite,number as num,money,percent as pct,escape as esc} from './model.js';
export const scanModes={pullback:{name:'Pullbacks',rule:'Close above the 200-day average and 5–20% below the 52-week high.'},volume:{name:'Volume expansion',rule:'Published volume is at least 2× its source average.'},high:{name:'Near yearly highs',rule:'Published close is within 3% below the 52-week high.'}};
export function scan(rows,mode='pullback') {
 const positive=v=>finite(v)&&v>0;
 return rows.filter(r=>{
  if(mode==='volume')return finite(r.vol_spike)&&r.vol_spike>=2;
  if(!positive(r.price)||!positive(r.high52)||r.price>r.high52)return false;
  return mode==='high'?r.price>=r.high52*.97:mode==='pullback'&&positive(r.sma200)&&r.price>r.sma200&&r.price<=r.high52*.95&&r.price>=r.high52*.8;
 }).sort((a,b)=>mode==='volume'?b.vol_spike-a.vol_spike:mode==='high'?b.price/b.high52-a.price/a.high52:a.price/a.high52-b.price/b.high52);
}
export function scanner(rows,mode,stamp){
 const results=scan(rows,mode),info=scanModes[mode];
 return `<section class="panel signal-scanner"><div class="panel-heading"><div><div class="eyebrow">[ 01 ] / SIGNAL DISCOVERY</div><h2>Patterns worth investigating</h2></div><span class="scanner-count">${results.length}<small>matches</small></span></div><div class="scanner-tabs" aria-label="Signal pattern">${Object.entries(scanModes).map(([key,m])=>`<button data-action="scan-mode" data-value="${key}" aria-pressed="${mode===key}" class="${mode===key?'active':''}">${m.name}</button>`).join('')}</div><p class="panel-subtitle">${info.rule} Research filters, not entry signals.</p><div class="signal-list">${results.slice(0,6).map((r,i)=>`<a href="#/company/${encodeURIComponent(r.sym)}"><span class="signal-rank">${String(i+1).padStart(2,'0')}</span><div><b>${esc(r.sym)}</b><small>${esc(r.name)}</small></div><span class="row-spark" data-spark="${esc(r.sym)}">History loading…</span><div class="signal-number"><strong>${mode==='volume'?num(r.vol_spike,1)+'×':pct((r.price/r.high52-1)*100)}</strong><small>${mode==='volume'?'volume / average':'from 52-week high'}</small></div></a>`).join('')||'<div class="signal-empty">No matches in this published snapshot. Try another pattern.</div>'}</div><div class="panel-foot">Showing ${Math.min(6,results.length)} of ${results.length} · ${esc(stamp)} · No generated forecasts</div></section>`;
}
export function conditionState(c,row){
 if(!row||!finite(row.price)||row.price<=0||!row.last_date)return 'Unavailable';
 return (c.direction==='above'?row.price>=c.target:row.price<=c.target)?'Met in snapshot':'Waiting';
}
export function conditionForm(row,conditions){
 const c=conditions[row.sym];
 return `<section class="panel condition-builder"><div><div class="eyebrow">[ 02 ] / YOUR NEXT CHECKPOINT</div><h2>Watch a price condition</h2><p>Choose the published close you want to revisit. Checked on open or refresh; no background notifications or orders.</p></div><form id="condition-form" data-symbol="${esc(row.sym)}"><label>When the close is<select name="direction"><option value="above" ${c?.direction==='above'?'selected':''}>At or above</option><option value="below" ${c?.direction==='below'?'selected':''}>At or below</option></select></label><label>Price in ₹<input name="target" type="number" min="0.01" max="1000000000" step="0.01" required value="${c?.target??(finite(row.price)&&row.price>0?row.price.toFixed(2):'')}" placeholder="Enter a price"></label><button class="button" type="submit">Save condition</button></form>${c?`<div class="condition-saved"><span>${esc(conditionState(c,row))} · ${money(c.target)} · Close ${esc(row.last_date||'unavailable')}</span><button class="text-button" data-action="condition-remove" data-symbol="${esc(row.sym)}">Remove condition</button></div>`:''}</section>`;
}
export function conditionQueue(rows,conditions){
 const entries=Object.entries(conditions).map(([sym,c])=>({sym,c,row:rows.find(r=>r.sym===sym)}));
 return `<section class="panel condition-queue"><div class="panel-heading"><div><div class="eyebrow">[ 03 ] / SAVED CONDITIONS</div><h2>Your research checkpoints</h2></div><span class="pill">${entries.length} saved</span></div><p class="panel-subtitle">Evaluated against published closes, including cached data when offline. Met does not imply an intraday crossing.</p><div class="checkpoint-list">${entries.map(({sym,c,row})=>{const status=conditionState(c,row);return `<div class="checkpoint"><a href="#/company/${encodeURIComponent(sym)}"><b>${esc(sym)}</b><small>Close ${c.direction==='above'?'≥':'≤'} ${money(c.target)}</small></a><div><span class="checkpoint-state ${status==='Met in snapshot'?'met':''}">${status}</span><small>${money(row?.price)} · ${esc(row?.last_date||'date unavailable')}</small></div><button class="icon-button" data-action="condition-remove" data-symbol="${esc(sym)}" aria-label="Remove ${esc(sym)} condition"><svg class="icon" aria-hidden="true"><use href="/icons.svg#x"/></svg></button></div>`;}).join('')||'<div class="signal-empty">Open a company to set a price condition. Your checkpoints will appear here.</div>'}</div><div class="panel-foot">Conditions are included in My Desk backups. Stored locally; checked while the app is open.</div></section>`;
}
export function effectsSettings(enabled){return `<section class="panel settings-panel studio-settings"><div class="eyebrow">STUDIO / ATMOSPHERE</div><h2>A little more depth.</h2><p>Ambient light, illuminated borders and responsive highlights across the workspace.</p><div class="setting-row"><div><h3>Studio glow</h3><p>Turn off decorative light effects for a quieter workspace. Reduced motion is respected independently.</p></div><button role="switch" aria-checked="${enabled}" aria-label="Studio glow" class="switch" data-action="studio-glow"><span></span></button></div></section>`;}
export function bindStudio(noMotion){
 let pending=0,card=null,x=0,y=0;
 document.addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse'||document.documentElement.dataset.glow==='off'||noMotion())return;
  const target=event.target.closest('.panel,.market-card');if(!target)return;
  card=target;x=event.clientX;y=event.clientY;
  if(!pending)pending=requestAnimationFrame(()=>{pending=0;if(!card?.isConnected)return;const r=card.getBoundingClientRect();card.style.setProperty('--pointer-x',`${x-r.left}px`);card.style.setProperty('--pointer-y',`${y-r.top}px`);});
 },{passive:true});
}
