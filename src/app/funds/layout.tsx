import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Direct-plan funds: return against risk',
  description: 'Direct plan mutual funds by category on annualised returns, worst fall, volatility and rolling three-year results, from AMFI NAV history.',
  openGraph: { title: 'Direct-plan funds: return against risk', description: 'Direct plan mutual funds by category on annualised returns, worst fall, volatility and rolling three-year results, from AMFI NAV history.', url: '/funds/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
