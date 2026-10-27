/** The one place Today reads the news module from: the lead event plus four updates, with the paper book's names (the automatic book and the reader's own paper trades) as their OWN tab, never merged into Following. */
import { useMemo } from 'react';
import { useAppState } from './app.tsx';
import { useAutoBook } from './book.ts';
import { WhatMattersNow } from './screens/News.tsx';
export function WhatMattersNowSlot({ syms }: { syms: string[] }) {
  const s = useAppState(); const auto = useAutoBook(true);
  const paper = useMemo(() => [...new Set([...auto.rows.filter((r) => ['open', 'pending', 'waiting'].includes(r.v.status)).map((r) => r.p.sym), ...s.paper.filter((p) => !p.closedByUser).map((p) => p.sym)])], [auto.rows, s.paper]);
  return <WhatMattersNow follows={syms} paper={paper} />;
}
