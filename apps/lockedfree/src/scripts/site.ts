// Site motion in about 3 KB, no library: scroll reveal, count-up, pointer glow, magnetic buttons, card tilt, scroll progress, header shadow.
// Everything is skipped under prefers-reduced-motion; reveal states exist in CSS only where scripting is enabled, so without JS the page is simply visible.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; const $$ = <T extends HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];
// Financial figures stay at their server-rendered values, including the first frame.
const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io!.unobserve(e.target); } }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }) : null;
$$('[data-r]').forEach((e) => (io && !reduce ? io.observe(e) : e.classList.add('in')));
const top=document.querySelector('.top'),bar=document.querySelector<HTMLElement>('.progress');
let tick=false;
function measure(){tick=false;const max=document.documentElement.scrollHeight-innerHeight, y=Math.max(0,scrollY);
  const pct=max<=1||max-y<=1?100:Math.min(99,Math.floor(100*y/max));
  top?.classList.toggle('scrolled',y>8);bar?.style.setProperty('--p',String(pct/100));}
function schedule(){if(!tick){tick=true;requestAnimationFrame(measure)}}
addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);addEventListener('pageshow',schedule);new ResizeObserver(schedule).observe(document.body);schedule();
if (!reduce && matchMedia('(hover: hover)').matches) {
  const hero = document.querySelector<HTMLElement>('[data-glow]'); hero?.addEventListener('pointermove', (e) => { const r = hero.getBoundingClientRect(); hero.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`); hero.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`); });
  $$('.room').forEach((c) => c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`); }));
  $$('.btn.mag').forEach((b) => { b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${((e.clientX - r.left) / r.width - 0.5) * 8}px, ${((e.clientY - r.top) / r.height - 0.5) * 6}px)`; }); b.addEventListener('pointerleave', () => (b.style.transform = '')); });
  $$('.mock, .nowcard').forEach((m) => { m.addEventListener('pointermove', (e) => { const r = m.getBoundingClientRect(); m.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 5}deg`); m.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 4}deg`); }); m.addEventListener('pointerleave', () => { m.style.setProperty('--rx', '0deg'); m.style.setProperty('--ry', '0deg'); }); });
}
// 20 Nov 2026: installable app. The worker only provides an offline page (public/sw.js). It is registered 8 s after the page has loaded, not at once: installing it at load took the page's first
// screener-to-stock view transition away (the worker's install competed with that navigation), so it waits until the visitor has settled in.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) addEventListener('load', () => { setTimeout(() => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }, 8000); });

// Inspect charts without moving the surrounding document. Keep pinch/browser zoom and outside scrolling.
document.addEventListener('wheel', (e) => {
  if (!e.ctrlKey && !e.metaKey && e.target instanceof Element && e.target.closest('.chart:not(.chart-empty)')) e.preventDefault();
}, {passive:false});
