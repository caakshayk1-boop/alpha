import { useMemo } from 'react';
import { useScreen } from './data.ts';
import { runAll, type Q } from './quant.ts';
export function useEngines() {
  const scr = useScreen();
  const out = useMemo(() => (scr.data ? runAll(scr.data.rows as Q[], scr.data.as_of) : null), [scr.data]);
  return { scr, out };
}
