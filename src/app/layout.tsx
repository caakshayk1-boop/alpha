import type { Metadata, Viewport } from 'next';
import { Inter_Tight, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import Shell from '@/components/Shell';
import './globals.css';

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });
const ui = Inter_Tight({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL('https://alpha.askakshay.com'),
  title: { default: 'alpha — Indian equity research desk', template: '%s · alpha' },
  description: 'One screen for Indian markets: a live board, nearly 1,000 companies screened on quality, growth and value, weekly company studies, IPOs, funds and the news that touches them.',
  openGraph: { title: 'alpha — Indian equity research desk', description: 'Live board, a screen of nearly 1,000 companies, weekly studies, IPOs and funds. Working shown.', url: 'https://alpha.askakshay.com', type: 'website' },
  alternates: { canonical: 'https://alpha.askakshay.com' },
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/icons/favicon-32.png', sizes: '32x32' }, { url: '/icons/icon-192.png', sizes: '192x192' }], apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'alpha', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: [{ media: '(prefers-color-scheme: dark)', color: '#07090c' }, { media: '(prefers-color-scheme: light)', color: '#f6f5f1' }], width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Runs before first paint so there is no flash of the wrong theme.
const themeScript = `try{var t=localStorage.getItem('alpha-theme');if(!t)t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" className={`${display.variable} ${ui.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
