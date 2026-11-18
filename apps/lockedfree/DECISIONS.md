# Rulebook — decisions (ADRs)

Changes to screen rules, ledger accounting, or Gate mechanics after Step 1 approval need an entry here first.

## ADR-001 — Astro static site, own package.json (proposed 2026-11-18)
Astro 7 static output on a Cloudflare Worker with assets, in `apps/lockedfree/` with its own manifest. The root manifest is Next.js 14 and serves Alpha; mixing would risk both builds. Rejected: Next.js, extending Tripwire's esbuild build.

## ADR-002 — React only inside base-ui islands (proposed, needs owner decision D5)
base-ui is React-only. Everything else is vanilla TS custom elements. Trade-off: ~40 KB gzip of React on Gate and Plan pages versus hand-building accessible primitives.

## ADR-003 — Two ledger scopes (proposed)
Public `rulebook-ledger/1` (built nightly) and per-visitor `rulebook-book/1` (browser only), sharing one `accounting.ts`. No accounts, no server-side user trades.

## ADR-004 — Anime.js and swup declined (proposed)
GSAP covers all sequences; native View Transitions on a static site make swup unnecessary.

## ADR-005 — Colour never carries direction alone (proposed)
Measured: the prompt's Up/Down differ in luminance by 0.003 (1.19:1 under simulated deuteranopia). Refined shades plus mandatory sign and icon, lint-enforced. Separate text-safe `down-ink` and `warn-ink`.

## ADR-006 — Pick mechanics and R definition (proposed, needs owner decision D2)
Entry next session open after first appearing; exit next open after first failing run; R measured against a fixed 20% initial stop, declared on each methodology page.

## ADR-006 addendum (Step 2, 2026-11-18)
Pick status gains `pending` (listed, entry fill not yet possible). A pick dropped while pending is voided with a reason. Stop is checked from the entry day's own low. A repeated run is a no-op. Charges version `in-delivery-1`: rates are starting values and must be verified against the NSE/SEBI/government schedules before launch.

## ADR-007 — pqoqubbw animated icons declined; book days carry `committed` (2026-11-18)
The animated icon set is built on React + the `motion` package; adding that to every page for hover effects costs more than it earns. Nav and feature icons are plain Lucide with a CSS hover transform (120ms, reduced-motion aware). `committed` was added to `book_days` before any real row existed, so charts can show return against notional put to work.

## ADR-008 — React only on the Gate and Plan pages, mounted by our own script (2026-11-18)
Not Astro islands: islands inject inline bootstrap scripts that a strict CSP forbids. Gate and Plan are React apps built on `@base-ui/react`, loaded as external module scripts. Every other page ships no React.

## ADR-009 — Strict CSP kept; chart attribution is a footer link (2026-11-18)
`style-src 'self'` with no inline anything. lightweight-charts injects an inline `<style>` for its attribution logo, which the CSP blocked. The logo is switched off (`attributionLogo: false`) and the library's required attribution is a text link to tradingview.com in the footer of every page.
