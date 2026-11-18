/** Build-time SVG: numbers only, so nothing user-supplied can reach markup. Colour comes from CSS classes (.up / .down); direction is also carried by bar side and a label. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** Diverging bars around a zero line, one per label. null = a gap with the label kept (missing stays missing). */
export function divergingBars(vals: (number | null)[], labels: string[], title: string, w = 420, h = 150): string {
  const real = vals.filter((v): v is number => v != null); const m = Math.max(1, ...real.map(Math.abs)); const mid = h / 2 - 8, bw = w / vals.length; let o = '';
  vals.forEach((v, i) => { const x = i * bw + bw * 0.18, ww = bw * 0.64; if (v == null) { o += `<text x="${x + ww / 2}" y="${mid + 4}" text-anchor="middle" class="svg-t gap">—</text>`; } else { const bh = Math.max(1, (Math.abs(v) / m) * (mid - 18)); const y = v >= 0 ? mid - bh : mid; o += `<rect class="${v >= 0 ? 'up' : 'down'}" x="${x}" y="${y}" width="${ww}" height="${bh}" rx="2"><title>${esc(labels[i])}: ${v}%</title></rect>`; }
    o += `<text x="${i * bw + bw / 2}" y="${h - 2}" text-anchor="middle" class="svg-t">${esc(labels[i])}</text>`; });
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}" class="svg"><line x1="0" x2="${w}" y1="${mid}" y2="${mid}" class="svg-ax"/>${o}</svg>`;
}
/** Plain bars from zero, for revenue / profit by fiscal year (oldest first). */
export function bars(vals: (number | null)[], labels: string[], title: string, w = 420, h = 130, label?: (v: number) => string): string {
  const real = vals.filter((v): v is number => v != null); const top = Math.max(1, ...real.map(Math.abs)); const bw = w / vals.length; let o = '';
  vals.forEach((v, i) => { const x = i * bw + bw * 0.2, ww = bw * 0.6; if (v != null) { const bh = Math.max(1, (Math.abs(v) / top) * (h - 30)); o += `<rect class="${v >= 0 ? 'bar' : 'down'}" x="${x}" y="${h - 16 - bh}" width="${ww}" height="${bh}" rx="2"><title>${esc(labels[i])}: ${v}</title></rect>`; if (label) o += `<text x="${i * bw + bw / 2}" y="${h - 20 - bh}" text-anchor="middle" class="svg-t val">${esc(label(v))}</text>`; } else o += `<text x="${x + ww / 2}" y="${h - 22}" text-anchor="middle" class="svg-t gap">—</text>`; o += `<text x="${i * bw + bw / 2}" y="${h - 2}" text-anchor="middle" class="svg-t">${esc(labels[i])}</text>`; });
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}" class="svg${w <= 380 ? ' sm' : ''}">${o}</svg>`;
}
export function histogram(counts: number[], labels: string[], title: string, w = 460, h = 150): string {
  const top = Math.max(1, ...counts); const bw = w / counts.length; let o = '';
  counts.forEach((c, i) => { const bh = (c / top) * (h - 34); o += `<rect class="bar" x="${i * bw + 2}" y="${h - 18 - bh}" width="${bw - 4}" height="${bh}" rx="2"><title>${esc(labels[i])}: ${c} stocks</title></rect><text x="${i * bw + bw / 2}" y="${h - 4}" text-anchor="middle" class="svg-t">${esc(labels[i])}</text>${c ? `<text x="${i * bw + bw / 2}" y="${h - 22 - bh}" text-anchor="middle" class="svg-t n">${c}</text>` : ''}`; });
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}" class="svg">${o}</svg>`;
}
export function scatter(pts: { x: number; y: number; t: string }[], xl: string, yl: string, title: string, w = 560, h = 300): string {
  let o = `<line x1="40" x2="${w - 8}" y1="${h - 28}" y2="${h - 28}" class="svg-ax"/><line x1="40" x2="40" y1="8" y2="${h - 28}" class="svg-ax"/><text x="${w / 2}" y="${h - 6}" text-anchor="middle" class="svg-t">${esc(xl)} →</text><text x="10" y="${h / 2}" class="svg-t" transform="rotate(-90 10 ${h / 2})" text-anchor="middle">${esc(yl)} →</text>`;
  for (const p of pts) o += `<circle class="dot" cx="${(40 + (p.x / 100) * (w - 52)).toFixed(1)}" cy="${(h - 28 - (p.y / 100) * (h - 40)).toFixed(1)}" r="2.2"><title>${esc(p.t)}</title></circle>`;
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}" class="svg scatter">${o}</svg>`;
}

