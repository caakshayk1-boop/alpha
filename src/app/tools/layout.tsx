import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Decision tools and calculators',
  description: 'Position size from a stop, expected value of a plan, portfolio X-ray, reverse DCF, CAGR, loss recovery and SIP, each with its working shown.',
  openGraph: { title: 'Decision tools and calculators', description: 'Position size from a stop, expected value of a plan, portfolio X-ray, reverse DCF, CAGR, loss recovery and SIP, each with its working shown.', url: '/tools/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
