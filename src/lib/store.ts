'use client';

import { useCallback, useEffect, useState } from 'react';

/** A small list kept in the browser. Storage can be blocked or full, so every access is guarded and the list simply does not persist. */
export function useStoredList(key: string): [string[], (s: string) => void, (s: string) => void, (all: string[]) => void] {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(key) ?? '[]'); if (Array.isArray(v)) setList(v.filter((x) => typeof x === 'string')); } catch { /* blocked or corrupt: start empty */ }
  }, [key]);
  const save = useCallback((next: string[]) => {
    setList(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage full or blocked */ }
  }, [key]);
  const add = useCallback((s: string) => save(list.includes(s) ? list : [...list, s]), [list, save]);
  const remove = useCallback((s: string) => save(list.filter((x) => x !== s)), [list, save]);
  const addAll = useCallback((all: string[]) => save([...list, ...all.filter((x, i) => !list.includes(x) && all.indexOf(x) === i)]), [list, save]);
  return [list, add, remove, addAll];
}
