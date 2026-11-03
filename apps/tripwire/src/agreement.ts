/** Three distinct rule-based model outputs. Internal indicator checks are evidence, never additional model votes. */
import type { Row } from './screen.ts';
export type SignalEngine = 'MOM' | 'QLT' | 'ST';
export type Direction = 'long' | 'bearish' | 'neutral';
export interface ModelOutput { id: string; name: string; direction: Direction; vote: boolean; confidence: 'high' | 'medium' | 'low' | 'unavailable'; rationale: string; timestamp: string | null; valid: boolean; fresh: boolean }
export interface Agreement { version: 'agreement-1'; minimum: number; count: number; direction: Direction; pass: boolean; models: ModelOutput[]; reason: string }
export type AgreementSettings = Record<SignalEngine, 1 | 2 | 3>;
/** Three of three retains the existing all-confirmations approach. Two is a selectable majority, never an implicit default. */
export const DEFAULT_AGREEMENT: AgreementSettings = { MOM: 3, QLT: 3, ST: 3 };
export function agreementSettings(raw: unknown): AgreementSettings {
  const r = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return Object.fromEntries(Object.keys(DEFAULT_AGREEMENT).map((k) => [k, [1, 2, 3].includes(Number(r[k])) ? Number(r[k]) : DEFAULT_AGREEMENT[k as SignalEngine]])) as AgreementSettings;
}
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** Duplicate model IDs cannot vote twice; timestamps must match the required completed session, including after market close. */
export function agree(models: ModelOutput[], minimum: number, expectedDay: string): Agreement {
  const min = [1, 2, 3].includes(minimum) ? minimum : 3;
  const counts = new Map<string, number>();
  for (const m of models) counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
  const valid = models.length === 3 ? models.filter((m) => m.id && counts.get(m.id) === 1 && m.valid && m.fresh && Number.isFinite(Date.parse(m.timestamp ?? '')) && m.timestamp?.slice(0, 10) === expectedDay) : [];
  const longs = valid.filter((m) => m.vote && m.direction === 'long').length;
  const bears = valid.filter((m) => m.direction === 'bearish').length;
  const direction: Direction = longs > bears ? 'long' : bears > longs ? 'bearish' : 'neutral';
  const pass = direction === 'long' && longs >= min;
  return { version: 'agreement-1', minimum: min, count: longs, direction, pass, models,
    reason: pass ? `${longs}/3 fresh models support long; minimum ${min}.` : valid.length < min ? `Only ${valid.length}/3 models have valid data for ${expectedDay}; minimum ${min}.` : direction !== 'long' ? 'Models disagree or favour a decline. No short sale is generated.' : `${longs}/3 support long; minimum ${min}.` };
}
type ModelSpec = [string, string, (number | null | undefined)[], boolean, boolean, string];
export function modelOutputs(engine: SignalEngine, r: Row & { mf?: { rank?: number; of?: number } | null }, asOf: string, expectedDay: string): ModelOutput[] {
  const px = r.price ?? NaN, ma20 = r.sma20 ?? NaN, ma50 = r.sma50 ?? NaN, ma200 = r.sma200 ?? NaN, rsi = r.rsi ?? NaN;
  const specs: ModelSpec[] = engine === 'QLT' ? [
    ['quality', 'Financial quality', [r.piotroski, r.roce_med, r.de], (r.piotroski ?? -1) >= 7 && (r.roce_med ?? -1) >= 15 && (r.de ?? 99) <= 1, (r.piotroski ?? 9) < 4, `Piotroski ${r.piotroski ?? 'missing'}/9; ROCE ${r.roce_med ?? 'missing'}%; debt/equity ${r.de ?? 'missing'}. Requires 7+, 15%+, ≤1. Accounts ${r.fy ?? 'period unpublished'}.`],
    ['valuation', 'Relative valuation', [r.mf?.rank, r.mf?.of], (r.mf?.rank ?? Infinity) <= (r.mf?.of ?? 0) / 2, (r.mf?.rank ?? 0) > (r.mf?.of ?? Infinity) * .75, `Magic Formula rank ${r.mf?.rank ?? 'missing'} of ${r.mf?.of ?? 'missing'}; upper half confirms, bottom quarter is adverse.`],
    ['trend', 'Long-term trend', [r.price, r.sma200], px > ma200, px < ma200, `Close ${r.price ?? 'missing'} vs 200-day average ${r.sma200 ?? 'missing'}.`],
  ] : engine === 'MOM' ? [
    ['trend', 'Swing trend', [r.price, r.sma50, r.sma200], px > ma50 && ma50 > ma200, px < ma50 && ma50 < ma200, `Close ${r.price ?? 'missing'}, 50-day ${r.sma50 ?? 'missing'}, 200-day ${r.sma200 ?? 'missing'}; rising order confirms.`],
    ['structure', 'Price structure', [r.price, r.sma50, r.from_high], px >= ma50 && (r.from_high ?? -100) >= -15, px < ma50 && (r.from_high ?? 0) < -15, `Close above 50-day support proxy and within 15% of the 52-week high; current distance ${r.from_high ?? 'missing'}%. This is not a confirmed pivot.`],
    ['momentum', 'Momentum confirmation', [r.rsi, r.rs3m], rsi >= 50 && rsi <= 75 && (r.rs3m ?? 0) > 0, rsi < 40 && (r.rs3m ?? 0) < 0, `Daily RSI ${r.rsi ?? 'missing'} (confirm 50–75); relative strength ${r.rs3m ?? 'missing'} pts (above 0).`],
  ] : [
    ['trend', 'Short-term trend', [r.price, r.sma20, r.sma50], px > ma50 && ma20 > ma50, px < ma50 && ma20 < ma50, `Close ${r.price ?? 'missing'}, 20-day ${r.sma20 ?? 'missing'}, 50-day ${r.sma50 ?? 'missing'}; close and 20-day above 50-day confirms.`],
    ['structure', 'Support retest', [r.price, r.sma20, r.atr_pct], px >= ma20 && px <= ma20 * (1 + (r.atr_pct ?? 0) / 100), px < ma20 * (1 - (r.atr_pct ?? 0) / 100), `Close within one daily ATR above the 20-day support proxy: ${r.price ?? 'missing'} vs ${r.sma20 ?? 'missing'}; ATR ${r.atr_pct ?? 'missing'}%.`],
    ['momentum', 'Short-term momentum', [r.rsi, r.r1d], rsi >= 45 && rsi <= 65 && (r.r1d ?? 0) > 0, rsi < 40 && (r.r1d ?? 0) < 0, `Daily RSI ${r.rsi ?? 'missing'} (confirm 45–65), session change ${r.r1d ?? 'missing'}% (above 0).`],
  ];
  const timestamp = r.last_date ? `${r.last_date}T15:30:00+05:30` : null;
  const fresh = !r.stale && r.last_date === asOf && asOf === expectedDay;
  return specs.map(([id, name, inputs, bullish, bearish, rationale]) => {
    const semantic = id === 'quality' ? Number.isInteger(r.piotroski) && r.piotroski! >= 0 && r.piotroski! <= 9 && r.de! >= 0
      : id === 'valuation' ? Number.isInteger(r.mf?.rank) && Number.isInteger(r.mf?.of) && r.mf!.rank! >= 1 && r.mf!.rank! <= r.mf!.of!
      : id === 'momentum' ? rsi >= 0 && rsi <= 100
      : px > 0 && (id === 'trend' ? (engine === 'QLT' ? ma200 > 0 : ma50 > 0 && (engine === 'MOM' ? ma200 > 0 : ma20 > 0)) : engine === 'MOM' ? ma50 > 0 && r.from_high! >= -100 && r.from_high! <= 0 : ma20 > 0 && r.atr_pct! > 0);
    const valid = inputs.every(num) && semantic && !!timestamp && Number.isFinite(Date.parse(timestamp)); const direction: Direction = bullish ? 'long' : bearish ? 'bearish' : 'neutral';
    return { id, name, valid, fresh: valid && fresh, timestamp, direction: valid ? direction : 'neutral', vote: valid && fresh && bullish,
      confidence: !valid || !fresh ? 'unavailable' : direction === 'neutral' ? 'low' : 'high', rationale: `${rationale}${!valid ? ' Required input or timestamp missing.' : !fresh ? ` Data is not current for ${expectedDay}.` : ''}` }; });
}