/** Indian compact money for chart labels: 2.67L for 2,67,021 cr, 12.3k for 12,300 cr. */
export const compactCr = (x: number) => { const a = Math.abs(x), g = x < 0 ? '−' : ''; return a >= 100000 ? `${g}${(a / 100000).toFixed(2)}L` : a >= 1000 ? `${g}${(a / 1000).toFixed(1)}k` : `${g}${Math.round(a)}`; };
/** Horizontal returns ladder: label, a bar left or right of zero, the value at the bar's end. Text is real text (readable and selectable), sized in CSS pixels. */
export function returnLadder(rows: { label: string; v: number | null }[], title: string, w = 520): string {
  const rh = 30, h = rows.length * rh + 8, lx = 62, cx = lx + (w - lx - 70) / 2, half = (w - lx - 70) / 2 - 4; const real = rows.map((r) => r.v).filter((v): v is number => v != null); const m = Math.max(1, ...real.map(Math.abs)); let o = `<line x1="${cx}" x2="${cx}" y1="2" y2="${h - 4}" class="svg-ax"/>`;
  rows.forEach((r, i) => { const y = i * rh + 4; o += `<text x="0" y="${y + 17}" class="svg-t lab">${esc(r.label)}</text>`; if (r.v == null) { o += `<text x="${cx + 8}" y="${y + 17}" class="svg-t gap">missing</text>`; return; } const bw = Math.max(2, (Math.abs(r.v) / m) * half), x = r.v >= 0 ? cx : cx - bw; o += `<rect class="${r.v >= 0 ? 'up' : 'down'}" x="${x.toFixed(1)}" y="${y + 3}" width="${bw.toFixed(1)}" height="18" rx="3"><title>${esc(r.label)}: ${r.v}%</title></rect><text x="${(r.v >= 0 ? cx + bw + 6 : cx - bw - 6).toFixed(1)}" y="${y + 17}" text-anchor="${r.v >= 0 ? 'start' : 'end'}" class="svg-t val">${r.v > 0 ? '+' : r.v < 0 ? '−' : ''}${Math.abs(r.v).toFixed(1)}%</text>`; });
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}" class="svg ladder">${o}</svg>`;
}
/** Grouped bars with value labels, oldest first. Two series side by side per period. A null stays a gap with its label. */
export function groupedBars(series: { name: string; vals: (number | null)[]; cls: string }[], labels: string[], title: string, w = 520, h = 190): string {
  const real = series.flatMap((s) => s.vals).filter((v): v is number => v != null); const top = Math.max(1, ...real.map(Math.abs)); const gw = w / labels.length, bw = Math.min(46, gw / (series.length + 0.9)); let o = '';
  labels.forEach((l, i) => { series.forEach((s, k) => { const v = s.vals[i]; const x = i * gw + (gw - bw * series.length - 4 * (series.length - 1)) / 2 + k * (bw + 4); if (v == null) { o += `<text x="${x + bw / 2}" y="${h - 32}" text-anchor="middle" class="svg-t gap">—</text>`; return; } const bh = Math.max(1, (Math.abs(v) / top) * (h - 62)); const y = h - 22 - bh; o += `<rect class="${v < 0 ? 'down' : s.cls}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" rx="3"><title>${esc(s.name)} ${esc(l)}: ${v}</title></rect><text x="${(x + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" class="svg-t val">${compactCr(v)}</text>`; }); o += `<text x="${(i * gw + gw / 2).toFixed(1)}" y="${h - 4}" text-anchor="middle" class="svg-t lab">${esc(l)}</text>`; });
  const key = series.map((s, k) => `<rect class="${s.cls}" x="${k * 120}" y="0" width="10" height="10" rx="2"/><text x="${k * 120 + 15}" y="9" class="svg-t">${esc(s.name)}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h + 18}" role="img" aria-label="${esc(title)}" class="svg grouped"><g transform="translate(0 2)">${key}</g><g transform="translate(0 18)">${o}</g></svg>`;
}
