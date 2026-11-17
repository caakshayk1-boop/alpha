import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch(),page=await browser.newPage({reducedMotion:'reduce'});
await page.goto(process.env.APEX_BASE || 'http://localhost:8810');
await page.getByRole('heading',{name:'Your market workspace'}).waitFor();
await page.evaluate(await readFile('node_modules/axe-core/axe.min.js','utf8'));
for(const theme of ['standard','colourblind']) {
 await page.evaluate(t=>document.documentElement.dataset.colorblind=String(t==='colourblind'),theme);
 const result=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
 assert.deepEqual(result.violations.map(x=>({id:x.id,targets:x.nodes.map(n=>n.target)})),[]);
 console.log(theme+': automated WCAG A/AA overview checks passed');
}
await browser.close();
