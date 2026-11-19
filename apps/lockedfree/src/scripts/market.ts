// NSE market state in IST, shared by the terminal shell, the live quote loop and the home page. No DOM access.
import { isSession } from '../lib/calendar.ts';
export const istNow = () => new Date(Date.now() + 19800000); const pad = (n: number) => String(n).padStart(2, '0');
export function marketState(d = istNow()): { state: 'open' | 'closed'; text: string } { const iso = d.toISOString().slice(0, 10), m = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (isSession(iso) && m >= 555 && m < 930) return { state: 'open', text: 'NSE open' }; return { state: 'closed', text: isSession(iso) && m < 555 ? 'NSE opens 09:15' : 'NSE closed' }; }
