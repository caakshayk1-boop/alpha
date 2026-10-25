import type { Metadata } from 'next';
import '../signals.css';

const t = 'Paper record: the Swing v2 book, marked to the price';
const d = 'Open paper trades marked to the latest price (before costs), closed trades after costs with their gross figure beside them, and the next session’s decisions. Paper only, never a fill.';
export const metadata: Metadata = { title: t, description: d, openGraph: { title: t, description: d, url: '/trades/', type: 'website' } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
