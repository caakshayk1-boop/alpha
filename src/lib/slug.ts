/** Company URLs: /company/<slug>/. A symbol's "&" (M&M, J&KBANK) becomes "_" so the path needs no escaping; no NSE symbol in
 *  the screen contains "_" (checked 15 Oct 2026, 990 symbols), so the mapping is reversible. */
export const symToSlug = (sym: string) => sym.toUpperCase().replace(/&/g, '_');
export const slugToSym = (slug: string) => decodeURIComponent(slug).toUpperCase().replace(/_/g, '&');
export const companyHref = (sym: string) => `/company/${symToSlug(sym)}/`;
