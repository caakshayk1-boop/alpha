# Line-item review

Every row has one decision (KEEP / UPGRADE / MERGE / REMOVE / ADD) and a priority. **Outcome** is Done or Deferred for this pass. Value is H/M/L. "No data" = there are no analytics, so usage evidence does not exist. Scores (value, truthfulness, strategic fit) are judgement, not measurement.

Rule applied: value ≤2 and truthfulness ≤2 → REMOVE; value ≥4 with weak execution → UPGRADE.

## Summary
| Decision | Count |
|---|---|
| KEEP | 28 |
| UPGRADE | 27 |
| MERGE | 3 |
| REMOVE | 7 |
| ADD | 5 |
| **Rows** | **76** (counted from this table) |

Outcome: 61 Done, 11 Deferred, 4 not applicable or no change (no auth, no pricing, structured data, offline).

Top P0/P1 items: (1) cards clipped at 641–860 px, (2) engine verdicts unreadable on phones, (3) Today repeated the same facts, (4) Weekly Reads correction text blank, (5) nav menu stuck open, (6) Magic page duplicates Screen, (7) News page was a plain list, (8) page intros cut with "…", (9) decorative gradients/glass, (10) mixed currency and date formats.

## 1. Routes and pages
| # | Item | File | Today | Status | V | Evidence | Decision | Rationale | Eff | Pri | Outcome |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `/` Today | `src/app/page.tsx` | Takeaway, facts, jobs, picks, signals, quotes, breadth, movers | Real | H | baseline shots | UPGRADE | Four-way repetition removed; one reading order | M | P0 | Done |
| 2 | `/brief` | `src/app/brief/page.tsx` | Daily read with its own quote cards | Real | H | screenshot | UPGRADE | Repeats quotes also on Today/Markets | M | P2 | Deferred (layout fixed by shared grids only) |
| 3 | `/markets` | `markets/page.tsx` | 33 quote cards | Real | H | screenshot | UPGRADE | Cards compacted; caption shortened | S | P1 | Done |
| 4 | `/screen` | `screen/page.tsx` | Filters, lenses, table | Real | H | screenshot | UPGRADE | Names wrap, controls full width; lens-in-URL | M | P1 | Done (URL state Deferred) |
| 5 | `/company` | `company/page.tsx` | Scores, chart, research | Real | H | screenshot | UPGRADE | Score bars responsive; full restructure Deferred | L | P2 | Partly done |
| 6 | `/map` | `map/page.tsx` | Heat treemap | Real | M | screenshot | KEEP | Labels under 10 px now hidden; list carries every name | S | P2 | Done |
| 7 | `/rotation` | `rotation/page.tsx` | RRG | Real | H | earlier verification | KEEP | Week-in-progress wording shipped earlier | – | – | Done |
| 8 | `/engines` | `engines/page.tsx` | Engine table, scoreboard, tabs | Real | H | screenshot | UPGRADE | Picker cards, signals first, verdicts compact, URL state | L | P0 | Done |
| 9 | `/magic` | removed | Greenblatt ranking | Real, duplicate | M | owner request | REMOVE | Screen has the "Magic Formula top 100" lens; 301 to `/screen/` | S | P1 | Done |
| 10 | `/reads` | `reads/page.tsx` | Weekly studies | Real | M | blank corrections | UPGRADE | Bug: field `fix` not `what`; typo fixed | S | P0 | Done |
| 11 | `/ipo` | `ipo/page.tsx` | NSE books, upcoming | Real | H | screenshot | UPGRADE | Dates/currency unified, empty-book state | S | P1 | Done |
| 12 | `/funds` | `funds/page.tsx` | Fund table | Real | M | screenshot | UPGRADE | Table scrolls sideways on phones | M | P2 | Deferred |
| 13 | `/news` | `news/page.tsx` | List of 18 stories | Real, thin | H | screenshot | UPGRADE | Now a desk: themes, named stocks, saved, URL state | L | P0 | Done |
| 14 | `/tools` | `tools/page.tsx` | Calculators | Real | M | clip +118 px | UPGRADE | Swipe row stacked, fields full width | S | P1 | Done |
| 15 | `/compare` | `compare/page.tsx` | Side-by-side | Real | M | screenshot | KEEP | Works | – | – | Done |
| 16 | `/calendar` | `calendar/page.tsx` | Results dates | Real | M | screenshot | KEEP | Intro shortened | – | P3 | Done |
| 17 | `/watchlist` | `watchlist/page.tsx` | Local list | Real | H | – | KEEP | – | – | – | Done |
| 18 | `/journal` | `journal/page.tsx` | Local journal | Real | M | – | KEEP | – | – | – | Done |
| 19 | `/about` | `about/page.tsx` | Data dates, method | Real | H | – | KEEP | Freshness copy corrected earlier | – | – | Done |
| 20 | 404 | `not-found.tsx` | Not-found page | Real | L | – | KEEP | – | – | – | Done |
| 21 | `/magic` 301 | `public/_redirects` | – | – | – | `curl -I` 301 | ADD | Preserve the public URL | S | P1 | Done |
| 22 | Pricing / account / checkout | – | Do not exist | – | – | no code | KEEP absent | Not invented; no auth or billing exists | – | – | n/a |

