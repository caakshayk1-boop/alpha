import type { Metadata } from 'next';
import '../signals.css';

const t = 'Signals: setups, paper record, method and validation';
const d = 'Swing v2 runs a market-gated paper book with a two-target plan; the v3 engines are research. Each family keeps its own lifecycle, evidence date and record, and alerts stay off until validation passes.';
export const metadata: Metadata = { title: t, description: d, openGraph: { title: t, description: d, url: '/engines/', type: 'website' } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
