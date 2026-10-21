'use client';

// Layout presets (Pro §28 P2): Quick look and Deep dive, remembered per page in this browser. Never changes data.
import { useCallback, useEffect, useState } from 'react';

export type Preset = 'quick' | 'deep';
export function useStoredPreset(key: string, base: Preset = 'deep'): [Preset, (p: Preset) => void] {
  const [p, setP] = useState<Preset>(base);
  useEffect(() => { try { const v = localStorage.getItem(key); if (v === 'quick' || v === 'deep') setP(v); } catch { /* storage blocked: the default stays */ } }, [key]);
  const set = useCallback((v: Preset) => { setP(v); try { localStorage.setItem(key, v); } catch { /* this page only */ } }, [key]);
  return [p, set];
}
