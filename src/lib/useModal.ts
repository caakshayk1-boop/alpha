'use client';
/** The one modal contract (A07, 21 Oct 2026). Every dialog, sheet and palette uses it, so none can drift:
 *   - focus moves into the dialog on open and returns to the element that opened it on close;
 *   - Tab and Shift+Tab stay inside it;
 *   - everything behind it is `inert` (cannot be clicked, focused or read by a screen reader) while it is open;
 *   - Escape closes only the topmost dialog, so a dialog opened from another closes alone;
 *   - the page under it does not scroll; the lock is counted, so nested dialogs release it once, in order.
 *  The dialog must be rendered in a portal on document.body (the page's entrance transform would otherwise trap a fixed
 *  panel, and its siblings could not be made inert). */
import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const stack: symbol[] = [];
let locks = 0;
let prevOverflow = '';
/** True while any dialog using this contract is open (global shortcuts stand down). */
export const anyModalOpen = () => stack.length > 0;

export function useModal(panel: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, initial = '[data-close]') {
  const close = useRef(onClose);
  close.current = onClose;              // the effect must not restart (and re-focus) on every render
  useEffect(() => {
    const el = panel.current;
    if (!open || !el) return undefined;
    const id = Symbol('modal');
    stack.push(id);
    const back = document.activeElement as HTMLElement | null;
    // the page under the dialog: lock <html> (locking <body> widened the layout viewport on phones, measured +32 px)
    if (locks++ === 0) { prevOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden'; }
    // inert: every child of <body> except the one holding this dialog
    let host: HTMLElement = el;
    while (host.parentElement && host.parentElement !== document.body) host = host.parentElement;
    const made: Element[] = [];
    for (const c of Array.from(document.body.children)) if (c !== host && !c.hasAttribute('inert') && c.tagName !== 'SCRIPT') { c.setAttribute('inert', ''); made.push(c); }
    const t = window.setTimeout(() => (el.querySelector<HTMLElement>(initial) ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus({ preventScroll: true }), 0);
    const key = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;          // only the topmost dialog answers
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close.current(); return; }
      if (e.key !== 'Tab') return;
      const f = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (f.length === 0) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || !el.contains(at))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (at === last || !el.contains(at))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', key, true);
      stack.splice(stack.indexOf(id), 1);
      for (const c of made) c.removeAttribute('inert');
      if (--locks === 0) document.documentElement.style.overflow = prevOverflow;
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, [open, panel, initial]);
}
