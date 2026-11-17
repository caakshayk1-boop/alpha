import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {webkit} from 'playwright';
import {chromium,newCtx,ohlcSeries} from './uimock.mjs';
const base=process.env.TRIPWIRE_BASE||'http://localhost:8841',out='docs/tripwire/chart-workbench';await fs.mkdir(out,{recursive:true});
for(const [engine,name] of [[chromium,'chromium'],[webkit,'webkit']]){
 const b=await engine.launch();
 for(const width of [1440,390]){const ctx=await newCtx(b,width,ohlcSeries(1600,'TCS',{nifty:true}),{reducedMotion:'reduce'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/#/c/TCS');await p.locator('.pc-plot > svg').waitFor();
 await p.locator('.c-workbench').getByRole('button',{name:'RSI',exact:true}).click();assert.equal(await p.getByRole('radio',{name:'PRICE',exact:true}).getAttribute('aria-checked'),'true');
 await p.getByLabel('RSI period',{exact:true}).selectOption('7');
 for(const fr of ['W','M','D']){await p.getByRole('radiogroup',{name:'Chart interval',exact:true}).getByRole('radio',{name:fr,exact:true}).click();assert.match(await p.locator('.chart-sub').innerText(),/RSI 7/);}
 await p.getByRole('button',{name:'Divergences',exact:true}).click();assert.match(await p.locator('.c-divergence-notes').innerText(),/confirmation comes later/);
 await p.getByRole('button',{name:'History lens',exact:true}).click();const latest=await p.locator('.c-history-lens header p').innerText();await p.getByRole('slider',{name:'Historical observation',exact:true}).focus();await p.keyboard.press('Home');assert.notEqual(await p.locator('.c-history-lens header p').innerText(),latest);
 await p.getByRole('button',{name:'Candles',exact:true}).click();assert.ok(await p.locator('.c-candles').count());
 await p.getByRole('button',{name:'History lens',exact:true}).click();await p.locator('.pc-plot').dispatchEvent('pointerleave',{pointerType:'mouse'});const headline=await p.locator('.price-workspace .cf-lead').innerText(),figure=await p.locator('.price-workspace [data-figures] .cf-chip b').first().innerText();const magnitude=x=>x.match(/([0-9]+\.[0-9]+)%/)?.[1];assert.equal(magnitude(headline),magnitude(figure),'candle summary and headline agree on the displayed window');await p.getByRole('button',{name:'History lens',exact:true}).click();await p.locator('.pc-plot').dispatchEvent('pointerleave',{pointerType:'mouse'});const candleMag=magnitude(await p.locator('.price-workspace .cf-lead').innerText());await p.getByRole('button',{name:'Candles',exact:true}).click();await p.locator('.pc-plot').dispatchEvent('pointerleave',{pointerType:'mouse'});assert.equal(magnitude(await p.locator('.price-workspace .cf-lead').innerText()),candleMag,'candle view and line view state the same return for the same window (aggregated bars must not move the start of the window)');await p.getByRole('button',{name:'Candles',exact:true}).click();
 const priceBox=await p.locator('.pc-plot').boundingBox(),rsiBox=await p.locator('.chart-sub .chart-plot').last().boundingBox();assert.ok(Math.abs(priceBox.width-rsiBox.width)<2,'price and RSI share the same time-axis width');await p.getByRole('slider',{name:'Historical observation',exact:true}).focus();await p.keyboard.press('End');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true});
 await p.evaluate(await fs.readFile('node_modules/axe-core/axe.min.js','utf8'));const a=await p.evaluate(()=>axe.run(document.querySelector('.chart.cf'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
 assert.deepEqual(errors,[]);await ctx.close();console.log(name+' '+width+': interval, RSI period, divergence, historical scrub, candles, no overflow, axe passed');}
 await b.close();
}
