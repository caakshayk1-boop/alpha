/** Follow the phone's text-size setting. Safari on iPhone resolves `font: -apple-system-body` to the size the user chose in Settings (17px at
 *  the default), so the ratio to 17 scales the root size and everything set in rem follows, as Dynamic Type does in a native app. Other
 *  browsers do not know that keyword, and then nothing changes: they already scale rem with the browser's own font-size setting. */
export const rootScale = (px: number) => Math.min(2, Math.max(0.85, px / 17));
export function followSystemTextSize() {
  if (typeof CSS === 'undefined' || !CSS.supports('font', '-apple-system-body')) return;
  const apply = () => {
    try {
      const p = document.createElement('span'); p.style.cssText = 'position:absolute;visibility:hidden;font:-apple-system-body'; p.textContent = 'x'; document.body.appendChild(p);
      const px = parseFloat(getComputedStyle(p).fontSize); p.remove();
      if (px > 0) document.documentElement.style.fontSize = `${(rootScale(px) * 100).toFixed(1)}%`;
    } catch { /* keep the default */ }
  };
  apply(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') apply(); });
}