## 2. Navigation and IA
| # | Item | File | Status | Decision | Rationale | Pri | Outcome |
|---|---|---|---|---|---|---|---|
| 23 | Primary nav with grouped dropdowns | `Shell.tsx` | Broken (stuck open after click) | UPGRADE | Reproduced; closes on click, reopens on hover | P0 | Done |
| 24 | Mobile tab bar + More sheet | `Shell.tsx` | Real | KEEP | Works, 44 px targets | – | Done |
| 25 | Command palette (⌘K, `/`) | `Shell.tsx` | Real, rule-based | KEEP | Jumps to pages and companies | – | Done |
| 26 | Footer | `Shell.tsx` | Real | UPGRADE | Magic link removed | P2 | Done |
| 27 | Skip link, theme switch, back-to-top | `Shell.tsx` | Real | KEEP | – | – | Done |
| 28 | Scroll progress bar | `globals.css` | Real, decorative | KEEP | Cheap, harmless | P3 | Done |

## 3. Components
| # | Item | Status | Decision | Rationale | Outcome |
|---|---|---|---|---|---|
| 29 | `ui.tsx` (PageHead, SectionHead, Async, Chg, Bar, Skel…) | Real | KEEP | Shared primitives | Done |
| 30 | `ui.tsx` `Ring` | Dead code | REMOVE | Unused; dials replaced by PercentileBars | Done |
| 31 | `PercentileBars` | Real | UPGRADE | Stacks on phones | Done |
| 32 | `PlanOdds` | Real | UPGRADE | Full-width ladder, no min-width | Done |
| 33 | `SignalCard` (engines) | Real | UPGRADE | Identity, price now, ladder, facts, disclosures | Done |
| 34 | `AiTools.Confluence` | Real | UPGRADE | Table → cards | Done |
| 35 | `EvidenceTags` | Real | UPGRADE | Sentence-case verdict display | Done |
| 36 | `Segmented` | Real | UPGRADE | Scrolls on phones, no drifting thumb | Done |
| 37 | `DataStamp` / `FreshnessBanner` | Real | KEEP | Calendar-based freshness | Done |
| 38 | `Scoreboard`, `Curve`, `StockChart`, `CompanyTools`, `CardPanel`, `AskScreen`, `MetricGlossary`, `Prose`, `SymbolPicker` | Real | KEEP | Used by one or more routes | Done |
| 39 | News desk (`lib/newsdesk.ts`, page) | New | ADD | Smart, rule-based, tested | Done |
| 40 | Component library docs / Storybook | – | ADD | Not built; conventions are in `design-direction.md` | Deferred |

## 4. Copy blocks
| # | Item | Decision | Outcome |
|---|---|---|---|
| 41 | Page intros ended in "…" (line clamp) | UPGRADE: unclamped, six shortened, honesty caveats kept | Done |
| 42 | "One a sector" typo | UPGRADE | Done |
| 43 | Verdicts in capitals | UPGRADE: sentence case, data keys untouched | Done |
| 44 | `Rs.` vs `₹`, `14-Oct-2026` vs `14 Oct 2026` | UPGRADE: `rupeeBand`, `nseDate` + tests | Done |
| 45 | "No bids yet" on empty IPO books ("0.00×") | UPGRADE | Done |

