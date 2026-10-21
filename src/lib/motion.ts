'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';

let ready = false;

export const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Motion is an enhancement: content is visible by default, and `html.anim` (which hides
 * [data-rv] until it is revealed) is only added when this tab can actually run animation.
 * A hidden tab gets no rAF, so hiding content there would leave it blank.
 */
export const canAnimate = () =>
  typeof document !== 'undefined' && document.visibilityState === 'visible' && !prefersReduced();

export function initMotion() {
  if (ready || typeof window === 'undefined') return;
  ready = true;
  gsap.registerPlugin(ScrollTrigger, Flip);
  gsap.defaults({ ease: 'power3.out', duration: 0.7 });
  if (canAnimate()) {
    document.documentElement.classList.add('anim');
    // Failsafe: anything above the fold that is still hidden after 1.6s is shown.
    window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>('[data-rv]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && getComputedStyle(el).opacity === '0') el.dataset.rv = 'done';
      });
    }, 1600);
  }
}

export { gsap, ScrollTrigger, Flip };

/** Cards that catch the pointer light. One delegated listener for the whole site; nothing per component. */
const LIT = '.panel, .fact, .qcard, .job2, .scard, .story, .pick, .ecard, .sky, .read-ink, .breadth2, .stamp-item, .kv > div';

/** A soft light that follows the pointer across cards, plus a small lift: fine pointers only (never touch), and only while
 *  the tab can animate. It sets two custom properties and one class; the look lives in globals.css (`.lit`). */
export function initPointerLight(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia('(pointer: fine)').matches || prefersReduced()) return () => undefined;
  let hot: HTMLElement | null = null;
  let frame = 0;
  let last: PointerEvent | null = null;
  const paint = () => {
    frame = 0;
    const e = last;
    if (!e) return;
    const card = (e.target as Element | null)?.closest<HTMLElement>(LIT) ?? null;
    if (hot && hot !== card) hot.classList.remove('lit');
    hot = card;
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
    card.classList.add('lit');
  };
  const move = (e: PointerEvent) => { last = e; if (!frame) frame = window.requestAnimationFrame(paint); };
  const out = (e: PointerEvent) => { if (hot && !hot.contains(e.relatedTarget as Node | null)) { hot.classList.remove('lit'); hot = null; } };
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerout', out, { passive: true });
  return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerout', out); if (frame) window.cancelAnimationFrame(frame); };
}

/** Colours cross-fade when the theme changes, then the transition is removed so it never slows normal interaction. */
export function fadeTheme() {
  if (prefersReduced()) return;
  const h = document.documentElement;
  h.classList.add('theme-fade');
  window.setTimeout(() => h.classList.remove('theme-fade'), 420);
}

let io: IntersectionObserver | null = null;
let queue: HTMLElement[] = [];
let timer = 0;

function flush() {
  const batch = queue.filter((el) => el.isConnected);
  queue = [];
  timer = 0;
  if (!batch.length) return;
  // Fade and rise once, staggered, starting from the moment the element is in view: content is never hidden ahead of time,
  // so if this never runs (hidden tab, observer stall) the page is simply static, never blank.
  gsap.fromTo(batch, { opacity: 0, y: 10 }, {
    opacity: 1,
    y: 0,
    duration: 0.32,
    ease: 'power2.out',
    stagger: 0.04,
    overwrite: 'auto',
    onComplete: () => batch.forEach((b) => { b.dataset.rv = 'done'; gsap.set(b, { clearProps: 'opacity,transform' }); }),
  });
}

/** Reveal `el` when it scrolls into view. Returns an unobserve function. */
export function observeReveal(el: HTMLElement): () => void {
  // Children's effects run before the Shell's, so motion is switched on here too (idempotent); otherwise every card registered
  // before animation was enabled and silently opted out.
  initMotion();
  if (!document.documentElement.classList.contains('anim') || el.dataset.rv === 'done') return () => undefined;
  // Already on screen: show it as it is (no blink, no delay to the first paint). Below the fold: hide it now, while nobody can
  // see it, and fade it in when it scrolls into view.
  if (el.getBoundingClientRect().top < window.innerHeight) { el.dataset.rv = 'done'; return () => undefined; }
  gsap.set(el, { opacity: 0, y: 10 });
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io?.unobserve(e.target);
          queue.push(e.target as HTMLElement);
        }
        if (queue.length && !timer) timer = window.setTimeout(flush, 30);
      },
      // Any visible part counts: a margin that ignored the bottom of the screen left a card at the very end of a page hidden forever.
      { rootMargin: '0px', threshold: 0.01 },
    );
  }
  io.observe(el);
  return () => io?.unobserve(el);
}

