/** One look, fixed: the terminal. No options. (The id stays 'aurora' because the home-screen icons are named for it.) */
export interface Theme { id: string; label: string; swatch: string; bar: string }
export const THEMES: Theme[] = [
  { id: 'aurora', label: 'Terminal', swatch: '#b8ef43', bar: '#0a0a0a' },
];
export const themeOf = (id?: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export function applyTheme(id?: string) {
  const t = themeOf(id); const r = document.documentElement; r.dataset.theme = t.id;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t.bar);
  document.querySelector<HTMLLinkElement>('link[rel=apple-touch-icon]')?.setAttribute('href', `/icons/${t.id}-180.png`);
  document.querySelector<HTMLLinkElement>('link[rel=icon]')?.setAttribute('href', `/icons/${t.id}.svg`);
}
