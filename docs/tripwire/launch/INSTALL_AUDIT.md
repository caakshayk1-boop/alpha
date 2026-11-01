# Tripwire: installable-app audit (27 Oct 2026)

Scope: the app shell, the web manifest, the service worker, install guidance. Automated checks are in `apps/tripwire/tests/shell.mjs` (Chromium, served build). **Nothing here was run on a real iPhone, a real Android phone or an installed PWA.** Where a line says "unverified" it is.

Note: the brief pointed at `docs/tripwire/TRIPWIRE_Launchable_2026-10-27.md`; that file is not in the repository, so sections 3, 6 and 7 were taken from the task text and `docs/tripwire/revamp/REVAMP_REPORT.md`.

## Found, and what was done

| # | Found | Fix |
|---|---|---|
| 1 | Five tabs (Today, Discover, Signals, My Desk, Profile). | Four: Today, Discover, My Desk, More. Signals and Profile (now titled Settings) are rows in More; every old link still opens and highlights the right tab (`shell.mjs` opens 25 of them). |
| 2 | The service worker called `skipWaiting()` at install, so a new version replaced the old one under a running page. There was no way to tell the person. | New version waits. `Update ready` bar with a Reload button. Reload is refused for 10 s after typing in a field, while a field has focus, and while a sheet is open. It reloads only after the person taps it. |
| 3 | Only `/`, the manifest, one icon and one font were precached. Scripts and the lazy screen chunks were cached only if fetched after the worker took control, so the first offline reload could find no script. | `build.mjs` injects every hashed script, style and font into the precache list (32 files). Offline reload of the shell is tested. |
| 4 | `manifest.start_url` was `/?source=pwa`, no `id`, `orientation: portrait` forced. | `id` and `start_url` are `/`, no orientation lock (tablets and desktop windows), `lang`, `categories`, shortcut icons added. Theme and background colours stay `#0a0a0a`, which is the real page background. |
| 5 | iOS head tags: `apple-mobile-web-app-capable` and the status-bar style existed; no app title, no format-detection. | Added `apple-mobile-web-app-title`, `mobile-web-app-capable`, `format-detection`. A root `/apple-touch-icon.png` (the default path iOS probes) now answers; the head still points at `/icons/aurora-180.png` (180 x 180). |
| 6 | No install guidance anywhere. | In More only: an Install button where the browser offers `beforeinstallprompt` (Android Chrome, desktop Chromium), a "Share, then Add to Home Screen" hint on iPhone and iPad. Nothing is shown when already installed (`display-mode: standalone` or `navigator.standalone`) or when the browser offers no way to install. Tested hidden in standalone, including a late install event. |
| 7 | Tab bar: sized for five, pill position computed in JS at render. | Four columns, `--i` custom property drives the pill, side safe-area insets added, bottom inset was already in place. Targets are 90 x 46 px on a phone, 76 x 66 px in the desktop sidebar. |
| 8 | Switching tabs lost the place (everything but Discover). | Each tab remembers its last location (My Desk segment, More page) and the scroll of every screen left by a tab tap, Back or Forward. Tapping the tab you are in scrolls to the top; at the top it returns to the tab's first screen. Today remembers only Today (Markets and News are pages opened from it). Restore keeps re-applying for 1.2 s because the browser's scroll anchoring otherwise carried a lazily growing page past the saved place; any touch, wheel, key or pointer press cancels it. |

## Checked and already right

- `/api/*` is never cached or replayed by the worker (it returns before `respondWith`). Tested: no `/api` URL in any cache before or after calling it, and offline a price request **fails** rather than returning a saved copy.
- `/data/*` (published screen, signals, studies) is network-first with the last good copy as the offline fallback. The page already says "Offline: showing the last saved copy, data through <date>" and shows the data's own as-of date.
- Nothing the person writes reaches the worker: notes, plans and trades are in `localStorage`.
- `sw.js` and the HTML are `Cache-Control: no-cache`; hashed assets are immutable (`_headers`).
- Maskable icon keeps the glyph inside the safe zone (viewed). 192, 512, maskable-512, mono-512 PNGs and the SVG load and match their declared sizes.
- No notifications are built, requested or implied anywhere.

## Cannot be verified here (needs a real device)

- iOS Safari "Add to Home Screen": the hint text is correct for Safari's current flow as far as known, not seen on a phone. Chrome and Firefox on iOS differ.
- Standalone behaviour on iOS: status-bar overlap (`black-translucent` with `viewport-fit=cover`; the page pads by `env(safe-area-inset-top)`), the home-indicator gap, rotation, and whether the bar sits correctly above the keyboard. `display-mode` was **emulated** (a `matchMedia` override), not real.
- `env(safe-area-inset-*)` is 0 in desktop Chromium. The tests assert the rules use `env()` and that the last line of content clears the bar by at least 8 px (16 px measured); the actual inset values are unverified.
- Whether a real Android Chrome shows its install prompt (it needs engagement heuristics and HTTPS on the production domain). The prompt path is tested with a synthetic `beforeinstallprompt` event.
- iOS storage eviction: Safari may clear `localStorage` and service-worker caches for a site not used for about seven days (installed home-screen apps are exempt). The in-app backup export is the safeguard; not tested.
- The update flow was tested by rewriting `dist/sw.js` between runs so the browser found a new worker. It was not tested across a real deployment.

## Left as is

- Journal search text and archive toggles are component state and are not kept when you leave My Desk; the segment is.
- A reload (F5) forgets scroll positions: they live in memory for the session.
- Cached `/data/` fallbacks carry no marker beyond the page's offline banner and data date.
