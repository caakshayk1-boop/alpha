'use client';

import { useCallback, useEffect, useState } from 'react';
import { normaliseCard, type CardDecision, type ResearchCard } from './card';

const KEY = 'alpha-cards-v1';
const EVT = 'alpha-cards-changed';

function read(): { cards: ResearchCard[]; ok: boolean } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { cards: [], ok: true };
    const list = JSON.parse(raw);
    const cards = (Array.isArray(list) ? list : []).map(normaliseCard).flatMap((r) => (r.ok ? [r.value] : []));
    return { cards, ok: true };
  } catch {
    return { cards: [], ok: false };
  }
}

function write(cards: ResearchCard[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(cards));
    window.dispatchEvent(new Event(EVT));
    return true;
  } catch {
    return false;
  }
}

/** Research cards kept in this browser only. `ok` is false when storage is blocked, full or corrupt: the app then says so instead of pretending to save. */
export function useCards() {
  const [state, setState] = useState<{ cards: ResearchCard[]; ok: boolean }>({ cards: [], ok: true });
  useEffect(() => {
    const load = () => setState(read());
    load();
    window.addEventListener(EVT, load);
    window.addEventListener('storage', load);
    return () => { window.removeEventListener(EVT, load); window.removeEventListener('storage', load); };
  }, []);
  const add = useCallback((card: ResearchCard) => { const cur = read(); return write([card, ...cur.cards.filter((c) => c.id !== card.id)]); }, []);
  const addMany = useCallback((cards: ResearchCard[]) => { const cur = read(); const ids = new Set(cards.map((c) => c.id)); return write([...cards, ...cur.cards.filter((c) => !ids.has(c.id))]); }, []);
  const remove = useCallback((id: string) => { write(read().cards.filter((c) => c.id !== id)); }, []);
  const setNote = useCallback((id: string, note: string) => { write(read().cards.map((c) => (c.id === id ? { ...c, note: note.trim() ? note.slice(0, 4000) : null } : c))); }, []);
  const setDecision = useCallback((id: string, d: CardDecision | null) => write(read().cards.map((c) => (c.id === id ? { ...c, decision: d } : c))), []);
  return { ...state, add, addMany, remove, setNote, setDecision };
}
