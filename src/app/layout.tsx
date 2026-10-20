import type { Metadata, Viewport } from 'next';
import { Inter_Tight, Instrument_Serif } from 'next/font/google';
import Shell from '@/components/Shell';
import './globals.css';

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });
const ui = Inter_Tight({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL('https://alpha.askakshay.com'),
  title: { default: 'alpha — Indian equity research desk', template: '%s · alpha' },
  description: 'One screen for Indian markets: a live board, nearly 1,000 companies screened on quality, growth and value, weekly company studies, IPOs, funds and the news that touches them.',
  openGraph: { title: 'alpha — Indian equity research desk', description: 'Live board, a screen of nearly 1,000 companies, weekly studies, IPOs and funds. Working shown.', url: 'https://alpha.askakshay.com', type: 'website' },
  alternates: { canonical: './' },
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/icons/favicon-32.png', sizes: '32x32' }, { url: '/icons/icon-192.png', sizes: '192x192' }], apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'alpha', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: '#f5f3ee', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Start the first data a page waits on while its JavaScript is still downloading, and let lib/data.ts pick up the same
// requests (window.__alphaPre) instead of fetching again. Today: the summary and the Barometer. A company page: its live slice
// and the default 1-year chart, under the exact URLs the page itself requests ("_" in the address is "&" in the symbol).
const prefetchScript = `try{var L=location.pathname,u=[];if(L==='/')u=['/api/summary','/data/barometer.json'];else{var m=/^\\/company\\/([A-Za-z0-9_-]{1,20})\\/$/.exec(L);if(m){var s=encodeURIComponent(m[1].toUpperCase().replace(/_/g,'&'));u=['/c/'+s+'.json','/api/chart?s='+s+'&r=1y']}}if(u.length){var p=window.__alphaPre={};u.forEach(function(x){p[x]=fetch(x).then(function(r){if(!r.ok)throw new Error(x+' answered '+r.status);return r.json()});p[x].catch(function(){})})}}catch(e){}`;

// Runs before first paint so there is no flash of the wrong theme. Light is the default (v3); a reader who chose dark keeps it.
// The reader's accent (violet unless they picked another) is applied the same way, for the same reason.
const themeScript = `try{var t=localStorage.getItem('alpha-theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light';var a=localStorage.getItem('alpha-accent');if(a==='cyan'||a==='lime'||a==='coral')document.documentElement.dataset.accent=a}catch(e){document.documentElement.dataset.theme='light'}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" className={`${display.variable} ${ui.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: prefetchScript }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
