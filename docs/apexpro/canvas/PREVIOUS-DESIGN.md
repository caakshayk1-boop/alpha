# ApexPro — The Evidence Observatory

## Purpose
An instrument for independent equity research. Observe → Investigate → Revisit.

## Visual identity
One warm-black surface system, lime for navigation, mint/orange for evidence, cyan for comparison. Measured geometry replaces decorative glow.

 — THE DESIGN LAW (one identity, written into DESIGN.md in Step 1)

Name: **The Evidence Observatory** — a calm, dark instrument for looking at companies the way an observatory looks at the sky: one lens, everything measured, nothing decorated without a reason.

## C1. Tokens (the ONLY `:root` that survives — `tokens.css`)

```css
:root{
  color-scheme:dark;
  --bg:#0A0A0B;            /* warm near-black — from terminal.css, the strongest generation */
  --sidebar:#101012;
  --surface:#151517;
  --surface-2:#1C1C1F;
  --line:#29292E;
  --line-strong:#3B3C42;
  --ink:#F4F6FA;
  --muted:#A7AFBC;
  --caption:#929AA7;
  --accent:#CCFF43;        /* brand lime — brand ONLY, never a data colour */
  --accent-ink:#131503;
  --up:#3DDC97;            /* mint — gains, positive evidence */
  --down:#FF6A4D;          /* orange-red — losses, negative evidence (never pure red) */
  --amber:#FFC24B;         /* caution / held / stale */
  --compare:#77C9E5;        /* comparison series — from session.css, its one good idea */
  --gold:#EFC47A;          /* session gold, demoted: premium/print accents only */
  --radius:16px; --radius-s:10px;
  --dur-1:120ms; --dur-2:200ms; --dur-3:320ms; --dur-page:420ms;
  --ease:cubic-bezier(.22,1,.36,1);          /* easeOutQuint family — Emil Kowalski standard */
  --ease-morph:cubic-bezier(.32,.72,0,1);    /* shared-element morphs */
  --shadow:0 8px 32px rgba(0,0,0,.53);
}
:root[data-colorblind="true"]{ --up:#5AAEFF; --down:#FFA040; }   /* existing behaviour, preserved */
```

Light theme: **deleted, honestly.** `terminal.css` already force-kills it; pretending it exists is a bug, not a feature. If a light theme ever ships, it ships as a full token set in one place — not as a sixth layer.

## C2. Type (one scale, three voices)

- **Display — Fraunces** (self-hosted, existing files): headlines ≥24px only, italic for the one emphasised word. This is ApexPro's editorial signature — no other AK product uses a serif display face. Keep it, use it *less*, mean it more.
- **UI — Inter var** (upgrade the existing 400–600 static cuts to the variable file, self-hosted): all interface text, 11/12/13/15px scale, `-0.01em` tracking at 15px+.
- **Data — Mono** (existing `/mono.woff2`, renamed in tokens as `--font-data`): every number, `font-variant-numeric: tabular-nums`, no exceptions — a price that jitters sideways on refresh is a bug.
- Scale: 11 caption · 12 small · 13 body · 15 lead · 20 h3 · 28 h2 · clamp(38px, 4.3vw, 64px) h1 (the Atelier hero size — the one thing Atelier got exactly right).

## C3. Icons (one sprite, one grid)

- Single inline SVG sprite (`/icons.svg`), 24×24 grid, 1.5px stroke, round caps — Lucide discipline. ~28 icons needed: search, desk, discover, compare, settings, about, chart, shield (vet), ladder, sector, sun/moon of market session, arrow-up-right, x, check, alert, clock, download, share, bookmark, plus, filter, calendar, eye, layers, target, book, zap, chevrons.
- **Banned:** unicode arrows/✕/↗ as icons, emoji in UI, per-module icon helpers. The brand mark (`icon.svg` pulse-ladder) stays untouched.

## C4. Layout

- Reading width 760px · data width fluid to 1440px · sidebar collapsible to 64px rail (terminal.css already implements this — keep its mechanism, restyle to tokens).
- Home is **one river, top to bottom, each story told ONCE** (Part E, U1 defines the order — this kills the A5 duplication).
- Mobile: bottom tab bar (exists), 390px is a first-class target, not an afterthought — every acceptance screenshot is taken at 1440 AND 390.

---


## Components
One evidence stack, one market dial, count-weighted sector tiles, paired ratio bars, keyboard command dialog.

## Motion
420ms shared-element navigation; 320ms instrument entry; 150ms list changes; 120ms hover. Reduced motion disables all choreography.

## Accessibility
44px controls, visible focus, text alongside colour, keyboard chart/scrubber, native dialog focus trap.

## Honesty
Dates and confidence travel with evidence. No invented missing values. Fundamentals never time-travel.

## Research Edition / 16 November 2026
Tripwire 5 inspiration adapts to research, not position accounting. The new visual signature is a ruled editorial workspace: prominent date/coverage masthead, compact participation instrument, directly explorable score field, cohort trace controls, a chronological research trail, and company chapters. Avoid repeated rounded-card grids and oversized empty hero space. The colour/font tokens remain authoritative; new surfaces use the same tokens. Real published evidence is the visual material. No stock illustration, fake activity, fabricated ledger or unconnected email-capture form.

## Focus refinement / 16 November 2026
Owner requested less evidence overload, cleaner sector presentation and Kokonut UI typography/widgets. This refinement supersedes earlier serif UI and saturated colour guidance: self-hosted Geist variable is the UI and heading face, existing Mono remains for measurements. Geist was confirmed in Kokonut's served CSS; its font is locally served with the SIL license. No React, Tailwind or external runtime added. Restrained sage is navigation, blue is score comparison, mint/peach indicate signed returns, amber indicates caution; signs and labels accompany colour. Values remain defined only in tokens.css.

Home defaults to breadth and one score distribution. Detailed scatterplot and evidence gaps are native keyboard-accessible disclosures. Sector pulse defaults to a common-zero ranked bar view with coverage below each sector name; the area map remains optional. Existing route motion/reduced-motion behaviour is preserved, with no new looping decoration. Source data and research functions stay intact.
