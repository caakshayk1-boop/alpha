import { createRoot } from 'react-dom/client';
import { Component, type ReactNode } from 'react';
import { App } from './app.tsx';

class Boundary extends Component<{ children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  render() {
    return this.state.err ? <div className="welcome"><h1>Something <em className="ed">broke</em>.</h1><p className="dim">Your notes are safe on this device. Reload to continue.</p><button className="btn pri" onClick={() => location.reload()}>Reload</button></div> : this.props.children;
  }
}
createRoot(document.getElementById('root')!).render(<Boundary><App /></Boundary>);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* offline shell is optional */ }); });
