# Design audit decisions

The user's explicit design law takes precedence over generic skill defaults.

- Impeccable `overused-font` and `italic-serif-display`: Inter and Fraunces with a restrained italic display word are explicitly required by Part C.
- `tiny-text`: the specified 11px caption tier is retained for timestamps, methodology and auxiliary metadata; functional text below 11px was raised. Primary prose uses 13–15px.
- `nested-cards`: these hits identify segmented chart/density controls inside panels, not redundant content cards. Grouped controls remain for keyboard and visual clarity.
- `line-length`: ladder methodology and Desk source notes were constrained after the scan.
- `skipped-heading`: empty-state headings were changed from h3 to h2 after the scan.
- `unbalanced-heading` / `straggler`: text-wrap: pretty and balanced empty-state headings were applied; company/source wording remains verbatim.
- Sector contrast findings came from partially opaque entrance states. Sector entrance now uses translation only, keeping all data at full contrast.
- Hallmark 24b: the product's existing compact control geometry is retained; generic marketing 4px-only spacing is not the governing design law.
- Hallmark 38i / 38iii: the single italic lime word is an explicit requested brand treatment.
- Hallmark 39b: sector tiles are data areas proportional to company counts; they deliberately exceed ordinary button height.
- Hallmark 49b: the methodology link can wrap at intermediate sidebar widths and keeps its full 44px hit area.
- Hallmark 75: 11px caption tier is explicitly specified; functional text below it was fixed.
- Hallmark 80: the dial is a labelled data instrument, not a decorative illustration.
- Hallmark F25: mobile hides the redundant desktop sidebar and radar explanatory aside. The same navigation, sources and methodology remain available through the bottom bar, top settings button and footer.
- Hallmark F6: data uses Mono with tabular numerals; warnings missed shared selectors rather than finding proportional figures.
- Repeating hatch advisory: hatch means missing sector returns, explicitly required by U5.

Final Hallmark browser runs: zero FAIL on all seven routes. Screens include 1440 desktop and 375 mobile (the linter's fixed mobile size); the independent browser suite additionally captures the required 390px width.
Final independent axe checks: zero WCAG A/AA violations on seven routes × two widths × both colour palettes.

Radar dots remain dense chart marks with keyboard names and an equivalent full-size company list in Discover. They are an explicit exception to the blanket 44px target claim, not claimed as 44px buttons. Ordinary action controls, navigation, form fields and chart controls are 44px or taller.
