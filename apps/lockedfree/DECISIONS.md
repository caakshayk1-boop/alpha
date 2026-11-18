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
