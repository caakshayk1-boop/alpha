# Research Edition review — 16 November 2026

Confirmed: all eight inspiration jobs are adapted in BUILD-PLAN.md. ApexPro has no positions/fills/cost ledger; no P&L, expectancy, taken-trade or historical-crossing claims were added. Research events are local observations. The original Tripwire API audit is not treated as ApexPro evidence.

The seven-route Impeccable and Hallmark reports are under proof/. Review fixes: 44px histogram columns with local scrolling; full score names in drill-through; sector toggle focus retention; explicit source-date/close checkpoint wording; share-card overflow marked with an ellipsis; 11px minimum new metadata; larger prose in source reasons/footnotes; tablet table overflow fixed by positioning its scroll container; nonwrapping home CTA; chapter sticky offset corrected to 64px; original audit stamp retained through CSS compilation.

Intentional detector exceptions, governed by DESIGN.md:
- Inter, Fraunces and the single italic masthead word are the specified type system, despite generic overused-font / italic-serif-display warnings.
- 11px date/caption metadata is the explicit type scale. Full paragraphs use larger type. The tiny-text detector has a higher generic threshold.
- Grouped density/chart controls are not nested content cards.
- Market dial and score-field SVG are labelled quantitative instruments, not decorative illustrations. Dense chart dots have a keyboard selection interface and adjacent full-size research link; dots are not claimed to be 44px controls.
- Tall sector/gap/histogram controls encode data and exceed generic marketing-control height rules intentionally.
- Compact geometry includes 6/10/14px gaps; a universal 4px spacing lint does not override the project law.
- Mobile removes redundant sidebar prose and sector-count column; equivalent navigation and labelled coverage remain in the source views.
- Mono data inherits tabular numerals; Hallmark's per-selector warning misses inherited declarations.
- Source and methodology copy may span a long caption line; About prose is constrained to 72ch.

Build budget decision: the owner authorized overriding earlier rules to deliver the expanded feature set. This release explicitly raises the previous raw CSS cap from 60,000 to 62,000 bytes and application JS from 122,000 to 126,000 bytes; vendor cap stays 90,000 bytes gzip. Actual measurements are in proof/payload.json. CSS source now lives in src/app.css and compiles into the same one shipped app.css; tokens.css remains the only token authority. Lazy PNG/reel modules share a generated chunk included in the SW shell. No framework or external runtime was added.

Controlled desktop Lighthouse, captured data and gzip: v8 70 vs v9 67; LCP 4991 vs 4964ms; CLS .0747 vs .0869; TBT 23 vs 29ms. Transfer 725,030 vs 734,089 bytes. This is a small overall regression, accepted for the new tools, not represented as a performance win or production field telemetry. The existing large screen API remains out of scope.

Security checks: unchanged worker hash and CSP; no CDN scripts; bounded and normalized local trail inputs; escaped source text; strict symbol validation; safe backup merge tested; PNG exports omit private notes. No authentication, payment, email capture or new external data destination was introduced. This is a scoped check, not a claim of an external security certification.

Motion retains the established Part D inventory: route/shared transitions, one-shot dial/sector/evidence entry, list/compare continuity and open-session pulse. No added decorative looping animation. Both engines verify reduced motion remains static and usable.

Final Hallmark run: zero FAIL on all seven routes; REFLEX/WARN items remain under the explicit decisions above. Axe final sweep: zero WCAG A/AA violations in 28 route/viewport/palette combinations. Chart regression passes in Chromium and WebKit, including weekly/monthly intervals, RSI period/toggle, divergence overlays, benchmark and unsaved-note retention.
