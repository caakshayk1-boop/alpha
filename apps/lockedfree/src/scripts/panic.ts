// Market-fall state: if the benchmark fell past the visitor's threshold in its latest session, the hero is replaced by their own plan, quoted back.
import { panic } from '../lib/plan.ts';
try { const raw = localStorage.getItem('rulebook-plan/1'); const hero = document.querySelector('[data-hero]'); const b = JSON.parse(document.getElementById('bench-data')?.textContent ?? '{}');
  if (raw && hero) { const plan = JSON.parse(raw); const p = panic(b.prev ?? null, b.last ?? null, plan.panicPct ?? 3);
    if (p.show) { const box = document.createElement('div'); box.className = 'panic'; box.setAttribute('role', 'status');
      const big = document.createElement('p'); big.className = 'big'; big.textContent = `Your plan, written on ${plan.createdOn}: falls like this are inside it.`;
      const small = document.createElement('p'); small.className = 'small'; small.textContent = `The market fell ${Math.abs(p.fallPct!)}% in its latest session (as of ${b.asOf}). You wrote that you could sit through ${plan.maxFallPct}%. Nothing in the plan changes today.`;
      const a = document.createElement('a'); a.className = 'btn'; a.href = '/plan/'; a.textContent = 'Open my plan'; box.append(big, small, a); hero.replaceWith(box); } } } catch { /* no plan, blocked storage, or bad data: the normal hero stays */ }
