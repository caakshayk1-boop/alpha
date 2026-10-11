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

let io: IntersectionObserver | null = null;
let queue: HTMLElement[] = [];
let timer = 0;

function flush() {
  const batch = queue.filter((el) => el.isConnected);
  queue = [];
  timer = 0;
  if (!batch.length) return;
  gsap.to(batch, {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    duration: 0.8,
    stagger: 0.07,
    overwrite: 'auto',
    // hand the element back to CSS once it is fully shown
    onComplete: () => batch.forEach((b) => { b.dataset.rv = 'done'; gsap.set(b, { clearProps: 'opacity,transform,filter' }); }),
  });
}

/** Reveal `el` when it scrolls into view. Returns an unobserve function. */
export function observeReveal(el: HTMLElement): () => void {
  if (!document.documentElement.classList.contains('anim') || el.dataset.rv === 'done') return () => undefined;
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
      { rootMargin: '0px 0px -6% 0px', threshold: 0.04 },
    );
  }
  io.observe(el);
  return () => io?.unobserve(el);
}

/** Animate a number inside `el` from its current text to `to`. Falls back to setting it directly. */
export function countUp(el: HTMLElement, to: number, fmt: (n: number) => string, duration = 1.2) {
  if (!canAnimate()) {
    el.textContent = fmt(to);
    return;
  }
  const o = { v: 0 };
  gsap.to(o, {
    v: to,
    duration,
    ease: 'power2.out',
    onUpdate: () => {
      el.textContent = fmt(o.v);
    },
    onComplete: () => {
      el.textContent = fmt(to);
    },
  });
}
