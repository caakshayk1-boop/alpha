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
export function bars(vals: (number | null)[], labels: string[], title: string, w = 420, h = 130): string {
  const real = vals.filter((v): v is number => v != null); const top = Math.max(1, ...real.map(Math.abs)); const bw = w / vals.length; let o = '';
  vals.forEach((v, i) => { const x = i * bw + bw * 0.2, ww = bw * 0.6; if (v != null) { const bh = Math.max(1, (Math.abs(v) / top) * (h - 30)); o += `<rect class="${v >= 0 ? 'bar' : 'down'}" x="${x}" y="${h - 16 - bh}" width="${ww}" height="${bh}" rx="2"><title>${esc(labels[i])}: ${v}</title></rect>`; } else o += `<text x="${x + ww / 2}" y="${h - 22}" text-anchor="middle" class="svg-t gap">—</text>`; o += `<text x="${i * bw + bw / 2}" y="${h - 2}" text-anchor="middle" class="svg-t">${esc(labels[i])}</text>`; });
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}" class="svg">${o}</svg>`;
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
