/** A short physical tap where the device allows one. Android: the Vibration API. iPhone Safari (17.4+): a hidden switch control produces the
 *  system's own light tap when it is toggled from a tap handler; there is no other web route. Nowhere is it promised: no support, no tap. */
export type Kind = 'tap' | 'select' | 'success' | 'error';
/** What this device can actually do. Tested, not assumed: the Vibration API where it exists (Android), the system's own tap through a switch control on
 *  iPhone Safari 17.4 and later when the browser reports it renders that control, and nothing anywhere else. */
export type Support = 'vibrate' | 'ios-switch' | 'none';
export interface Env { vibrate: boolean; ua: string; switchAppearance: boolean }
export function detect(env: Env): Support {
  if (env.vibrate) return 'vibrate';
  const m = /(iPhone|iPad).*OS (\d+)[_.](\d+)/.exec(env.ua);
  if (m && (+m[2] > 17 || (+m[2] === 17 && +m[3] >= 4)) && env.switchAppearance) return 'ios-switch';
  return 'none';
}
let cached: Support | null = null;
export function support(): Support {
  if (cached) return cached;
  try { cached = detect({ vibrate: typeof navigator.vibrate === 'function', ua: navigator.userAgent, switchAppearance: typeof CSS !== 'undefined' && (CSS.supports('appearance', 'switch') || CSS.supports('-webkit-appearance', 'switch')) }); } catch { cached = 'none'; }
  return cached;
}
let enabled = true; let sw: HTMLLabelElement | null = null;
export const setHaptics = (on: boolean) => { enabled = on; };
const PATTERN: Record<Kind, number | number[]> = { tap: 8, select: 6, success: [10, 40, 14], error: [30, 50, 30] };
function ios(times: number, gap: number) {
  try {
    if (!sw) {
      sw = document.createElement('label'); sw.setAttribute('aria-hidden', 'true'); sw.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
      const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1; sw.appendChild(i); document.body.appendChild(sw);
    }
    for (let n = 0; n < times; n++) window.setTimeout(() => sw?.click(), n * gap);
  } catch { /* no tap */ }
}
export function haptic(kind: Kind = 'tap') {
  if (!enabled) return;
  try {
    const s = support(); if (s === 'none') return;
    if (s === 'vibrate') { navigator.vibrate(PATTERN[kind]); return; }
    if (kind === 'success') ios(2, 70); else if (kind === 'error') ios(3, 60); else ios(1, 0);
  } catch { /* no tap */ }
}
/** Which feedback a message deserves, from its own words. */
export const kindOf = (m: string): Kind => (/\b(cannot|can't|could not|couldn't|not available|unavailable|failed|refus|too large|already|invalid|error)\b/i.test(m) ? 'error' : 'success');
