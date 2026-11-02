/** The one place a support address would live. It is EMPTY on purpose: the owner supplies it (a plain address such as help@example.com), rebuilds, and the Privacy and Terms pages
 *  then show it as a mailto link. Until then they say "Contact: not set up yet" and nothing is invented. static/.well-known/security.txt is published only once this is set (see build.mjs). */
export const SUPPORT_EMAIL = '';

export interface ContactView {
  /** the sentence the page prints */
  line: string;
  /** the address, only when it is well-formed and non-empty */
  email: string | null;
  /** `mailto:` link target, or null when there is no address */
  href: string | null;
}
const WELL_FORMED = /^[^\s@<>()"',;:\\]+@[^\s@<>()"',;:\\]+\.[^\s@<>()"',;:\\]{2,}$/;
/** What the pages show for contact. A blank or malformed address is treated as "not set up", never rendered as a broken link. */
export function contactView(email: string = SUPPORT_EMAIL): ContactView {
  const e = String(email ?? '').trim();
  if (!e || e.length > 254 || !WELL_FORMED.test(e)) return { line: 'Contact: not set up yet', email: null, href: null };
  return { line: `Contact: ${e}`, email: e, href: `mailto:${e}` };
}
