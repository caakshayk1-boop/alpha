import { useEffect, useRef } from 'react';
import { useCalm } from '../calm.ts';

/** The 16-second "from the close to the ledger" explainer. Never autoplays with sound (there is none), never loads until near the screen, and respects reduced motion and Data Saver. */
export function HowVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const calm = useCalm();   // 18 Nov 2026: live, not read once at mount
  useEffect(() => {
    const v = ref.current; if (!v) return; if (calm) { v.pause(); return; } if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && e.intersectionRatio >= 0.6) { void v.play().catch(() => {}); } else v.pause(); }, { threshold: [0, 0.6] });
    io.observe(v); return () => io.disconnect();
  }, [calm]);
  return <figure className="how-video">
    <video ref={ref} className="how-video-el" muted loop playsInline preload={calm ? 'none' : 'metadata'} controls poster="/media/how-it-works-poster.jpg" aria-label="A 16-second animation: Tripwire's line from the market close to the ledger, six stops" width={1920} height={1080}>
      <source src="/media/how-it-works.mp4" type="video/mp4" />
    </video>
    <figcaption className="small mute">16 seconds, no sound. <details className="how-video-tx"><summary>Read it instead</summary>
      <p>One line, six stops, each leaving a dated record: Close (NSE session ends), Screen (every liquid name, scored), Rules (one written definition each), Picks (what fired, with the evidence), Paper book (positions, exits, costs), Ledger (append-only, dated). Public rules, evidence for and against, costs counted. Paper only. Not advice.</p></details></figcaption>
  </figure>;
}
