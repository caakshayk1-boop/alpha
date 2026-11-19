import { edition, editionDays } from '../src/edition.ts';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Vision phase 2 (19 Nov 2026): one crawlable HTML page per recorded ledger night, /edition/ (the latest) and /edition/YYYY-MM-DD/.
 *  Everything is read from the ledger the build already holds, through the same pure `edition()` the app uses; a figure the ledger lacks is not printed.
 *  The gate state comes from the published signals file when it carries that day, and says "not published" otherwise (never "off"). Returns the paths written, newest first. */
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function editionPages(dist, ledger, nav) {
  const days = editionDays(ledger); if (days.length === 0) return [];
  let history; const sig = join(dist, 'data/signals.json');
  if (existsSync(sig)) { try { history = JSON.parse(readFileSync(sig, 'utf8')).gate_history; } catch { history = undefined; } }
  const word = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const written = [];
  for (const day of days) {
    const e = edition(ledger, day, history); if (!e) continue;
    const sat = e.engines.reduce((n, x) => n + x.passedNotPicked, 0), wide = e.engines.reduce((n, x) => n + x.skippedWideStop, 0);
    const title = `Tripwire daily edition, ${word(day)}`;
    const lead = `${e.picks.length} paper ${e.picks.length === 1 ? 'pick' : 'picks'} recorded, ${sat} rule ${sat === 1 ? 'pass' : 'passes'} not picked, ${wide} skipped for a stop too wide. Simulated paper research, not investment advice.`;
    const rows = e.engines.map((x) => `<tr><th scope="row">${esc(x.engine)}</th><td>${x.eligible}</td><td>${x.passed}</td><td>${x.picked}</td><td>${x.skippedWideStop}</td></tr>`).join('');
    const picks = e.picks.length ? `<ul>${e.picks.map((p) => `<li><b>${esc(p.sym)}</b> ${esc(p.engine)}, stop ${esc(p.stop)}</li>`).join('')}</ul>` : '<p>No pick was recorded on this night.</p>';
    const voided = e.voided.length ? `<h2>Corrected, not deleted</h2>${e.voided.map((v) => `<p><b>${esc(v.id.split('|').slice(1).join(' · '))}</b>: ${esc(v.reason)}</p>`).join('')}` : '';
    const gate = e.gate == null ? 'The published gate history has no entry for this night (shown as missing, not as off).' : `The swing gate was ${e.gate ? 'on' : 'off'} on this night.`;
    const links = `${e.prev ? `<a href="/edition/${e.prev}/">← ${word(e.prev)}</a>` : ''}${e.next ? `<a href="/edition/${e.next}/">${word(e.next)} →</a>` : ''}`;
    const html = (canonical) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(lead)}"><link rel="canonical" href="https://tripwire.askakshay.com/edition/${canonical}"><link rel="stylesheet" href="/public-pages.css"></head><body><main><a href="/">Tripwire</a><p class="k">Edition ${e.position} of ${e.of} · data through ${esc(word(day))}</p><h1>${esc(word(day))}: ${esc(lead.split('. ')[0])}.</h1><p>Recorded ${esc(e.recorded.slice(0, 16).replace('T', ' '))} UTC${e.rules ? ` under rule set ${esc(e.rules)}` : '; rule set not recorded for this night'}. The record is append-only: this page is rebuilt from the ledger and never edited.</p><h2>The gate</h2><p>${esc(gate)}</p><h2>Passed is not picked</h2><table><thead><tr><th scope="col">Engine</th><th scope="col">Eligible</th><th scope="col">Passed</th><th scope="col">Picked</th><th scope="col">Wide stop, skipped</th></tr></thead><tbody>${rows}</tbody></table><h2>What was recorded</h2>${picks}${voided}<nav aria-label="Other editions">${links}<a href="/#/edition?d=${day}">Open this night in the app</a></nav>${nav}</main></body></html>`;
    mkdirSync(join(dist, 'edition', day), { recursive: true }); writeFileSync(join(dist, 'edition', day, 'index.html'), html(`${day}/`)); written.push(`edition/${day}/`);
    if (day === days[0]) writeFileSync(join(dist, 'edition', 'index.html'), html(''));
  }
  return ['edition/', ...written];
}
