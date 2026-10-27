/** The one place Today reads the news module from. The NEWS branch supplies `WhatMattersNow` (a lead event plus four updates, expandable to ten) in screens/News.tsx and a
 *  health helper in newshealth.ts; until that is merged this renders the existing TodayNews. Integration: replace the body of this file with
 *  `export { WhatMattersNow as WhatMattersNowSlot } from './screens/News.tsx'` (props: `syms`, the followed and held names) and nothing else in Today changes. */
import { TodayNews } from './screens/News.tsx';
export function WhatMattersNowSlot({ syms }: { syms: string[] }) { return <TodayNews syms={syms} />; }
