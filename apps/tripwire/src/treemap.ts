/** A squarified treemap (Bruls, Huizing and van Wijk, 2000): rectangles whose areas are proportional to the values, kept as close to square as the layout allows so that labels fit.
 *  Pure: no React, no clock, so the geometry is unit-tested. Used by the sector heat map (sectors, then the names inside one sector). */
export interface TmItem { id: string; value: number }
export interface TmRect { id: string; x: number; y: number; w: number; h: number }

/** Raise every item below `minShare` of the total up to it, so a small group stays big enough to read and to tap. The caller says so in words: the area is then no longer strictly proportional. */
export function withFloor(items: TmItem[], minShare: number): TmItem[] {
  const pos = items.filter((i) => Number.isFinite(i.value) && i.value > 0); const total = pos.reduce((s, i) => s + i.value, 0);
  if (!total || minShare <= 0) return pos;
  // Raising k items to a common floor f changes the total, so f must satisfy f = minShare * (rest + k f), i.e. f = minShare * rest / (1 - k * minShare). Find the set of raised items that is consistent.
  let raised = new Set<string>();
  for (let guard = 0; guard <= pos.length; guard++) {
    const k = raised.size; const rest = pos.filter((i) => !raised.has(i.id)).reduce((s, i) => s + i.value, 0);
    if (k * minShare >= 1) return pos.map((i) => ({ ...i, value: 1 }));          // the floors alone fill the box: equal shares
    const f = (minShare * rest) / (1 - k * minShare); const next = new Set(pos.filter((i) => i.value < f - 1e-12 || raised.has(i.id)).map((i) => i.id));
    if (next.size === raised.size) return pos.map((i) => (raised.has(i.id) ? { ...i, value: f } : i));
    raised = next;
  }
  return pos;
}

export function squarify(items: TmItem[], W: number, H: number): TmRect[] {
  const pos = items.filter((i) => Number.isFinite(i.value) && i.value > 0).sort((a, b) => b.value - a.value);
  const total = pos.reduce((s, i) => s + i.value, 0);
  if (!pos.length || !(total > 0) || !(W > 0) || !(H > 0)) return [];
  const k = (W * H) / total; const nodes = pos.map((i) => ({ id: i.id, area: i.value * k }));
  const rects: TmRect[] = []; let x = 0, y = 0, w = W, h = H;
  const worst = (row: { area: number }[], side: number) => { const s = row.reduce((a, r) => a + r.area, 0); const mx = Math.max(...row.map((r) => r.area)); const mn = Math.min(...row.map((r) => r.area)); return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn)); };
  const place = (row: { id: string; area: number }[]) => {
    const s = row.reduce((a, r) => a + r.area, 0);
    if (w >= h) { const cw = s / h; let cy = y; for (const r of row) { const rh = r.area / cw; rects.push({ id: r.id, x, y: cy, w: cw, h: rh }); cy += rh; } x += cw; w -= cw; }
    else { const rh = s / w; let cx = x; for (const r of row) { const rw = r.area / rh; rects.push({ id: r.id, x: cx, y, w: rw, h: rh }); cx += rw; } y += rh; h -= rh; }
  };
  let i = 0;
  while (i < nodes.length) {
    const side = Math.min(w, h); let row = [nodes[i]]; i++;
    while (i < nodes.length) { const next = [...row, nodes[i]]; if (worst(next, side) <= worst(row, side)) { row = next; i++; } else break; }
    place(row);
  }
  return rects;
}
