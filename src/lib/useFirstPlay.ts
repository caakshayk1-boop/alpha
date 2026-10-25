'use client';
import { useEffect, useLayoutEffect, useState } from 'react';

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** True once per browser session for a given key, then false: an entrance animation plays the first time a block is seen, not on every
 *  return to the page. Content is in its final state in the markup; this only decides whether the entrance runs (before first paint). */
export function useFirstPlay(key: string): boolean {
  const [play, setPlay] = useState(false);
  useIso(() => {
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      setPlay(true);
    } catch { /* storage blocked: no entrance, the page is complete without it */ }
  }, [key]);
  return play;
}
