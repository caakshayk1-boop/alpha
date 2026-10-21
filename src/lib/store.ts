'use client';

import { useCallback, useEffect, useState } from 'react';

const EVENT = 'alpha-store';

/** The list as stored now, or [] when storage is blocked or the value is corrupt. */
function read(key: string): string[] {
  try { const v = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
}

/** Pure list operations, tested directly: duplicates never enter, order is kept, unrelated names are never dropped. */
export const listOps = {
  add: (list: string[], s: string) => (list.includes(s) ? list : [...list, s]),
  remove: (list: string[], s: string) => list.filter((x) => x !== s),
  addAll: (list: string[], all: string[]) => [...list, ...all.filter((x, i) => !list.includes(x) && all.indexOf(x) === i)],
};

/** A small list kept in the browser (A09, 21 Oct 2026).
 *  Every change reads the STORED list first and writes the result back, so several changes in one render (adding three
 *  picked names) cannot overwrite each other, and every mounted consumer and every other tab is told. Storage can be
 *  blocked or full: then the change is not kept, and `error` says so instead of the page showing a "saved" state. */
export function useStoredList(key: string): [string[], (s: string) => boolean, (s: string) => boolean, (all: string[]) => boolean, string | null] {
  const [list, setList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setList(read(key));
    const sync = (e: Event) => {
      if (e instanceof StorageEvent ? e.key === key || e.key === null : (e as CustomEvent<string>).detail === key) setList(read(key));
    };
    window.addEventListener('storage', sync);            // other tabs
    window.addEventListener(EVENT, sync);                // other components in this tab
    return () => { window.removeEventListener('storage', sync); window.removeEventListener(EVENT, sync); };
  }, [key]);
  const change = useCallback((f: (cur: string[]) => string[]) => {
    const next = f(read(key));
    try {
      localStorage.setItem(key, JSON.stringify(next));
      if (JSON.stringify(read(key)) !== JSON.stringify(next)) throw new Error('not kept');
    } catch {
      setError('Could not save in this browser (storage is blocked or full). Nothing was changed.');
      setList(read(key));
      return false;
    }
    setError(null);
    setList(next);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    return true;
  }, [key]);
  const add = useCallback((s: string) => change((cur) => listOps.add(cur, s)), [change]);
  const remove = useCallback((s: string) => change((cur) => listOps.remove(cur, s)), [change]);
  const addAll = useCallback((all: string[]) => change((cur) => listOps.addAll(cur, all)), [change]);
  return [list, add, remove, addAll, error];
}
