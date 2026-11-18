// Tabs for the stock page. Without JavaScript every panel is simply visible (the tab bar is hidden until this runs). Keyboard: arrows, Home, End. The hash (#financials) opens that tab.
for (const root of document.querySelectorAll<HTMLElement>('[data-tabs]')) {
  const bar = root.querySelector<HTMLElement>('[role="tablist"]')!; const tabs = [...bar.querySelectorAll<HTMLButtonElement>('[role="tab"]')]; const panel = (t: HTMLElement) => root.querySelector<HTMLElement>(`#tab-${t.dataset.tab}`)!;
  const show = (id: string, focus = false, push = true) => { for (const t of tabs) { const on = t.dataset.tab === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; panel(t).hidden = !on; if (on && focus) t.focus(); } if (push) history.replaceState(null, '', '#' + id); };
  bar.hidden = false; tabs.forEach((t, i) => { t.setAttribute('aria-controls', `tab-${t.dataset.tab}`); panel(t).setAttribute('aria-labelledby', 'tabbtn-' + t.dataset.tab); t.id = 'tabbtn-' + t.dataset.tab; t.addEventListener('click', () => show(t.dataset.tab!));
    t.addEventListener('keydown', (e) => { const k = e.key; const j = k === 'ArrowRight' ? (i + 1) % tabs.length : k === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : -1; if (j >= 0) { e.preventDefault(); show(tabs[j].dataset.tab!, true); } }); });
  const fromHash = () => { const h = location.hash.slice(1); show(tabs.some((t) => t.dataset.tab === h) ? h : tabs[0].dataset.tab!, false, false); };
  fromHash(); addEventListener('hashchange', fromHash);
}
