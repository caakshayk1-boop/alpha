import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Decision tools and calculators',
  description: 'Portfolio X-ray, reverse DCF, a confluence board, SIP, CAGR, position size and loss-recovery calculators that run in your browser.',
  openGraph: { title: 'Decision tools and calculators', description: 'Portfolio X-ray, reverse DCF, a confluence board, SIP, CAGR, position size and loss-recovery calculators that run in your browser.', url: '/tools/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
