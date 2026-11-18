// Numbers that changed since the visitor's last visit get a restrained ink halo (about 500ms), once, then rest. Skipped under reduced motion.
import { gsap } from 'gsap';
const KEY = 'rb-seen-v1'; let seen: Record<string, string> = {}; try { seen = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { seen = {}; }
const next = { ...seen }; const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
for (const el of document.querySelectorAll<HTMLElement>('[data-track]')) {
  const k = el.dataset.track!, v = (el.textContent || '').trim(); next[k] = v;
  if (k in seen && seen[k] !== v && !reduce) gsap.fromTo(el, { boxShadow: '0 0 0 6px rgba(14,94,66,0.22)' }, { boxShadow: '0 0 0 6px rgba(14,94,66,0)', duration: 0.5, ease: 'power2.out', clearProps: 'boxShadow' });
}
try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: no halo next time, nothing breaks */ }
