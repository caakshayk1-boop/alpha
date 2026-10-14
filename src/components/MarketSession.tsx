'use client';

import { useQuotes } from '@/lib/data';

import { sessionOf } from '@/lib/session';

export function MarketSession() {
  const q = useQuotes();
  const s = sessionOf(q.data?.quotes.find((x) => x.id === 'nifty')?.at);
  if (!s) return null;
  return <span className={`stamp-item ${s.open ? 'up' : ''}`}><span aria-hidden>{s.open ? '●' : '○'}</span> <b>{s.label.split(' · ')[0]}</b> <em>{s.label.split(' · ')[1]}</em></span>;
}
