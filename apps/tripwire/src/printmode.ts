/** Print expands every native <details>. A closed <details> hides its content from the printer, and `@media print` cannot open one, so the page opens them itself for the length of the
 *  print and puts each back as it was found: only the ones IT opened are closed again, so a disclosure the person had open stays open and nothing they did is undone.
 *  `beforeprint`/`afterprint` cover the browser's own dialog (Ctrl/Cmd+P, the Print button); the `print` media query listener covers engines that only report the media change
 *  (Safari's preview, and the print emulation a test uses). A <details data-print-closed> stays closed: a shorter table stands in for it on the page. */
const MARK = 'data-print-opened';
export function openAllForPrint(root: ParentNode = document): number {
  let n = 0;
  root.querySelectorAll<HTMLDetailsElement>('details:not([open]):not([data-print-closed])').forEach((d) => { d.setAttribute('open', ''); d.setAttribute(MARK, ''); n++; });
  return n;
}
export function restoreAfterPrint(root: ParentNode = document): number {
  let n = 0;
  root.querySelectorAll<HTMLDetailsElement>(`details[${MARK}]`).forEach((d) => { d.removeAttribute('open'); d.removeAttribute(MARK); n++; });
  return n;
}
/** Wire the listeners once. Returns a function that removes them (used by tests). */
export function installPrintExpand(win: Window = window): () => void {
  const before = () => { openAllForPrint(win.document); }; const after = () => { restoreAfterPrint(win.document); };
  const mq = win.matchMedia ? win.matchMedia('print') : null;
  const onMq = (e: MediaQueryListEvent) => (e.matches ? before() : after());
  win.addEventListener('beforeprint', before); win.addEventListener('afterprint', after);
  mq?.addEventListener?.('change', onMq);
  return () => { win.removeEventListener('beforeprint', before); win.removeEventListener('afterprint', after); mq?.removeEventListener?.('change', onMq); };
}
