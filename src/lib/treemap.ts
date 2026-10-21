export interface Rect { x: number; y: number; w: number; h: number }
export interface Item<T> { value: number; data: T }
export interface Placed<T> extends Rect { data: T; value: number }

/** Squarified treemap (Bruls, Huizing, van Wijk 2000). Items must have value > 0. */
export function squarify<T>(items: Item<T>[], box: Rect): Placed<T>[] {
  const list = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = list.reduce((s, i) => s + i.value, 0);
  const out: Placed<T>[] = [];
  if (!list.length || box.w <= 0 || box.h <= 0) return out;
  const scale = (box.w * box.h) / total;
  let { x, y, w, h } = box;
  let row: Item<T>[] = [];

  const worst = (r: Item<T>[], side: number) => {
    const s = r.reduce((t, i) => t + i.value * scale, 0);
    const max = Math.max(...r.map((i) => i.value * scale));
    const min = Math.min(...r.map((i) => i.value * scale));
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };
  const place = (r: Item<T>[]) => {
    const s = r.reduce((t, i) => t + i.value * scale, 0);
    if (w >= h) {
      const rw = s / h;
      let cy = y;
      for (const i of r) { const ih = (i.value * scale) / rw; out.push({ x, y: cy, w: rw, h: ih, data: i.data, value: i.value }); cy += ih; }
      x += rw; w -= rw;
    } else {
      const rh = s / w;
      let cx = x;
      for (const i of r) { const iw = (i.value * scale) / rh; out.push({ x: cx, y, w: iw, h: rh, data: i.data, value: i.value }); cx += iw; }
      y += rh; h -= rh;
    }
  };

  for (const item of list) {
    const side = Math.min(w, h);
    if (row.length === 0 || worst([...row, item], side) <= worst(row, side)) row.push(item);
    else { place(row); row = [item]; }
  }
  if (row.length) place(row);
  return out;
}

/** A label on every tile that can hold one. The font follows the tile (15px down to 7.5px; bold caps run up to about 0.68em a
 *  character); when even 7.5px cannot fit the whole symbol, the first letters that fit are shown (at least three), so a small
 *  tile still says which stock it is. Slivers under 14x10px stay blank: the tooltip and the list under the map name them. */
export function labelFor(w: number, h: number, sym: string): { font: number; text: string } {
  const CH = 0.68, MIN = 7.5;
  if (w < 14 || h < 10) return { font: 0, text: '' };
  const byHeight = (h - 3) * 0.6;
  const full = Math.min(15, (w - 4) / (Math.max(sym.length, 3) * CH), byHeight);
  if (full >= MIN) return { font: full, text: sym };
  const font = Math.min(MIN, byHeight);
  if (font < 6.5) return { font: 0, text: '' };
  const fits = Math.floor((w - 3) / (font * CH));
  return fits >= 3 ? { font, text: sym.slice(0, fits) } : { font: 0, text: '' };
}
