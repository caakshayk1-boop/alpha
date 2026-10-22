import '../support.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sector rotation: how sector strength is changing',
  description: 'A Relative Rotation Graph for every benchmark group against the Nifty, with tails, a time machine and breadth. Relative price strength, not money flows.',
  openGraph: { title: 'Sector rotation: how sector strength is changing', description: 'A Relative Rotation Graph for every benchmark group against the Nifty, with tails, a time machine and breadth. Relative price strength, not money flows.', url: '/rotation/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
