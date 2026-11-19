// Shortlist filter: entered / exited / still-in reflow with GSAP Flip. Without JS everything stays visible.
import { gsap } from 'gsap'; import { Flip } from 'gsap/Flip'; gsap.registerPlugin(Flip);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
for (const root of document.querySelectorAll<HTMLElement>('[data-shortlist]')) {
  const items = [...root.querySelectorAll<HTMLElement>('[data-state]')], btns = [...root.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  for (const b of btns) b.addEventListener('click', () => {
    const f = b.dataset.filter!; const st = reduce ? null : Flip.getState(items);
    for (const i of items) i.hidden = f !== 'all' && i.dataset.state !== f; for (const x of btns) x.setAttribute('aria-pressed', String(x === b));
    if (st) Flip.from(st, { duration: 0.32, ease: 'power2.inOut', absolute: false, onEnter: (e) => gsap.fromTo(e, { opacity: 0 }, { opacity: 1, duration: 0.2 }) });
  });
}
