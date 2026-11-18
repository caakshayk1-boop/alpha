// Smooth scroll on reading pages only. Never on tables, the Gate or the Plan. Off under reduced motion.
import Lenis from 'lenis';
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { const l = new Lenis({ duration: 1.0, easing: (t: number) => 1 - Math.pow(1 - t, 3) }); const raf = (t: number) => { l.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
