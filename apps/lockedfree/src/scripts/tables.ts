// Sort and filter for any table marked [data-table]. Headers sort by click or Enter/Space (numbers by their data-v, text otherwise); a search box filters rows;
// columns marked data-facet get a dropdown of their own values. Rows are only hidden, never changed, so every number stays the one in the ledger.
const num = (v: string) => { const n = parseFloat(v.replace(/[^\d.\-−]/g, '').replace('−', '-')); return Number.isFinite(n) ? n : null; };
for (const t of document.querySelectorAll<HTMLTableElement>('table[data-table]')) {
  const body = t.tBodies[0]; if (!body) continue; const heads = [...t.tHead!.rows[0].cells]; const rows = () => [...body.rows];
  const bar = document.createElement('div'); bar.className = 'tbar'; const q = document.createElement('input'); q.type = 'search'; q.placeholder = 'Filter rows'; q.setAttribute('aria-label', 'Filter rows'); bar.append(q);
  const facets: { i: number; s: HTMLSelectElement }[] = [];
  heads.forEach((h, i) => { if (h.hasAttribute('data-facet')) { const s = document.createElement('select'); s.setAttribute('aria-label', 'Filter by ' + h.textContent!.trim()); const vals = [...new Set(rows().map((r) => r.cells[i].textContent!.trim()))].sort(); s.innerHTML = `<option value="">All ${h.textContent!.trim().toLowerCase()}</option>` + vals.map((v) => `<option>${v.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</option>`).join(''); bar.append(s); facets.push({ i, s }); } });
  const count = document.createElement('span'); count.className = 'count'; count.setAttribute('aria-live', 'polite'); bar.append(count); (t.closest('.scroll') ?? t).before(bar);
  const apply = () => { const text = q.value.trim().toLowerCase(); let n = 0; for (const r of rows()) { const ok = (!text || r.textContent!.toLowerCase().includes(text)) && facets.every((f) => !f.s.value || r.cells[f.i].textContent!.trim() === f.s.value); r.hidden = !ok; if (ok) n++; } count.textContent = `${n} of ${rows().length}`; };
  q.addEventListener('input', apply); facets.forEach((f) => f.s.addEventListener('change', apply)); apply();
  heads.forEach((h, i) => { if (h.hasAttribute('data-nosort')) return; h.setAttribute('aria-sort', 'none'); h.tabIndex = 0; h.setAttribute('role', 'columnheader');
    const go = () => { const dir = h.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending'; heads.forEach((x) => x.hasAttribute('aria-sort') && x.setAttribute('aria-sort', 'none')); h.setAttribute('aria-sort', dir);
      const key = (r: HTMLTableRowElement) => { const c = r.cells[i]; const v = c.dataset.v ?? c.textContent!.trim(); return { v, n: c.dataset.v != null ? num(c.dataset.v) : num(v) }; };
      const sorted = rows().sort((a, b) => { const x = key(a), y = key(b); if (x.n != null && y.n != null) return dir === 'ascending' ? x.n - y.n : y.n - x.n; if (x.n != null) return -1; if (y.n != null) return 1; return dir === 'ascending' ? x.v.localeCompare(y.v) : y.v.localeCompare(x.v); }); body.append(...sorted); };
    h.addEventListener('click', go); h.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); });
}
