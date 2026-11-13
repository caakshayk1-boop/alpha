# Tripwire explainer animations (13 Nov 2026)

Three 9:16 (720x1280) explainers, each in one of the owner's animation styles. Source is plain HTML/CSS (open in a browser, plays once); the MP4s are screen recordings of them.
Facts only: nothing predicts, nothing is a recommendation, "paper only" and "not advice" are on screen.

| File | Style | Length | Says |
|---|---|---|---|
| `transit-map.html` / `.mp4` | Transit Map | 15 s | Close, Screen, Rules, Picks, Paper book, Ledger: one line, six stops |
| `dark-keynote.html` / `.mp4` | Dark Keynote | 17 s | Rules that fire; evidence you can check; a book that keeps score; missing data stays missing |
| `blueprint.html` / `.mp4` | Blueprint | 14 s | How a rule fires: data, rule test, evidence, paper book |

Re-record: `node record.mjs <outdir>` is not kept in the repo; each page sets `window.__done` when it finishes, so any Playwright `recordVideo` run works.
