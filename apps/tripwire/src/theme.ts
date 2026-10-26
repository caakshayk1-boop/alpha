/** Accent themes. Each one changes the colour of the app, the browser bar and the icon the page offers to the home screen. iPhone and Android
 *  take the icon at the moment you add the app to the home screen, so a different theme needs adding it again: the page cannot swap the
 *  icon of an app already installed. */
export interface Theme { id: string; label: string; swatch: string; bar: string }
export const THEMES: Theme[] = [
  { id: 'aurora', label: 'Aurora', swatch: 'linear-gradient(135deg,#c8f23c,#35e0d0)', bar: '#0b0d07' },
  { id: 'ocean', label: 'Ocean', swatch: 'linear-gradient(135deg,#35e0d0,#58a8ff)', bar: '#070d0e' },
  { id: 'violet', label: 'Violet', swatch: 'linear-gradient(135deg,#b39bff,#ff6fa8)', bar: '#0b0911' },
  { id: 'sunset', label: 'Sunset', swatch: 'linear-gradient(135deg,#ffb02e,#ff6fa8)', bar: '#0f0b07' },
  { id: 'rose', label: 'Rose', swatch: 'linear-gradient(135deg,#ff7eb3,#b39bff)', bar: '#100912' },
];
export const themeOf = (id?: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export function applyTheme(id?: string) {
  const t = themeOf(id); const r = document.documentElement; r.dataset.theme = t.id;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t.bar);
  document.querySelector<HTMLLinkElement>('link[rel=apple-touch-icon]')?.setAttribute('href', `/icons/${t.id}-180.png`);
  document.querySelector<HTMLLinkElement>('link[rel=icon]')?.setAttribute('href', `/icons/${t.id}.svg`);
}
