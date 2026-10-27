# Tripwire: refine into a launchable daily research app (owner brief, 27 Oct 2026)

Inspect the current repository and preserve the recent improvements, user data and engine rules. Prioritize the complete usage journey over adding more features.

1. FIRST USE. Replace the dashboard-first onboarding with: choose one company, view case/countercase, save an optional thought. Keep Skip and guest access. Never auto-follow companies. Explain local storage briefly at the first save, with backup access.
2. ADAPTIVE HOME AND MY DESK. Distinct new-user and returning-user states. New users see one useful setup action, not multiple zero-count panels. Returning users see meaningful changes, reviews due and a concise brief. Reveal journal/questions/plans sections when populated or intentionally opened.
3. APP SHELL. Prototype four primary destinations: Today, Discover, My Desk, More. Keep Signals easily accessible from More and relevant research screens; preserve existing routes and deep links. On mobile, accessible bottom navigation with safe-area spacing. On desktop, retain a compact sidebar. Preserve navigation history, filters, selected view and scroll position.
4. EDITORIAL POLISH. Remove the duplicated "What matters now" heading. Reduce repeated explanations and empty panels. Keep source freshness, experimental status and material uncertainty visible. Move infrastructure/configuration details out of consumer Profile. Keep account/sync limitations honest without presenting a feature graveyard.
5. RELIABILITY BEFORE LAUNCH. Diagnose delayed news and lagging screening jobs. Distinguish source publication time, successful refresh time and quote time. Verify backup/restore, app restart persistence and failed-save recovery. Do not label services working merely because they are configured.
6. APP FEEL. Use the supplied preview as hierarchy/interaction inspiration, not production content (no preview was attached to the message; none was used). Never ship fictional companies or stories. Readable proportional typography, restrained accents, clear selected states, brief transitions and reduced-motion support. Test sheets, keyboard overlap, touch targets and back navigation.
7. INSTALLABLE EXPERIENCE. Audit manifest, icons, standalone display, install guidance, offline states and service-worker updates. Implement missing pieces within the current stack. Do not claim native-app capabilities or working notifications without testing. Do not cache sensitive user data or stale market data indiscriminately.

ACCEPTANCE. A first-time user can find a company, understand its main risk, save a thought and find it again without assistance. A returning user can identify what changed and complete a review quickly. Test actual iPhone Safari/PWA where available; clearly mark unverified items. Deliver screenshots, journey test results, remaining blockers and a beta launch recommendation.

Also reported: Daily / Weekly / Monthly candles were not working (fixed in PR #41: Yahoo returned monthly bars for range=max).
Motion: the owner asked for zero motion by default (done in PR #41; prefs.motionV 2).
