/** App lock with the phone's own unlock (Face ID, fingerprint or device passcode) through WebAuthn. It is a SCREEN lock: it stops someone
 *  casually opening the app on your phone. It does not encrypt what the browser stores, and it checks nothing on a server (there is none),
 *  so it is not security against someone who can inspect the browser. The page says so beside the switch. */
const KEY = 'tripwire:lock';
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
export const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));
export const encodeId = b64; export const decodeId = unb64;
export const lockId = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
export async function lockSupported(): Promise<boolean> {
  try { return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
}
export async function enableLock(): Promise<boolean> {
  try {
    const c = (await navigator.credentials.create({ publicKey: { challenge: rand(32), rp: { name: 'Tripwire', id: location.hostname }, user: { id: rand(16), name: 'this-device', displayName: 'This device' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000, attestation: 'none' } })) as PublicKeyCredential | null;
    if (!c) return false; localStorage.setItem(KEY, b64(new Uint8Array(c.rawId))); return true;
  } catch { return false; }
}
export async function unlock(): Promise<boolean> {
  const id = lockId(); if (!id) return true;
  try {
    const got = await navigator.credentials.get({ publicKey: { challenge: rand(32), allowCredentials: [{ type: 'public-key', id: unb64(id) }], userVerification: 'required', timeout: 60000, rpId: location.hostname } });
    return !!got;
  } catch { return false; }
}
export const disableLock = () => { try { localStorage.removeItem(KEY); } catch { /* nothing to remove */ } };
