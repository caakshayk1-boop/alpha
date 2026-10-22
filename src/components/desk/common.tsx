'use client';
/** Small pieces every My Desk tab shares. */
import SymbolPicker from '@/components/SymbolPicker';

export type DeskTab = 'following' | 'cards' | 'journal' | 'conditions';
export type Go = (t: DeskTab, sym?: string | null) => void;
export const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "22 Oct 2026" from an ISO timestamp, in IST. */
export const stampLabel = (iso: string | null | undefined) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : null);

/** Pick a company by name or symbol (the site's one picker), sized for the Desk on any width. */
export function QuickAdd({ onAdd, exclude = [], label = 'Or type a name to watch it' }: { onAdd: (s: string) => unknown; exclude?: string[]; label?: string }) {
  return <div className="desk-pick"><SymbolPicker onPick={(s) => { onAdd(s); }} exclude={exclude} placeholder={label} /></div>;
}
