/** Deterministic checks on a machine-written study before it is shown as the normal reading (A04, E01). They catch the two
 *  errors the 17 Oct edition shipped: a percentage restated as the wrong number of paise per rupee, and a percentile described
 *  against an average or a median. A study failing either is withheld by default, exactly like one the pipeline marked under
 *  review: failing closed costs a reader one click; failing open shows a wrong number as fact. Pure; tested. */
const UNITS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
function wordNumber(w: string): number | null {
  const s = w.toLowerCase().replace(/[‑–-]/g, ' ').trim().split(/\s+/);
  if (s.length === 1) return UNITS[s[0]] ?? TENS[s[0]] ?? null;
  if (s.length === 2 && TENS[s[0]] !== undefined && UNITS[s[1]] !== undefined && UNITS[s[1]] < 10) return TENS[s[0]] + UNITS[s[1]];
  return null;
}
const NUMWORD = '(?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\\s‑–-](?:one|two|three|four|five|six|seven|eight|nine))?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)';
const PAISE = new RegExp(`(\\d+(?:\\.\\d+)?|${NUMWORD})\\s*(?:\\u202f|\\s)?paise`, 'gi');
const PCT = /(\d+(?:\.\d+)?)\s*(?: |\s)?%/g;

export interface ReadProblem { kind: 'paise' | 'percentile'; text: string }

/** Sentences: split on full stops, line breaks and bullets, so a bullet's figure and its gloss are checked together. */
const sentences = (md: string) => md.replace(/\*\*|__|\*/g, '').split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);

export function checkStudy(md: string): ReadProblem[] {
  const out: ReadProblem[] = [];
  for (const s of sentences(md)) {
    const pcts = [...s.matchAll(PCT)].map((m) => Number(m[1]));
    if (pcts.length) {
      for (const m of s.matchAll(PAISE)) {
        const v = /\d/.test(m[1]) ? Number(m[1]) : wordNumber(m[1]);
        // a percentage of a rupee is that many paise; within one paisa of ANY percentage in the sentence passes (rounding)
        if (v !== null && v <= 100 && !pcts.some((p) => Math.abs(p - v) <= 1)) out.push({ kind: 'paise', text: `“${m[0]}” restates none of ${pcts.map((p) => `${p}%`).join(', ')} in the same sentence` });
      }
    }
    // a percentile is a rank: it says nothing about an average, and it is above the median only when it is above 50
    const pc = /(\d{1,2})(?:st|nd|rd|th)\s+percentile/i.exec(s);
    const cmp = /\b(above|below|higher than|lower than|dearer than|cheaper than)\s+(?:its|the)?\s*(?:historical\s+|own\s+)?(average|mean|median)\b/i.exec(s);
    if (pc && cmp) {
      const n = Number(pc[1]), up = /above|higher|dearer/i.test(cmp[1]);
      if (cmp[2].toLowerCase() !== 'median') out.push({ kind: 'percentile', text: `the ${pc[1]}th percentile (a rank) is compared with an ${cmp[2].toLowerCase()}` });
      else if ((up && n <= 50) || (!up && n >= 50)) out.push({ kind: 'percentile', text: `the ${pc[1]}th percentile is described as ${cmp[1].toLowerCase()} the median` });
    }
  }
  return out;
}
