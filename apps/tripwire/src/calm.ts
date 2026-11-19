import { useEffect, useState } from 'react';
type Conn = { saveData?: boolean; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void };
const conn = (): Conn | undefined => (navigator as unknown as { connection?: Conn }).connection;
export const wantsCalm = (): boolean => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches || !!conn()?.saveData; } catch { return false; } };
/** True while the device asks for reduced motion or Data Saver. Read live: turning either on mid-session changes the answer at once (the films used to read it once, at mount). */
export function useCalm(): boolean {
  const [calm, setCalm] = useState(wantsCalm);
  useEffect(() => {
    const upd = () => setCalm(wantsCalm()); let mq: MediaQueryList | null = null;
    try { mq = matchMedia('(prefers-reduced-motion: reduce)'); mq.addEventListener?.('change', upd); } catch { /* no matchMedia: the first read stands */ }
    const c = conn(); c?.addEventListener?.('change', upd);
    return () => { mq?.removeEventListener?.('change', upd); c?.removeEventListener?.('change', upd); };
  }, []);
  return calm;
}
