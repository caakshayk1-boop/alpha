import { createRoot } from 'react-dom/client';
import { Component, type ReactNode } from 'react';
import { App } from './app.tsx';
import { followSystemTextSize } from './dyntype.ts';
import { registerWebMcp } from './webmcp.ts';
import { registerSw } from './pwa.ts';

class Boundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  render() {
    return this.state.err ? <div className="welcome"><h1>Something <em className="ed">broke</em>.</h1><p className="dim">Your notes are safe on this device. Reload to continue.</p><button className="btn pri" onClick={() => location.reload()}>Reload</button></div> : this.props.children;
  }
}
/** The full stylesheet is loaded without blocking first paint (the build inlines the first-viewport rules and ships the rest as media="print"). Switch it on, and draw the app once it has
 *  arrived, or after 1.5 s whichever is first, so a slow connection shows the boot splash rather than an unstyled page. With no such link (dev, tests) it draws at once. */
function fullStyles(): Promise<void> {
  const l = document.querySelector<HTMLLinkElement>('link[data-full-css]'); if (!l) return Promise.resolve();
  return new Promise((done) => { const fin = () => done(); if (l.sheet) { l.media = 'all'; fin(); return; } l.addEventListener('load', () => { l.media = 'all'; fin(); }, { once: true }); l.addEventListener('error', () => { l.media = 'all'; fin(); }, { once: true }); setTimeout(() => { l.media = 'all'; fin(); }, 1500); });
}
void fullStyles().then(() => createRoot(document.getElementById('root')!).render(<Boundary><App /></Boundary>));
followSystemTextSize();
registerWebMcp();
registerSw();
