'use client';
/** "Mark reviewed" (28 Nov 2026): one button for Today, My Desk and the company page. It saves the review snapshot
 *  (lib/review.ts, key alpha-reviewed) and confirms only after the write succeeded; when the browser blocks storage it says
 *  so, instead of looking as if nothing happened. The visible "Reviewed" state comes from the store itself, never assumed. */
import { useState } from 'react';
import { saveSnapshot, snapshotOf } from '@/lib/review';
import type { Row } from '@/lib/types';

export function ReviewButton({ sym, r, reviewed, className = 'act quiet', idle = 'Mark reviewed', again = 'Mark reviewed again' }: { sym: string; r: Row; reviewed: boolean; className?: string; idle?: string; again?: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const click = () => {
    const ok = saveSnapshot(sym, snapshotOf(r, new Date().toISOString()));
    setMsg(ok ? { ok: true, text: `Review of ${sym} saved in this browser.` } : { ok: false, text: 'Not saved: this browser is blocking storage, so the review cannot be kept.' });
  };
  return (
    <>
      <button type="button" className={className} onClick={click} aria-label={`Mark ${sym} reviewed now`}>{reviewed ? again : idle}</button>
      <span className={msg && !msg.ok ? 'rev-err' : 'sr'} role="status" aria-live="polite">{msg?.text ?? ''}</span>
    </>
  );
}
