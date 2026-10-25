/** The route manifest (Pro §17, 21 Oct 2026): the ONE list of pages. The header, the phone tab bar, the More sheet, the
 *  footer, the command palette, the keyboard shortcuts and the release inventory all read it, so they cannot drift apart.
 *  Pure data, tested in tests/lib.test.ts. Every existing URL keeps working; areas only decide where a page is listed.
 *
 *  `desc` is the one line a menu shows under each page: what that page answers, never what to do with it. */

import { APP, inApp } from './edition.ts';

export type Area = 'today' | 'discover' | 'research' | 'desk' | 'utility';
export interface Page { href: string; label: string; desc: string; area: Area; icon: string; keys?: string }

/** Every page of the full site. */
export const FULL_PAGES: readonly Page[] = [
  { href: '/', label: 'Today', area: 'today', keys: 'g t', desc: 'What changed today, your names and the market in one view', icon: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z' },
  { href: '/brief/', label: 'Brief', area: 'today', keys: 'g b', desc: 'The day’s market read, section by section', icon: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5' },
  { href: '/markets/', label: 'Markets', area: 'today', keys: 'g m', desc: 'Indices, sectors, commodities, currencies and rates', icon: 'M3 17l5-6 4 3 8-9M16 5h4v4' },
  { href: '/news/', label: 'News', area: 'today', keys: 'g n', desc: 'Stories tied to the companies they name', icon: 'M4 5h13v14H6a2 2 0 01-2-2zM17 9h3v8a2 2 0 01-2 2M8 9h5M8 13h5' },
  { href: '/screen/', label: 'Screen', area: 'discover', keys: 'g s', desc: 'Nearly 1,000 companies filtered on quality, growth and value', icon: 'M4 6h16M7 12h10M10 18h4' },
  { href: '/map/', label: 'Heat lab', area: 'discover', desc: 'Every stock as a tile, coloured by the measure you pick', icon: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z' },
  { href: '/rotation/', label: 'Rotation', area: 'discover', desc: 'Which sector groups are gaining or losing relative strength', icon: 'M20 12a8 8 0 11-3-6.2M20 4v5h-5' },
  { href: '/ipo/', label: 'IPOs', area: 'discover', desc: 'Books open now, issues ahead and recent listings', icon: 'M12 3v18M5 10l7-7 7 7' },
  { href: '/funds/', label: 'Funds', area: 'discover', desc: 'Direct-plan funds by category: return against risk', icon: 'M12 3a9 9 0 109 9h-9zM15 3.5A9 9 0 0120.5 9H15z' },
  { href: '/calendar/', label: 'Calendar', area: 'discover', desc: 'Results dates on file, largest companies first', icon: 'M5 6h14v14H5zM5 10h14M9 3v4M15 3v4' },
  { href: '/research/', label: 'Research', area: 'research', keys: 'g r', desc: 'Look up a company, compare, read, and test a plan', icon: 'M10 4a6 6 0 104.5 10L20 19.5M10 7v6M7 10h6' },
  { href: '/compare/', label: 'Compare', area: 'research', keys: 'g c', desc: 'Two to four companies, every number in one table', icon: 'M7 4v16M17 4v16M3 8h8M13 16h8' },
  { href: '/reads/', label: 'Weekly reads', area: 'research', desc: 'Seven companies a week, across sectors, read from the numbers', icon: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM9 8h6M9 12h6' },
  { href: '/engines/', label: 'Signals', area: 'research', desc: 'Experimental research: one rule book, gated by the market', icon: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18M12 9a3 3 0 100 6 3 3 0 000-6z' },
  { href: '/trades/', label: 'Paper trades', area: 'research', desc: 'The signal book marked to the price: paper only, never a fill', icon: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
  { href: '/tools/', label: 'Tools', area: 'research', desc: 'Size a position, test a plan’s arithmetic, X-ray holdings', icon: 'M14 6l4 4-9 9H5v-4zM12 8l4 4' },
  { href: '/desk/', label: 'My Desk', area: 'desk', keys: 'g d', desc: 'What you track, what needs review, and what you concluded', icon: 'M4 5h16v11H4zM8 20h8M12 16v4' },
  { href: '/watchlist/', label: 'Watchlist', area: 'desk', keys: 'g w', desc: 'My Desk’s Following tab: your names and what changed since review', icon: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z' },
  { href: '/journal/', label: 'Journal', area: 'desk', keys: 'g j', desc: 'My Desk’s Journal tab: why you decided, and the price after', icon: 'M6 3h12v18H6zM9 7h6M9 11h6M9 15h4' },
  { href: '/about/', label: 'Method', area: 'utility', desc: 'Where each number comes from and how fresh it is', icon: 'M12 4a8 8 0 100 16 8 8 0 000-16zM12 11v5M12 8h.01' },
  { href: '/pro/', label: 'Pro — coming soon', area: 'utility', desc: 'Better tools, never calls: join the waitlist', icon: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z' },
  { href: '/privacy/', label: 'Privacy and terms', area: 'utility', desc: 'What is kept, where, and what is sent anywhere', icon: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z' },
];

/** The four primary areas, in order. `home` is where the area's own link goes. */
export const FULL_AREAS: readonly { id: Exclude<Area, 'utility'>; label: string; hint: string; home: string }[] = [
  { id: 'today', label: 'Today', hint: 'What changed and what matters today', home: '/' },
  { id: 'discover', label: 'Discover', hint: 'What deserves more research', home: '/screen/' },
  { id: 'research', label: 'Research', hint: 'What supports or weakens the case', home: '/research/' },
  { id: 'desk', label: 'My Desk', hint: 'What you track and what needs review', home: '/desk/' },
];

/** The app edition's four areas and where each page sits in them. Signals gets its own tab; discovery, research and comparison are one "Find". */
export const APP_AREAS: readonly { id: Exclude<Area, 'utility'>; label: string; hint: string; home: string }[] = [
  { id: 'today', label: 'Today', hint: 'The market and your names, in a minute', home: '/' },
  { id: 'discover', label: 'Signals', hint: 'Which stocks meet which rule today', home: '/engines/' },
  { id: 'research', label: 'Find', hint: 'Search, screen and compare companies', home: '/screen/' },
  { id: 'desk', label: 'My Desk', hint: 'What you follow, the evidence, your journal, your sizing', home: '/desk/' },
];
const APP_PLACE: Record<string, Area> = { '/': 'today', '/engines/': 'discover', '/screen/': 'research', '/research/': 'research', '/compare/': 'research', '/tools/': 'desk', '/desk/': 'desk', '/watchlist/': 'desk', '/journal/': 'desk' };
/** The app's pages, each placed in an app area (pure: tested for both editions). */
export const appPages = (pages: readonly Page[]): Page[] => pages.filter((p) => inApp(p.href)).map((p) => ({ ...p, area: APP_PLACE[p.href] ?? p.area }));

export const PAGES: readonly Page[] = APP ? appPages(FULL_PAGES) : FULL_PAGES;
export const AREAS = APP ? APP_AREAS : FULL_AREAS;

export const pagesIn = (a: Area) => PAGES.filter((p) => p.area === a);
export const pageOf = (href: string) => PAGES.find((p) => p.href === href);
const norm = (p: string) => (p.endsWith('/') ? p : `${p}/`);
/** The page a path belongs to: exact, or the longest prefix (/company/TCS/ belongs to Research). */
export function pageFor(path: string): Page | undefined {
  const p = norm(path);
  if (p.startsWith('/company/')) return pageOf('/research/');
  return PAGES.filter((x) => (x.href === '/' ? p === '/' : p.startsWith(x.href))).sort((a, b) => b.href.length - a.href.length)[0];
}
export const areaFor = (path: string): Area | undefined => pageFor(path)?.area;
export const isActive = (path: string, href: string) => (href === '/' ? path === '/' : norm(path).startsWith(href));

/** "g s" style shortcuts, from the manifest. */
export const SHORTCUTS: readonly { keys: string; href: string; label: string }[] = PAGES.filter((p) => p.keys).map((p) => ({ keys: p.keys!, href: p.href, label: p.label }));
