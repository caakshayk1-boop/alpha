# News reading, 8 November 2026

The shared story row on Today, News and company pages shows one headline, primary
source and publication age. Company symbols lead to the existing research page.
Additional coverage, collection timestamps, permitted publisher descriptions and
ranking calculations are available in Evidence & context; unknown publication
times remain explicit in the collapsed row. No generated sentiment or causal
claim is added.

Today and company news have a remembered Minimise control. Today keeps feed health
and pending update counts visible and does not mark hidden headlines as read.
Show summaries is a separate reading preference shared by Today and the archive;
it only reveals descriptions already permitted by the pipeline. Preferences use
separate `tripwire:news:*` storage keys and tolerate unavailable browser storage.
They do not modify follows, thesis versions, positions or paper history.

The archive has one freshness statement. Check timestamps and count definitions
remain available in disclosures. Company news omits the repeated company label
and admission-rule paragraph. Same-ID and shared-link events now combine their
source coverage rather than discarding additional evidence. Different event
figures, companies and event types retain the existing grouping safeguards.

Validation includes source preservation/idempotence, archive filtering and both
clocks, unknown timestamps, refresh failure states, persisted reading settings,
hidden-news read-state protection, unchanged research storage and 320/390/1280px
layouts. Existing accessibility and production build gates also apply.
