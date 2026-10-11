'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { canAnimate, gsap } from '@/lib/motion';

/** Re-mounts on every navigation: a short rise-and-fade so route changes keep spatial continuity. */
export default function Template({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !canAnimate()) return;
    gsap.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', immediateRender: false, clearProps: 'opacity,transform' });
    window.scrollTo({ top: 0 });
  }, []);
  return <div ref={ref}>{children}</div>;
}
