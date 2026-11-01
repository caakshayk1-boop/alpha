// The email-capture module's configuration and logic. Pure (no React, no network at import), so it is unit-tested.
//
// OFF by default. To turn it on the owner supplies ONE value: the Beehiiv subscribe endpoint askakshay.com already uses
// (an https URL that accepts a POST of JSON {"email": "...", "source": "tripwire-today" | "tripwire-methodology"}).
// Put it in CAPTURE_ENDPOINT and set CAPTURE_ENABLED to true, then rebuild. Until both are set the module draws nothing visible and makes no network call.
// The page's Content-Security-Policy `connect-src` must also allow that host (static/_headers); that is the second half of the same one-value change.
export const CAPTURE_ENABLED = false;
export const CAPTURE_ENDPOINT = '';

export interface CaptureConfig { enabled: boolean; endpoint: string }
export const DEFAULT_CAPTURE: CaptureConfig = { enabled: CAPTURE_ENABLED, endpoint: CAPTURE_ENDPOINT };

/** The module is live only when the flag is on AND the endpoint is a well-formed https URL. A flag with no endpoint stays off: it never posts to nowhere. */
export function captureReady(c: CaptureConfig = DEFAULT_CAPTURE): boolean {
  if (!c.enabled || !c.endpoint) return false;
  try { return new URL(c.endpoint).protocol === 'https:'; } catch { return false; }
}
export const validEmail = (v: string) => v.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export type CaptureResult = { ok: true } | { ok: false; why: 'off' | 'invalid' | 'failed' };
/** Posts one address, only when the person pressed the button. Never called on load, never retried by itself. */
export async function subscribe(email: string, source: string, cfg: CaptureConfig = DEFAULT_CAPTURE, post: typeof fetch = fetch): Promise<CaptureResult> {
  if (!captureReady(cfg)) return { ok: false, why: 'off' };
  if (!validEmail(email)) return { ok: false, why: 'invalid' };
  try {
    const r = await post(cfg.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.trim(), source }) });
    return r.ok ? { ok: true } : { ok: false, why: 'failed' };
  } catch { return { ok: false, why: 'failed' }; }
}
export const CAPTURE_LINE = 'One email a week. The rules that fired, the evidence, the record.';
export const IDENTITY_LINKS = [{ label: 'askakshay.com', href: 'https://askakshay.com' }] as const;
