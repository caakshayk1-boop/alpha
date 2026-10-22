'use client';
/** Two small shared controls (brief Part I §4): a drawer under the one modal contract, and an overflow menu for actions that
 *  are not a page's main job. The company workspace's heavier parts are in Workspace.tsx. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModal } from '@/lib/useModal';

/** A side drawer (a bottom sheet on phones) under the one modal contract: focus in, Tab kept inside, Escape closes, focus back. */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, open, onClose);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="drawer-host">
      <div className="drawer-back" onMouseDown={onClose} role="presentation" />
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-h"><h2>{title}</h2><button type="button" className="act quiet" data-close onClick={onClose} aria-label={`Close ${title}`}>Close</button></div>
        <div className="drawer-b">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** "More" for actions that are not the page's main job (share, image): one button, a small menu. Escape and outside clicks close it. */
export function Overflow({ label = 'More actions', children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); box.current?.querySelector<HTMLButtonElement>('[data-ovf]')?.focus(); } };
    window.addEventListener('pointerdown', away); window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="ovf" ref={box}>
      <button type="button" className="act" data-ovf aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)} aria-label={label}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {open && <div className="ovf-menu" role="group" aria-label={label}>{children}</div>}
    </div>
  );
}
