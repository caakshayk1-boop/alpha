import type { Metadata } from 'next';

const t = 'Signals: one rule book, only when the market allows';
const d = 'Swing v2: a market gate, two textbook setups and a written plan (half at 2R, a locked profit, a trailing stop), with its backtest against random stocks and its live record.';
export const metadata: Metadata = { title: t, description: d, openGraph: { title: t, description: d, url: '/engines/', type: 'website' } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
