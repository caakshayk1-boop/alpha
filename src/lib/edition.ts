/** Editions of alpha. The same code builds two products:
 *    full  alpha.askakshay.com: every page, the research desk.
 *    app   the lean public app: the daily decision loop and nothing else (docs/app/README.md).
 *  The edition is fixed at build time (NEXT_PUBLIC_EDITION=app), so nothing here runs a branch at runtime and the full build is unchanged.
 *  A path outside the app is not a broken link: the app's host sends it to the same page on the full site (scripts/app-pack.mjs). */
export const FULL_SITE = 'https://alpha.askakshay.com';
export const APP = process.env.NEXT_PUBLIC_EDITION === 'app';

/** The pages that belong in the app: find a name, read its evidence, see the rules that fire, keep a desk, size a position. */
export const APP_ROUTES: readonly string[] = ['/', '/engines/', '/screen/', '/research/', '/compare/', '/tools/', '/desk/', '/watchlist/', '/journal/', '/about/', '/pro/', '/privacy/'];
export const APP_PREFIXES: readonly string[] = ['/company/'];

const norm = (p: string) => (p.endsWith('/') ? p : `${p}/`);
/** Is this address part of the app? Query strings and fragments are ignored. */
export const inApp = (href: string): boolean => {
  const p = norm(href.split(/[?#]/)[0] || '/');
  return APP_ROUTES.includes(p) || APP_PREFIXES.some((x) => p.startsWith(x));
};
/** In the full edition everything is "in"; in the app only the app's pages are. Use it to hide a link the app cannot show. */
export const here = (href: string): boolean => !APP || inApp(href);
