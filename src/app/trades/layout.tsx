import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trades: every executed signal, marked live',
  description: 'Open engine trades marked to the live price through the session, the book’s P&L across the day, and the next session’s decisions: enter, modify, exit or hold.',
  openGraph: { title: 'Trades: every executed signal, marked live', description: 'Open engine trades marked to the live price through the session, the book’s P&L across the day, and the next session’s decisions.', url: '/trades/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
