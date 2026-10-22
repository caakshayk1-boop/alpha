'use client';

import { useCallback, useEffect, useState } from 'react';
import { normaliseCard, type CardDecision, type ResearchCard } from './card';

export const CARDS_KEY = 'alpha-cards-v1';
export const CARDS_EVENT = 'alpha-cards-changed';
const KEY = CARDS_KEY;
const EVT = CARDS_EVENT;

export function readCards(): { cards: ResearchCard[]; ok: boolean } {
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

export function writeCards(cards: ResearchCard[]): boolean {
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
    const load = () => setState(readCards());
    load();
    window.addEventListener(EVT, load);
    window.addEventListener('storage', load);
    return () => { window.removeEventListener(EVT, load); window.removeEventListener('storage', load); };
  }, []);
  const add = useCallback((card: ResearchCard) => { const cur = readCards(); return writeCards([card, ...cur.cards.filter((c) => c.id !== card.id)]); }, []);
  const addMany = useCallback((cards: ResearchCard[]) => { const cur = readCards(); const ids = new Set(cards.map((c) => c.id)); return writeCards([...cards, ...cur.cards.filter((c) => !ids.has(c.id))]); }, []);
  const remove = useCallback((id: string) => { writeCards(readCards().cards.filter((c) => c.id !== id)); }, []);
  const stamp = () => new Date().toISOString();
  const setNote = useCallback((id: string, note: string) => { writeCards(readCards().cards.map((c) => (c.id === id ? { ...c, note: note.trim() ? note.slice(0, 4000) : null, updatedAt: stamp() } : c))); }, []);
  const setDecision = useCallback((id: string, d: CardDecision | null) => writeCards(readCards().cards.map((c) => (c.id === id ? { ...c, decision: d, updatedAt: stamp() } : c))), []);
  /** Edit the reader's own words on a card (question, note, decision) in one write, stamped with the edit time. */
  const update = useCallback((id: string, patch: Partial<Pick<ResearchCard, 'question' | 'note' | 'decision'>>) => writeCards(readCards().cards.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: stamp() } : c))), []);
  return { ...state, add, addMany, remove, setNote, setDecision, update };
}