## 5. Features and engines
| # | Item | Status | Decision | Rationale | Outcome |
|---|---|---|---|---|---|
| 46 | Five engines + backtest/live scoreboard | Real | KEEP | Honest framing already; no logic changed | Done |
| 47 | Per-card Ranking/Trading footers | Duplicate | MERGE into engine verdict panel | Repeated on every card | Done |
| 48 | Ticker marquee on Today | Duplicate | REMOVE | Repeated the Board and covered its last quote | Done |
| 49 | "The brief" teaser card on Today | Duplicate | MERGE into headline | Repeated the barometer | Done |
| 50 | "How to read this" panel on Today | Low value | REMOVE | Covered by About | Done |
| 51 | Magic Formula leaders panel on Today | Dup of removed page | REMOVE | Page removed | Done |
| 52 | Scoreboard position on Engines | UPGRADE | Moved below the chosen engine | Done |

## 6. AI features and prompts
| # | Item | Status | Decision | Outcome |
|---|---|---|---|---|
| 53 | `/api/explain` (Q&A about one company) | Incomplete: off, no key | KEEP, document | Done |
| 54 | `AskCompany` UI | Hidden when off | KEEP | Done |
| 55 | `AskScreen` plain-English filters | Real, rule-based, not AI | KEEP | Done |
| 56 | New AI features | – | ADD only with a key; boundary exists | Deferred (blocked: no key) |

## 7. Forms and validation
| # | Item | Decision | Outcome |
|---|---|---|---|
| 57 | Screen/tools/journal inputs | UPGRADE: full-width on phones, 16 px to prevent iOS zoom | Done |
| 58 | `/api/explain` input | KEEP: validated and length-capped server-side | Done |

## 8. Data, APIs, integrations
| # | Item | Decision | Outcome |
|---|---|---|---|
| 59 | `corrections` type (`what` vs `fix`) | UPGRADE: type matched to feed | Done |
| 60 | News feed is 18 stories | Deferred: needs the data repo to fetch more | Deferred |
| 61 | Dead `pxFeed`, `atr` | REMOVE | Done |
| 62 | Duplicate `matchCompanies` (old, lenient) | MERGE into `makeMatcher` | Deferred (kept for its tests) |

## 9. Auth and permissions
No auth exists. KEEP absent; nothing to change.

## 10. States
| # | Item | Decision | Outcome |
|---|---|---|---|
| 63 | Loading skeletons, `Async` error state | KEEP | Done |
| 64 | News: empty/saved/unread/watchlist empty messages | ADD | Done |
| 65 | Stale-data banner, per-page stamps | KEEP | Done |
| 66 | Offline / expired-session | Not applicable (no sessions); offline not tested | Deferred |

## 11. SEO
| # | Item | Decision | Outcome |
|---|---|---|---|
| 67 | Per-route metadata, sitemap, robots | KEEP; `/magic/` removed from sitemap | Done |
| 68 | Structured data | Not added (visible content does not need it) | – |

## 12. Performance
| # | Item | Decision | Outcome |
|---|---|---|---|
| 69 | Aurora blobs, blurred glass panels, glow hovers | REMOVE: cost and banned by the brief | Done |
| 70 | Lighthouse | Not run (tool not installed) | Deferred |
| 71 | Fonts via `next/font` | KEEP | Done |

## 13. Accessibility
| # | Item | Decision | Outcome |
|---|---|---|---|
| 72 | Focus rings, skip link, ARIA tabs | KEEP; engine cards keep a real radio input with focus ring | Done |
| 73 | axe scan | Not run (tool not installed) | Deferred |
| 74 | Colour-only meaning | Gains/losses carry ▲▼ glyphs and text | Done |

## 14. Dependencies
| # | Item | Decision |
|---|---|---|
| 75 | `gsap` | KEEP (reveal/count-up). Not replaced; no new dependency added in this pass |
| 76 | `next`, `react`, `typescript`, `eslint`, `wrangler` | KEEP |

## 15. Dead code and unused assets
Removed: `Ring`, `pxFeed`, `atr`, `.ring`/`.scores` CSS, `.aurora` CSS and markup, glass/glow rules. Remaining known: `matchCompanies`, `rankPhrase` exist for tests only.
