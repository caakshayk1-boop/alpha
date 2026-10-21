# Mobile and responsive matrix (Pro §15)

Branch `alpha-pro`, 21 Oct 2026. Built with `npm run build`, served by the real Worker (`wrangler dev --local`),
driven by Playwright with Chromium 1194 (desktop Chromium with a phone-sized viewport and touch off: this is **viewport
emulation, not a device**). Live prices are unavailable in this container, so live-price states were not exercised;
feeds came from the real data repositories.

PASS / FAIL / BLOCKED / NOT RUN.

## Automated layers

| Layer | Coverage | Result |
|---|---|---|
| Overflow, page errors, broken text (NaN / undefined / [object Object]) | 24 route templates × 390 and 1366 px × light and dark | PASS: no overflow, no page or console errors, no broken text |
| axe (serious and critical) | the same routes, 390 light, 1366 light and dark | PASS after fixes. Found and fixed: `aria-prohibited-attr` on the new spoken change labels (and two older spans) |
| Overflow at more widths | 14 key routes × 360, 430, 768, 1024 px | PASS after fixes. Found and fixed: the new Privacy table overflowed at every width (global table min-width and nowrap) |
| Keyboard: palette | Open with `/`, Shift+Tab twice | PASS: focus stays inside the dialog (phone and desktop) |
| Keyboard: shortcuts | `g` `s` from Today | PASS: lands on /screen/ |
| Dialog contract | instrument sheet, quick look, palette, settings, More | PASS (source and the palette check): one shared hook, `inert` background |
| Reduced motion | site setting and device setting | PASS (source): both zero the motion tokens; GSAP reads the same check at call time |
| Firefox, WebKit engines | | NOT RUN: only Chromium is installed here |
| Slow network, offline, blocked storage | | PARTIAL: failed refreshes keep data and flag it (A12); blocked storage reports "not saved" (A09). Not scripted |

Screenshots of the representative layouts (Today, Research, My Desk, Privacy, Company, Screen, palette, settings, phone
More sheet), phone and desktop, were reviewed during the work; they are not committed (they contain no private data,
but they go stale with the next data build).

## Physical devices: BLOCKED

No phone is attached to this session. Owner checklist, about 15 minutes per device:

| # | On an iPhone (Safari) and an Android phone (Chrome) | Expect |
|---|---|---|
| 1 | Open https://alpha.askakshay.com/, rotate to landscape and back | No sideways scroll; the bottom bar clears the home indicator |
| 2 | Tap More → Search, type `tcs`, open TCS | The keyboard does not cover the results; the company opens |
| 3 | On TCS: Watch, then open My Desk from the bottom bar | "Saved to your watchlist, in this browser"; TCS listed on My Desk |
| 4 | Back to TCS, tap S and ? on a Case point | Source and definition open under the point |
| 5 | Markets → tap Nifty 50 → scroll inside the sheet → Close | The page under it did not scroll; focus returns to the card |
| 6 | Screen → Templates → "Banks earning their capital" | Only banks; the clause note explains how banks are read |
| 7 | Tools → position size: type blank, 0, −5, 1e9 | Each gives a plain error, never NaN or Infinity |
| 8 | Settings (More → Settings): Blue / orange, Reduced motion, Compact | Up is blue, down orange; nothing moves; rows tighter |
| 9 | Background the browser for 10 minutes, return | Figures refresh; nothing shows as fresher than it is |

Record the device, OS and browser version beside each result. Until then this gate stays BLOCKED.
