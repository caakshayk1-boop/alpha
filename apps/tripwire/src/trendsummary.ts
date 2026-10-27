/** The trend split of liquid names, shared by Today (one line) and the Markets page (the full map): live from the Worker when it holds today's prices for the screen's own day, the published close otherwise. */
import { useMemo } from 'react';
import { trendOf, type Row } from './screen.ts';
import { useBreadth } from './data.ts';
import type { MapData } from './screens/TrendMap.tsx';

export function useTrendSummary(rows: Row[], day: string | null, on = true) {
  const breadth = useBreadth(on);
  const snapMap = useMemo<MapData>(() => {
    const c = { up: 0, mixed: 0, down: 0 }; const by = new Map<string, { n: number; up: number; down: number }>();
    for (const r of rows) { if (!r.liquid) continue; const t = trendOf(r).trend; if (!t) continue; c[t]++; const k = r.sector ?? 'Other'; const e = by.get(k) ?? { n: 0, up: 0, down: 0 }; e.n++; if (t === 'up') e.up++; if (t === 'down') e.down++; by.set(k, e); }
    return { n: c.up + c.mixed + c.down, ...c, sectors: [...by.entries()].filter(([, e]) => e.n >= 8).map(([k, e]) => ({ k, n: e.n, up: (e.up / e.n) * 100, down: (e.down / e.n) * 100 })).sort((a, b) => b.n - a.n) };
  }, [rows]);
  const liveMap = breadth.data && breadth.data.as_of === day && breadth.data.n > 0 ? breadth.data : null;   // a breadth built on a different screen day would not match the rest of the page
  const map: MapData = liveMap ?? snapMap;
  const pct = (v: number) => (map.n ? (v / map.n) * 100 : null);
  return { breadth, liveMap, map, upPct: pct(map.up), downPct: pct(map.down) };
}
