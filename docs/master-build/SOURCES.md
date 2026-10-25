# Every attached brief against the code (25 Oct 2026)

Status words: **Done** (in the code and checked this session), **Partly** (some of it), **Not done**, **Declined** (a reason is given),
**Not verified** (needs the live site or a real device, which this sandbox cannot reach). Nothing here claims more than was checked.
Greps find phrases only; where a phrase was absent I read the code before writing "Not done".

## The files and where each stands

| File | Used for | State |
|---|---|---|
| Master build brief (pasted, 22 Oct) | A01–T13 register, redesign, phases | Traced line by line in `CHECKLIST.md`; merged in PR #14 |
| `alpha-lane-a-build-package` | Phase 0: /pro/, waitlist, privacy, lag, flicker | Done; mail secrets, price and one copy line wait for the owner |
| `Alpha_Pro_Upgrade_Blueprint` | Measurable parts only (Lane A rules out accounts/payments) | Done where measurable; the rest is listed as not measured in `CHECKLIST.md` |
| `ALPHA_PRO_HANDOFF` (136 KB) | Waves 1–7 | Built in PRs #1–#13 in earlier sessions; **not re-audited in this pass** |
| Engine files (Signal_Engines, CLAUDE_TASK, PREREGISTRATION, RELEASE_GATES, LEGACY_AUDIT, …) | Swing v2 and engines v3 | Built and merged (PR #12); not re-audited in this pass |
| `alpha-2-prototype-inspiration` | Visual and product direction | Partly: see below |
| `alpha-current-design-upgrade-review` | Ordered backlog | Partly: see below |
| `ALPHA_2_0_INSPIRATION_PACK` | App brief, risk lab, journal | Partly: see below |
| Screenshots (health gauge, departures board, rhythm curve; quant-desk prompt; daily-analysis tweet) | Direction | Partly: see below |

## The design-upgrade review, item by item

| # | Item | State | Evidence |
|---|---|---|---|
| P0-1 | One date contract; Methods has no hard-coded "today's session" | Partly | No such string remains in `about/page.tsx`; the live Signals lag is flagged first by the brief and by `LagNotice`. Whether the deployed pipeline now closes the gap needs Monday's run |
| P0-2 | HTTP snapshot agrees with the hydrated page | Not verified | Needs requests to the live site, blocked from this sandbox. One part fixed now: the initial HTML had an empty H1; it now carries "Today: the market read" |
| P0-3 | AI framing and local-versus-sent disclosure | Done | "Ask about the available evidence on X"; the preset is "What changed in the data for this company?"; the disclosure sits beside Ask (`Explain.tsx`) |
| 4 | Role-based type tokens, tabular figures | Partly | Tokens and design lint in `premium.css`; not every page was compared against the table in the review |
| 5 | Screen work area | Partly | Rebuilt around one query bar, presets and a filters drawer (MB4). Sticky result toolbar, pinned company column and the phone detail sheet were not verified |
| 6 | Company page: labelled sources, plain "held" wording, section navigator | Partly | Case/countercase, earnings-quality, overflow menu done; each source-button label not audited |
| 7 | Today / Map compression | Partly | Today rebuilt; the Map already states "largest N of M". Single-strip summary and a table mode not verified |
| 8 | Compare Quick look first; aligned bars, not radar | Done | No radar in the compare code; Quick look exists |
| 9 | One motion contract across CSS and JS | Partly | Springs, glow and loops removed from `premium.css`; the single JS-side preference source was not audited |
| 10 | Reads: review status on the card, correction diff, version history, prev/next | Partly | Review state is shown on the hub; a readable diff and edition index were not built |
| 11 | Journal: review date, condition, import preview | Done (this pass) | Wrong-if, review-by and a separate retrospective added; the import preview exists in `BackupBar` |
| 12 | Desk: one company is a valid start | Done | Following empty state |
| 13 | Research hub: verb link labels | Done (this pass) | "Find companies", "Read studies", "Inspect signal rules", "Open paper book", "Open calculators" |
| 14 | Calendar: provisional label beside each event, source check time | Not verified | Disclosure exists in the intro; per-event labelling not checked |
| 15 | IPOs: official / subscription / unofficial separated | Not verified | Page labels GMP; the separation was not audited |
| 16 | Funds: NAV and holdings dates beside figures; TER absent stated | Partly | Lag shown on `/funds/`. The feed has 3 funds per category and no benchmark, so the page cannot support a decision yet |
| 17 | News: group duplicates, define timestamp, "relevant to" link | Not done | Entity linking was fixed (A01); grouping and the relevance link were not built |
| 18 | Tools: selector with one tool in focus | Not done | All tools still render on one page; the position-size calculator is validated |
| 19 | Methods: searchable index, deep links from each metric's help | Not done | |
| 20 | Privacy: layered headings (local / sent for AI / telemetry / links / delete) | Partly | Rewritten and accurate; the exact five headings were not adopted |
| 21 | Accessibility and responsive gates | Partly | axe on 23 routes × 3 widths, contrast 396 pairs, visual baselines pass in CI. Screen readers and real devices were **not** tested |

## The Alpha 2.0 pack and the prototype

| Idea | State |
|---|---|
| Forest and lime palette, Manrope, six-tab dock | Declined. The live system (warm paper, violet) is the one the review says to keep; a second palette would undo PR #14 |
| Dark-green briefing card | Declined for now: it forces re-rendering every visual baseline for a cosmetic gain |
| Risk lab | Already exists at `/tools` (`positionPlan`: rejects stop ≥ entry, zero inputs, caps at cash) |
| Journal: thesis, invalidation, review date, retrospective kept apart | Done (this pass) |
| Watchlist: a reason per name ("watch margin recovery") | **Not done** |
| Bottom-sheet details on phones | Partly: Drawer exists |
| Persistent left rail on desktop | Not done; the top navigation was kept |
| "Today's progress" arc and cards (health-app screenshot) | Done (this pass): reviewed today, gate rules, Barometer against the previous reading, journal reviews due. Counts only; the arc is never a score |
| Departures-board list with live minutes left | Not done; `MarketClock` covers the session clock |
| Rhythm / energy curve | Declined: nothing Alpha measures fits it |
| Quant-desk prompt and daily-analysis tweet | Signal brief built on branch `signal-brief`. The "search for 10 strategies a night, keep the 18-of-25" loop is declined as data-snooping; an LLM buy/hold/sell score is declined (no measured meaning, advice) |
| A nightly evidence digest per followed name (news, results date, moves, with source and time) | Done (this pass): `lib/evidence.ts`, a Digest tab on My Desk and a card on Today. Built in the browser from the feeds that refresh each evening. It does not see filings or exchange announcements, and says so |

Visual baselines for the changed routes were re-rendered on the CI image (ubuntu-24.04) in commit efa8660, after the evidence digest and the Today progress block were in.
