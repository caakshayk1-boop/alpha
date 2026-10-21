/** Reader preferences, each stored in this browser and applied as an attribute on <html> before first paint (the inline
 *  script in app/layout.tsx), so nothing flashes. None of them changes any data.
 *    theme      light | dark
 *    accent     violet (no attribute) | cyan | lime | coral: the highlight only
 *    motion     system (follow the device) | reduced (no movement, every state still shown in text) | off (no animation or
 *               transition of any kind, colour fades and page transitions included)
 *    market     standard (green/red) | cb (blue/orange, for colour-blind readers); direction is always also a sign and arrow
 *    density    comfortable | compact (tighter rows and padding)
 *    contrast   system (follow the device's "more contrast" setting) | high (stronger text, lines and focus rings)
 *    shortcuts  on | off (single-key shortcuts; never active while typing) */
export const PREFS = {
  theme: { key: 'alpha-theme', attr: 'theme', values: ['light', 'dark'], base: 'light' },
  accent: { key: 'alpha-accent', attr: 'accent', values: ['violet', 'cyan', 'lime', 'coral'], base: 'violet' },
  motion: { key: 'alpha-motion', attr: 'motion', values: ['system', 'reduced', 'off'], base: 'system' },
  market: { key: 'alpha-market', attr: 'market', values: ['standard', 'cb'], base: 'standard' },
  density: { key: 'alpha-density', attr: 'density', values: ['comfortable', 'compact'], base: 'comfortable' },
  contrast: { key: 'alpha-contrast', attr: 'contrast', values: ['system', 'high'], base: 'system' },
  shortcuts: { key: 'alpha-shortcuts', attr: 'shortcuts', values: ['on', 'off'], base: 'on' },
} as const;
export type PrefName = keyof typeof PREFS;

export function readPref(name: PrefName): string {
  if (typeof document === 'undefined') return PREFS[name].base;
  const v = document.documentElement.dataset[PREFS[name].attr];
  return v && (PREFS[name].values as readonly string[]).includes(v) ? v : PREFS[name].base;
}

export function setPref(name: PrefName, value: string) {
  const p = PREFS[name];
  if (!(p.values as readonly string[]).includes(value)) return;
  // the theme always carries its attribute (CSS keys on it); the others only when they differ from the default
  if (name === 'theme' || value !== p.base) document.documentElement.dataset[p.attr] = value; else delete document.documentElement.dataset[p.attr];
  try { localStorage.setItem(p.key, value); } catch { /* private mode: the choice lasts for this page only */ }
  window.dispatchEvent(new CustomEvent('alpha-prefs', { detail: name }));
}

/** The inline head script: the same rules, as a string, run before React. */
export const PREFS_SCRIPT = `try{var d=document.documentElement,P=${JSON.stringify(Object.fromEntries(Object.entries(PREFS).map(([, p]) => [p.key, [p.attr, p.values, p.base]])))};for(var k in P){var v=localStorage.getItem(k),a=P[k];if(v&&a[1].indexOf(v)>=0&&(a[0]==='theme'||v!==a[2]))d.dataset[a[0]]=v}if(!d.dataset.theme)d.dataset.theme='light'}catch(e){document.documentElement.dataset.theme='light'}`;
