/** One celebration for the biggest moment, never more: confetti in the app's own colours (the success tap comes with the message that goes with it). Skipped (the tap and the message
 *  remain) when motion is off or the device asks for reduced motion. Each moment is remembered, so it can never repeat. */
const KEY = 'tripwire:celebrated';
const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };
export const hasCelebrated = (id: string) => read().includes(id);
export function markCelebrated(ids: string[]) { try { localStorage.setItem(KEY, JSON.stringify([...new Set([...read(), ...ids])].slice(-200))); } catch { /* private mode: it may repeat once */ } }
let done = false;       // at most one a page load
export function celebrate(): boolean {
  if (done) return false; done = true;
  if (!document.documentElement.classList.contains('fx') || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  const cv = document.createElement('canvas'); cv.className = 'confetti'; cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(cv);
  const dpr = Math.min(2, window.devicePixelRatio || 1); const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr); const g = cv.getContext('2d'); if (!g) { cv.remove(); return false; }
  const cs = getComputedStyle(document.documentElement); const pal = ['--lime', '--a2', '--a3', '--a4', '--a5', '--up'].map((v) => cs.getPropertyValue(v).trim() || '#c8f23c');
  const P = Array.from({ length: 110 }, (_, i) => ({ x: W * (0.2 + Math.random() * 0.6), y: H * 0.38, vx: (Math.random() - 0.5) * 16 * dpr, vy: -(7 + Math.random() * 12) * dpr, w: (5 + Math.random() * 6) * dpr, h: (3 + Math.random() * 5) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: pal[i % pal.length] }));
  const t0 = performance.now(); const life = 2300;
  const frame = (t: number) => {
    const k = (t - t0) / life; g.clearRect(0, 0, W, H);
    for (const p of P) { p.vy += 0.42 * dpr; p.vx *= 0.992; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.55) / 0.45); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); }
    if (k < 1) requestAnimationFrame(frame); else cv.remove();
  };
  requestAnimationFrame(frame); return true;
}
