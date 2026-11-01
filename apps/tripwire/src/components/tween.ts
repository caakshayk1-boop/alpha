// Number tween for headline figures (P&L, R, prices): 600 ms, ease-out-expo, and ONLY when the motion layer is on (html.fx). With motion off the
// figure is the value, at once, with no frame in between. No dependency; one requestAnimationFrame loop per changing figure.
import { useEffect, useRef, useState } from 'react';

/** ease-out-expo, 0..1 -> 0..1 */
export const easeOut = (t: number): number => (t >= 1 ? 1 : t <= 0 ? 0 : 1 - Math.pow(2, -10 * t));
/** the value `t` (0..1) of the way from `from` to `to` */
export const tweenAt = (from: number, to: number, t: number): number => from + (to - from) * easeOut(t);
/** is the motion layer on right now (the in-app switch and the device setting both remove html.fx) */
export const motionOn = (): boolean => typeof document !== 'undefined' && document.documentElement.classList.contains('fx');

/** Usage: `const shown = useTween(pnl)` then print `shown`. First render shows the value at once; later changes glide when motion is on. */
export function useTween(value: number, ms = 600): number {
  const [shown, setShown] = useState(value); const from = useRef(value); const raf = useRef(0);
  useEffect(() => {
    if (!Number.isFinite(value) || !motionOn() || from.current === value) { from.current = value; setShown(value); return; }
    const a = from.current, t0 = performance.now();
    const step = (now: number) => { const t = Math.min(1, (now - t0) / ms); const v = tweenAt(a, value, t); from.current = v; setShown(v); if (t < 1) raf.current = requestAnimationFrame(step); else { from.current = value; setShown(value); } };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [value, ms]);
  return shown;
}
