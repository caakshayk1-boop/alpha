/** The one place Today reads the news module from: the lead event plus four updates, with the paper book's names as their OWN tab (never merged into Following). */
import { useAutoBook } from './book.ts';
import { WhatMattersNow } from './screens/News.tsx';
export function WhatMattersNowSlot({ syms }: { syms: string[] }) {
  const auto = useAutoBook(true);
  const paper = [...new Set(auto.rows.filter((r) => ['open', 'pending', 'waiting'].includes(r.v.status)).map((r) => r.p.sym))];
  return <WhatMattersNow follows={syms} paper={paper} />;
}
