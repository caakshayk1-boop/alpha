// Downloads the owner's daily feed into feed/ (gitignored) and refuses a bad one. Runs before every build.
// Source: trading-dashboard/docs/{screen,screen-detail,swot,seasonality}.json. The files contain bare NaN, which is not JSON; it becomes absence (a missing value), never zero.
import { writeFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';
const BASE = process.env.FEED_BASE || 'https://raw.githubusercontent.com/caakshayk1-boop/trading-dashboard/main/docs'; const dir = join(process.cwd(), 'feed'); mkdirSync(dir, { recursive: true });
const get = async (f) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(`${BASE}/${f}.json`, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(r.status); return JSON.parse((await r.text()).replace(/\bNaN\b/g, 'null').replace(/-?\bInfinity\b/g, 'null')); } catch (e) { if (i === 2) throw new Error(`${f}: ${e.message}`); await new Promise((x) => setTimeout(x, 2000 * (i + 1))); } } };
const [screen, detail, swot, seasonality] = await Promise.all(['screen', 'screen-detail', 'swot', 'seasonality'].map(get));
const bad = []; const rows = screen.rows || [];
if (rows.length < 900) bad.push(`only ${rows.length} rows`); if (new Set(rows.map((r) => r.sym)).size !== rows.length) bad.push('duplicate symbols'); if (!screen.price_date) bad.push('no price_date');
const age = (Date.now() - Date.parse(screen.price_date)) / 864e5; if (age > 6) bad.push(`price_date ${screen.price_date} is ${age.toFixed(1)} days old`);
if (screen.is_fallback) bad.push('source says is_fallback'); if (Object.keys(detail.detail || {}).length < 900) bad.push('detail incomplete'); if (Object.keys(swot.swot || {}).length < 900) bad.push('swot incomplete');
if (bad.length) { console.error('FEED REJECTED: ' + bad.join('; ')); process.exit(1); }
// compact the row set: drop trade-ladder and verdict fields we deliberately do not publish (ADR-010)
for (const r of rows) { delete r.lad; delete r.vd; }
writeFileSync(join(dir, 'screen.json'), JSON.stringify(screen)); writeFileSync(join(dir, 'detail.json'), JSON.stringify(detail)); writeFileSync(join(dir, 'swot.json'), JSON.stringify(swot)); writeFileSync(join(dir, 'seasonality.json'), JSON.stringify(seasonality));
console.log(`feed ok: ${rows.length} stocks, price_date ${screen.price_date}, built ${screen.built_on}`);
