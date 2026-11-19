// Numbers that changed since the visitor's last visit get a restrained halo (500 ms), once, then rest. CSS animation; skipped under reduced motion.
const KEY = 'rb-seen-v1'; let seen: Record<string, string> = {}; try { seen = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { seen = {}; }
const next = { ...seen }; const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
for (const el of document.querySelectorAll<HTMLElement>('[data-track]')) { const k = el.dataset.track!, v = (el.textContent || '').trim(); next[k] = v; if (k in seen && seen[k] !== v && !reduce) { el.classList.add('halo-flash'); setTimeout(() => el.classList.remove('halo-flash'), 600); } }
try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: no halo next time, nothing breaks */ }
