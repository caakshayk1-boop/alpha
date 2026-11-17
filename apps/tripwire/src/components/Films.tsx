import { useEffect, useRef, useState } from 'react';

interface FilmSpec { id: string; title: string; seconds: number; label: string; text: string }
/** The two portrait films that sit beside the wide "from the close to the ledger" one (HowVideo). Facts only; the same words are in the transcripts. */
export const FILMS: readonly FilmSpec[] = [
  { id: 'dark-keynote', title: 'What Tripwire stands for', seconds: 17, label: 'A 17-second animation: rules that fire, evidence you can check, a book that keeps score, missing data stays missing',
    text: 'Rules that fire: public, written down, one definition each. Evidence you can check: for a name and against it, with the date of every figure. A book that keeps score: paper positions, partial exits, costs counted, nothing hidden. Missing data stays missing: no zero where a number is unknown, and no forecasts. Paper-only research for Indian stocks, by Akshay, CA. Research, not advice. No SEBI registration is claimed.' },
  { id: 'blueprint', title: 'How a rule fires', seconds: 14, label: 'A 14-second animation: data, rule test, evidence, paper book, the four steps of how a rule fires',
    text: 'Step 1, data: the finished session’s prices and statements, with their dates. Step 2, rule test: a public rule, written down once; pass, fail, or not measured. Step 3, evidence: what supports the name and what counts against it, side by side. Step 4, paper book: a dated paper position; exits, partial exits and costs are recorded. Every figure keeps its date. Unknown stays unknown. Nothing here predicts. Paper only, not advice.' },
];

function Film({ f, calm }: { f: FilmSpec; calm: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current; if (!v || calm || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && e.intersectionRatio >= 0.6) { void v.play().catch(() => {}); } else v.pause(); }, { threshold: [0, 0.6] });
    io.observe(v); return () => io.disconnect();
  }, [calm]);
  return <figure className="film">
    <video ref={ref} className="film-el" muted loop playsInline preload={calm ? 'none' : 'metadata'} controls poster={`/media/${f.id}-poster.jpg`} aria-label={f.label} width={540} height={960}>
      <source src={`/media/${f.id}.mp4`} type="video/mp4" />
    </video>
    <figcaption className="small mute"><b>{f.title}.</b> {f.seconds} seconds, no sound. <details className="film-tx"><summary>Read it instead</summary><p>{f.text}</p></details></figcaption>
  </figure>;
}

/** Same rules as HowVideo: no sound, nothing loads until near the screen, nothing autoplays under reduced motion or Data Saver, and a text alternative for each. */
export function Films() {
  const [calm] = useState(() => {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches || !!(navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData; } catch { return false; }
  });
  return <div className="films" data-films>{FILMS.map((f) => <Film key={f.id} f={f} calm={calm} />)}</div>;
}
