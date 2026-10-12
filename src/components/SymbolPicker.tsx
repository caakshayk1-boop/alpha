'use client';

import { useMemo, useState } from 'react';
import { useFeed } from '@/lib/data';

/** Type a symbol or a name, pick from the matches. Used wherever a company has to be chosen. */
export default function SymbolPicker({ onPick, placeholder = 'Add a company…', exclude = [] }: { onPick: (sym: string) => void; placeholder?: string; exclude?: string[] }) {
  const s = useFeed('screen');
  const [q, setQ] = useState('');
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t || !s.data) return [];
    return s.data.rows
      .filter((r) => !exclude.includes(r.sym) && (r.sym.toLowerCase().startsWith(t) || r.name.toLowerCase().includes(t)))
      .sort((a, b) => (b.mcap_cr ?? 0) - (a.mcap_cr ?? 0)).slice(0, 7);
  }, [q, s.data, exclude]);
  return (
    <div style={{ position: 'relative', minWidth: 260 }}>
      <input className="field" style={{ width: '100%' }} placeholder={placeholder} aria-label={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      {hits.length > 0 && (
        <ul role="listbox" style={{ position: 'absolute', zIndex: 20, top: 44, left: 0, right: 0, margin: 0, padding: 6, listStyle: 'none', background: 'var(--panel)', border: '1px solid var(--line-2)', borderRadius: 14, boxShadow: 'var(--shadow)' }}>
          {hits.map((r) => (
            <li key={r.sym} role="option" aria-selected={false}>
              <button style={{ width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 10, display: 'flex', justifyContent: 'space-between', gap: 10 }} onClick={() => { onPick(r.sym); setQ(''); }}>
                <span><b>{r.sym}</b> <span className="dim" style={{ fontSize: 13.5 }}>{r.name}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
