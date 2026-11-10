# Tripwire workspace redesign

The previous presentation gave unrelated sections the same visual weight. A shared
`!important` surface rule also suppressed later card treatments. The old sector
map could omit names and changes when its proportional rectangles became narrow.

This release replaces that map with equal-sized, fully labelled sector tiles.
Each shows the dated turnover-weighted move, participation and share of traded
value. Ordering supports activity, strongest and weakest. A sector opens into
non-overlapping leaders and laggards; the full company grid and data table remain
available on demand. Equal areas no longer imply market size. The explanation
states the weighting, exclusion rules, minimum sample, source date and colour
saturation. Existing aggregation and eligibility calculations are unchanged.

The shared workspace has a full desktop navigation rail, clearer page headings,
separate summary and detail surfaces, larger index charts and a more prominent
Nifty panel on Today. Long company names have their own header row on phones.
Signals, paper positions, Follow, research, comparisons, news and the landing page
use the same typography, spacing and surfaces. The established palette and motion
preferences remain intact.

Full session charts now measure their container rather than stretching a fixed
small drawing. Price readouts and open/high/low/previous-close facts sit outside
the plot. Time-based geometry, real samples, reference levels, keyboard scrubbing,
partial-session coverage and table alternatives are preserved. A shrinking quote
array cannot leave the selected point outside its bounds.

No engine rules, position state, ledger data, saved research, storage schema or
exit behavior are changed. No new provider or generated financial claim is added.

Validation covers sector ordering and drill-down, visible labels at 320/390/1280,
chart readouts outside the plot, complete table coverage, existing user journeys,
the shared accessibility gate, type checking, unit tests and build budgets.
The market news worker test pins its clock to its existing dated fixture; this
prevents it failing when recorded headlines age out of the live pipeline.
