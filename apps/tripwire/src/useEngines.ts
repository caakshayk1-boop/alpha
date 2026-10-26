import { useMemo } from 'react';
import { useScreen } from './data.ts';
import { runAll, type Q } from './quant.ts';
const cache = new WeakMap<object, ReturnType<typeof runAll>>();     // one run per screen, shared by every screen that asks, instead of one per mount
export function useEngines() {
  const scr = useScreen();
  const out = useMemo(() => { if (!scr.data) return null; let r = cache.get(scr.data); if (!r) { r = runAll(scr.data.rows as Q[], scr.data.as_of); cache.set(scr.data, r); } return r; }, [scr.data]);
  return { scr, out };
}
