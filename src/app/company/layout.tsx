import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Company research',
  description: 'One company: chart with trend line, scores, the evidence for and against, financials, ownership and look-alikes, every figure dated and sourced.',
  openGraph: { title: 'Company research', description: 'One company: chart with trend line, scores, the evidence for and against, financials, ownership and look-alikes, every figure dated and sourced.', url: '/company/', type: 'website' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
