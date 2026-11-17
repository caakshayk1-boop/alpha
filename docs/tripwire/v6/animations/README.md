# Tripwire explainer animations (13 Nov 2026)

Three 9:16 (720x1280) explainers, each in one of the owner's animation styles. Source is plain HTML/CSS (open in a browser, plays once); the MP4s are screen recordings of them.
Facts only: nothing predicts, nothing is a recommendation, "paper only" and "not advice" are on screen.

| File | Style | Length | Says |
|---|---|---|---|
| `transit-map.html` / `.mp4` | Transit Map | 15 s | Close, Screen, Rules, Picks, Paper book, Ledger: one line, six stops |
| `dark-keynote.html` / `.mp4` | Dark Keynote | 17 s | Rules that fire; evidence you can check; a book that keeps score; missing data stays missing |
| `blueprint.html` / `.mp4` | Blueprint | 14 s | How a rule fires: data, rule test, evidence, paper book |

Re-record: `node record.mjs <outdir>` is not kept in the repo; each page sets `window.__done` when it finishes, so any Playwright `recordVideo` run works.

## Where they live on the site (17 Nov 2026)
- `how-it-works.mp4` (16:9, the wide Transit Map) and the two portrait films, `dark-keynote.mp4` and `blueprint.mp4` (9:16), are served from `apps/tripwire/static/media/` and shown on the welcome screen under "How it works" (`src/components/HowVideo.tsx`, `src/components/Films.tsx`).
- The site copies are re-encoded to 540x960 H.264, no audio, 155 to 275 KB each, with a poster frame. The build fails if a film reaches 600 KB or a poster 80 KB.
- The portrait Transit Map (`transit-map.html`) is kept as source only: it says what the wide film says.
- No sound; each film has a "Read it instead" transcript; none autoplays under reduced motion or Data Saver.
