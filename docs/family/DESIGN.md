# The askakshay family: one design law (28 Nov 2026)

Alpha (alpha.askakshay.com) is the hub. Rulebook (lockedfree.), Tripwire (tripwire.) and ApexPro (apexpro.) are the tools.
This file records what the four already share on the live sites, measured on 28 Nov 2026, so the next change starts from
the shared base instead of a fifth palette. Each product keeps its own detailed DESIGN.md for its components; where one of those
disagrees with this file on the shared base below, this file wins.

## What is shared (measured, live)

| | Alpha | Rulebook | Tripwire | ApexPro |
|---|---|---|---|---|
| Canvas | graphite, `oklch(0.139 0.003 246)` ≈ `#08090A` | `#08090A` | `#08090A` | `#08090A` |
| Text | `oklch(0.955 0 0)` ≈ `#F0F0F0` | `#F0F0F0` | `#F0F0F0` | `#F0F0F0` |
| Brand / action | lime, `oklch(88.4% 0.20 126)` ≈ `#B8EF43` | `#B8EF43` | `#B8EF43` | `#B8EF43` |
| Gains / losses | mint / coral-red, always with a sign and a number | same | same | same |
| Caution / stale | amber | amber | amber | amber |

So the family is already one palette. **Products are told apart by name, address and job, never by a second brand colour.**
A per-product accent was considered and rejected: lime is the brand on all four, and green/red/amber already carry market
and data-state meaning, so any fifth hue would either collide with a meaning or need explaining.

## Rules

1. **One canvas, one lime.** Lime marks brand, focus and the primary action only. It never encodes gain, rank or quality.
2. **Structure is the ornament** (exposed grid, 27 Nov): hairline rules and ruled cells, square corners, dashed dividers between
   neighbours. No floating cards, glows or gradients behind data.
3. **No motion by default on the hub.** Since 28 Nov 2026 Alpha's Motion setting defaults to Off (`lib/prefs.ts`, set on `<html>`
   before first paint): nothing loops, animates in or counts up. A reader can choose Reduced or As the device in Settings.
   The family bar never moves on any site. Per-product motion rules (ApexPro Part D) stay with each product.
4. **Every state in words.** A colour dot is never alone: the text beside it says current, N sessions behind, not reached, or
   not published.
5. **Freshness has one rule.** "Current" means the dataset describes the session that should already be published
   (`expectedSession` in `src/lib/status.ts`, NSE holidays included). The hub's family block, /status/ and every data stamp use it.
6. **Missing stays missing.** A product that does not answer is "not reached", a date that cannot be read is "no date".
   Nothing is estimated or filled.
7. **Educational copy, no return claims.** Product descriptions say what a tool does, never what it earned or will earn.
   `tests/familyline.test.ts` fails on return words in the family copy.
8. **Every product carries the family.** A bar above each site's own header names the four products in one order (Alpha,
   Rulebook, Tripwire, ApexPro) and marks the current one with a lime underline; each footer repeats the four names.
   Same shape everywhere: 36px links (44px on touch screens), the site's own tokens, no script, hidden in print.
   Where it lives: Alpha `src/components/Shell.tsx`; Rulebook `src/components/FamilyBar.astro`; Tripwire
   `src/components/FamilyBar.tsx` (app shell and welcome screen); ApexPro `public/index.html`.

## The hub's own look (Bento, 28 Nov 2026)

The hub is the only one of the four that changed shape: every block is a tile (filled `--panel`, hairline border, 16px
corners, 16px gutters), Today opens with one oversized statement, and the family is the frame. The 27 Nov exposed grid
(rails, ruled cells, dashed dividers) is retired on the hub. Direction chosen with the ui-ux-pro-max skill ("Bento Box Grid"
plus "Exaggerated Minimalism" for the statement); its suggested palette, fonts and scroll motion were not adopted. All of it
is `src/app/revamp.css`, the last stylesheet, using existing tokens only.

## Where it lives

- Product list and the freshness line: `src/lib/family.ts` (one list for the Today block and the footer).
- Live data dates: `/api/family` (`worker/family.js`), read from each product's own published status, cached five minutes.
- Styles: the `.fam-*` and `.footer-family` rules at the end of `src/app/premium.css`, tokens only.

## Stale documents this supersedes on the shared base

- `docs/alpha/DESIGN.md` §2 proposes warm sand with violet. The live hub has been graphite with lime since the 27 Nov exposed-grid
  pass. Its component rules still apply; its colour primitives do not.
- `DESIGN.md` at the repository root (ApexPro) names terminal amber as the accent. ApexPro moved to lime on 19 Nov
  (`apps/apexpro/public/tokens.css`); amber is its caution colour. That file is ApexPro's to update under its own rules.
