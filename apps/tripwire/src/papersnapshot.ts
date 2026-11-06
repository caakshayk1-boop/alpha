import type { Plan, State } from './store.ts';
import { savePlan } from './store.ts';
import type { Row } from './screen.ts';
import { finite } from './research.ts';
export interface ImportPlan { sym: string; qty: number; entry: number; stop: number }
/** Small explicit CSV contract. Quoted fields and escaped quotes are supported; malformed input is refused whole. */
export function parsePaperCsv(text: string, known: ReadonlySet<string>): { plans: ImportPlan[]; error: string | null } {
  const fail = (error: string) => ({ plans: [], error });
  if (text.length > 100000) return fail('Use a CSV smaller than 100 KB.');
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, ended = false;
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i <= src.length; i++) {
    const ch = src[i] ?? '\n';
    if (quoted) { if (i === src.length) return fail('An opening quote has no closing quote.'); if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; ended = true; } } else cell += ch; }
    else if (ch === '"' && !cell && !ended) quoted = true;
    else if (ch === ',' || ch === '\n') { row.push(cell.trim()); cell = ''; ended = false; if (ch === '\n') { if (row.some(Boolean)) rows.push(row); row = []; } }
    else if (ended && ch.trim()) return fail('Unexpected text after a quoted value.');
    else cell += ch;
  }
  if (rows.length < 2 || rows[0].map((x) => x.toLowerCase()).join(',') !== 'symbol,quantity,entry,stop') return fail('Use the exact header: symbol,quantity,entry,stop');
  if (rows.length > 101) return fail('Import up to 100 paper plans at a time.');
  const plans: ImportPlan[] = [], seen = new Set<string>();
  for (const [i, r] of rows.slice(1).entries()) {
    const sym = r[0]?.toUpperCase(); const qty = Number(r[1]), entry = Number(r[2]), stop = Number(r[3]);
    if (r.length !== 4 || !known.has(sym) || !/^[A-Z0-9&_.-]{1,30}$/.test(sym)) return fail(`Row ${i + 2}: company is not in the loaded screen, or columns are incorrect.`);
    if (seen.has(sym)) return fail(`Row ${i + 2}: duplicate symbol ${sym}; combine it before importing.`);
    if (!Number.isSafeInteger(qty) || qty <= 0 || !finite(entry) || !finite(stop) || !(entry > stop && stop > 0) || !finite(qty * entry)) return fail(`Row ${i + 2}: use a positive whole quantity and entry > stop > 0.`);
    plans.push({ sym, qty, entry, stop }); seen.add(sym);
  }
  return { plans, error: null };
}
export function importPaperPlans(s: State, plans: ImportPlan[], now = new Date()): { state: State; added: number } {
  let state = s, added = 0;
  for (const p of plans) { if (state.plans.some((x) => x.sym === p.sym && x.qty === p.qty && x.entry === p.entry && x.stop === p.stop)) continue;
    state = savePlan(state, { ...p, riskPct: s.prefs.equity > 0 ? (p.entry - p.stop) * p.qty / s.prefs.equity * 100 : 0, note: 'CSV import: hypothetical paper plan, not a broker holding', expiry: null }, now); added++;
  }
  return { state, added };
}
export function paperSnapshot(plans: Plan[], rows: Row[]) {
  const positions = plans.filter((p) => p.status === 'paper-filled').map((p) => {
    const r = rows.find((r) => r.sym === p.sym);
    const filled = p.filledAt ? Date.parse(p.filledAt) : NaN;
    const fillDay = Number.isFinite(filled) ? new Date(filled + 19800000).toISOString().slice(0, 10) : null;
    const usable = !!r && finite(r.price) && r.price > 0 && !!r.last_date && !r.stale && !!fillDay && fillDay <= r.last_date;
    const value = usable ? p.qty * r.price! : null, basis = p.qty * p.entry;
    const day = usable && finite(r.r1d) && r.r1d > -100 && fillDay && fillDay < r.last_date! ? p.qty * (r.price! - r.price! / (1 + r.r1d / 100)) : null;
    return { p, date: r?.last_date ?? null, value, basis, gain: value == null ? null : value - basis, day, sector: r?.sector ?? 'Unclassified' };
  });
  const dates = [...new Set(positions.map((x) => x.date))];
  const complete = positions.length > 0 && positions.every((x) => x.value != null) && dates.length === 1;
  const value = complete ? positions.reduce((n, x) => n + x.value!, 0) : null;
  const invested = positions.reduce((n, x) => n + x.basis, 0);
  const day = complete && positions.every((x) => x.day != null) ? positions.reduce((n, x) => n + x.day!, 0) : null;
  const grouped = new Map<string, number>(); if (complete) for (const x of positions) grouped.set(x.p.sym, (grouped.get(x.p.sym) ?? 0) + x.value!);
  const allocation = [...grouped].map(([sym, amount]) => ({ sym, amount, pct: amount / value! * 100 })).sort((a, b) => b.amount - a.amount);
  return { positions, complete, value, invested, gain: value == null ? null : value - invested, day, date: complete ? dates[0] : null, allocation };
}
