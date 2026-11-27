// Data status: compare each dataset's day with today's session, in the visitor's own browser, so the verdict is never frozen at the time the page was built.
import { verdictOf, verdictWord } from '../lib/datastatus.ts';
const now = Date.now();
for (const row of document.querySelectorAll<HTMLElement>('[data-status-row]')) {
  const v = verdictOf(row.dataset.asof, now, row.dataset.cadence === 'weekly' ? 'weekly' : 'daily');
  const cell = row.querySelector<HTMLElement>('[data-state]'); if (!cell) continue;
  cell.textContent = verdictWord(v); row.dataset.state = v.state;
}
const note = document.querySelector<HTMLElement>('[data-status-note]'); if (note) note.hidden = true;
