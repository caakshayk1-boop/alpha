/** The installable half of the app: the service worker's update flow, and whether and how this device can put Tripwire on its home screen.
 *  Nothing here sends or stores anything. A new version waits until the person asks for it; it is never swapped in underneath a half-written note. */
import { useSyncExternalStore } from 'react';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export interface PwaState { updateReady: boolean; canPrompt: boolean; standalone: boolean; ios: boolean }

/** Running as an installed app (no browser chrome). iOS Safari reports it through navigator.standalone, everything else through the display-mode media query. */
export function isStandalone(): boolean {
  try { return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some((m) => matchMedia(`(display-mode: ${m})`).matches) || (navigator as Navigator & { standalone?: boolean }).standalone === true; } catch { return false; }
}
/** iPhone, iPad, and iPadOS (which reports itself as a Mac with a touch screen). Browsers there have no install prompt: the person has to use Share. */
export function isIos(): boolean {
  try { return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); } catch { return false; }
}

let waiting: ServiceWorker | null = null; let deferred: InstallEvent | null = null; let wantReload = false;
const subs = new Set<() => void>();
const compute = (): PwaState => ({ updateReady: !!waiting, canPrompt: !!deferred, standalone: isStandalone(), ios: isIos() });
let snap = compute();
const publish = () => { const n = compute(); if (n.updateReady !== snap.updateReady || n.canPrompt !== snap.canPrompt || n.standalone !== snap.standalone || n.ios !== snap.ios) { snap = n; subs.forEach((f) => f()); } };
export const usePwa = (): PwaState => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => snap, () => snap);

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallEvent; publish(); });
  window.addEventListener('appinstalled', () => { deferred = null; publish(); });
  try { matchMedia('(display-mode: standalone)').addEventListener('change', publish); } catch { /* older Safari */ }
}
/** Android and desktop Chromium only. Resolves to what the person chose; the browser decides whether the prompt may be shown again. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const d = deferred; if (!d) return 'unavailable'; deferred = null; publish();
  try { await d.prompt(); return (await d.userChoice).outcome; } catch { return 'unavailable'; }
}
/** Tapping a button takes focus off a field, so "a field has focus" alone misses someone who just typed and reached for Reload. Typing counts for a few seconds after the last key. */
const TYPING_GRACE = 10000; let typedAt = 0;
if (typeof document !== 'undefined') for (const ev of ['input', 'keydown']) document.addEventListener(ev, (e) => { const t = e.target as HTMLElement | null; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) typedAt = Date.now(); }, true);
/** True while the person is typing, has just typed, or a sheet is open: the one time a reload would cost them something. */
export function editingNow(): boolean {
  if (Date.now() - typedAt < TYPING_GRACE) return true;
  const a = document.activeElement as HTMLElement | null;
  const typing = !!a && (a.isContentEditable || a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range|file)$/i.test((a as HTMLInputElement).type)) || a.tagName === 'SELECT');
  return typing || !!document.querySelector('.sheet');
}
/** Swap the waiting worker in and reload once it has taken over. Refuses while something is being edited. */
export function applyUpdate(): 'reloading' | 'busy' | 'none' {
  if (!waiting) return 'none'; if (editingNow()) return 'busy';
  wantReload = true; waiting.postMessage({ type: 'SKIP_WAITING' }); return 'reloading';
}
function track(reg: ServiceWorkerRegistration) {
  const note = (w: ServiceWorker | null) => { if (w && navigator.serviceWorker.controller) { waiting = w; publish(); } };   // a first install has no controller: nothing is "an update" yet
  if (reg.waiting) note(reg.waiting);
  reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed') note(w); }); });
}
export function registerSw() {
  if (!('serviceWorker' in navigator) || !(location.protocol === 'https:' || location.hostname === 'localhost')) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!wantReload || reloading) return; reloading = true; location.reload(); });
  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      track(reg);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => { /* offline: nothing to check */ }); });
      (window as unknown as { __twSw?: ServiceWorkerRegistration }).__twSw = reg;
    }).catch(() => { /* the offline shell is optional */ });
  });
}
