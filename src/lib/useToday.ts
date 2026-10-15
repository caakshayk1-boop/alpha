'use client';

import { useMemo } from 'react';
import { useDay } from './data';
import { todayView, type TodayView } from './today';

/** useDay() plus per-stock accessors: the one rule for "today" applied to a single stock's move and price.
 *  `screenAsOf` is the as-of date of the screen rows a page already holds (screen.breadth.as_of). */
export function useToday(screenAsOf: string | null): { view: TodayView; day: ReturnType<typeof useDay>['day']; live: ReturnType<typeof useDay>['live'] } {
  const { day, live } = useDay();
  const view = useMemo(() => todayView(day, live.snap, screenAsOf), [day, live.snap, screenAsOf]);
  return { view, day, live };
}
