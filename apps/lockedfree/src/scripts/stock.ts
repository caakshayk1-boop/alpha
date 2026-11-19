// Stock page: meters and range marker animate to their values. The price chart is in pricechart.ts.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll<HTMLElement>('.meter > b[data-w]').forEach((b) => { const w = +b.dataset.w! + '%'; if (reduce) { b.style.transition = 'none'; b.style.setProperty('--w', w); } else { b.style.setProperty('--w', '0%'); requestAnimationFrame(() => requestAnimationFrame(() => b.style.setProperty('--w', w))); } });
document.querySelectorAll<HTMLElement>('.range > i[data-x]').forEach((i) => { const x = i.dataset.x! + '%'; if (reduce) { i.style.transition = 'none'; i.style.setProperty('--x', x); } else { i.style.setProperty('--x', '0%'); requestAnimationFrame(() => requestAnimationFrame(() => i.style.setProperty('--x', x))); } });
const m = new Date(Date.now() + 19800000).getUTCMonth() + 1; document.querySelector(`.months [data-month="${m}"]`)?.classList.add('now');
