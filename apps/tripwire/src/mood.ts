/** The market mood: a plain description of how today is moving, from three live figures. It is not a forecast and it feeds no pick.
 *  score = Nifty change (each 1.2% is one point, capped at 2) + Bank Nifty change at half weight - India VIX change (each 8% is one point, capped at 1). */
export interface Mood { word: string; score: number; tone: 'up' | 'down' | 'flat' }
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export function mood(nifty: number | null, bank: number | null, vix: number | null): Mood | null {
  if (nifty == null) return null;
  const score = clamp(nifty / 1.2, -2, 2) + (bank == null ? 0 : clamp(bank / 1.2, -2, 2) * 0.5) - (vix == null ? 0 : clamp(vix / 8, -1, 1));
  const word = score >= 1.5 ? 'Strong' : score >= 0.5 ? 'Firm' : score > -0.5 ? 'Mixed' : score > -1.5 ? 'Soft' : 'Under pressure';
  return { word, score: Math.round(score * 100) / 100, tone: score >= 0.5 ? 'up' : score <= -0.5 ? 'down' : 'flat' };
}
/** A stable hue (0 to 359) for a symbol, so each name keeps its own colour everywhere. */
export const hueOf = (s: string) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
