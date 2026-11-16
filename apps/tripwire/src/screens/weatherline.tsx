import { useMemo } from 'react';
import type { Row } from '../screen.ts';
import { weatherOf } from '../weather.ts';
import { freshness } from '../freshness.ts';

/** Regime Weather (4.0, F5): the market's condition at the last close, in one sentence, from the same rows Research shows. Descriptive only. */
export function WeatherLine({ rows, day }: { rows: readonly Row[]; day: string | null }) {
  const behind = freshness(day).behind;
  const w = useMemo(() => weatherOf(rows, day, behind), [rows, day, behind]);
  return <section className="tsec weather" aria-label="Market weather" data-weather data-stale={w.stale ? '' : undefined}>
    <p className="eyebrow">Market weather · describes conditions, advises nothing</p>
    <p className="weather-line" title={w.rule}>{w.line}</p>
  </section>;
}
