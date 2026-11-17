# ApexPro ULTIMATUM — "The Evidence Observatory"
### One Codex run that ends five layered redesigns and ships a site nobody else has

**Site:** apexpro.askakshay.com · **Built for:** OpenAI Codex (the tool that built ApexPro) · **Filed:** 16 Nov 2026 · **Tracker item:** 0f
**Verdict up front:** ApexPro does not have a design problem. It has *five* design problems stacked on top of each other — five redesign generations (base, Terminal, Cockpit, Studio, Atelier, Session) all still shipping at once, each overwriting the last one's colours. This prompt deletes four of them, keeps the best bones, and adds a motion spine and eight features no Indian equity-research site has.

---

## ★ THE EXACT COMMAND — paste this into Codex

Open the ApexPro repo in Codex (CLI, IDE extension, or ChatGPT desktop app), then paste **exactly this**:

```text
Read AGENTS.md and the file APEXPRO-ULTIMATUM.md in this repo root in full before touching anything. Execute it in its exact run order: Step 0 install the ten skills into .agents/skills/ (project-local only, read each SKILL.md before trusting it, rename any name collisions), Step 1 write DESIGN.md + BUILD-PLAN.md from Part C and STOP for my approval — no code before I approve the plan. After I approve: Step 2 token consolidation (one tokens.css, delete the other five stylesheets' :root wars, bump the service-worker VERSION and update its SHELL list in the same commit), Step 3 motion spine (self-hosted GSAP + Lenis only — our CSP is script-src 'self', no CDN scripts, ever), Step 4 features U1–U8 in order, Step 5 the Impeccable + Hallmark anti-slop audit pass, Step 6 the 14-check proof gate with screenshots at 1440px and 390px. Hard rules: vanilla JS only — do NOT rewrite to React/Next/Tailwind; do NOT change any API endpoint, score, weight, ladder math, vet rule or copy claim; missing data renders as missing, never filled; SEBI-safe wording only (educational, no return claims, no buy/sell calls); every step ends with a BUILD-LOG.md entry stating what changed, what you verified, and what you did not touch. If a step's gate fails, stop and report — do not improvise around it.
```

Then attach/paste this entire file into the repo as `APEXPRO-ULTIMATUM.md` and a short `AGENTS.md` pointer (Part H). That is the whole setup. Everything below is what Codex executes.

---

# PART A — THE AUDIT (every line, verified live 16 Nov 2026 ~01:51 MYT)

Evidence pulled from the production site itself: HTML, all 6 CSS files, all 10 JS modules, the service worker, response headers, and the live APIs.

## A1. The headline defect: six `:root` blocks, five different identities

`index.html` loads six stylesheets in this order — cascade order decides what the user actually sees:

| # | File | Size | `--bg` | `--accent` | `--radius` | Identity it imposes |
|---|------|------|--------|------------|-----------|---------------------|
| 1 | `style.css` | 30.9 KB | `#101213` | `#d4f77d` (soft lime) | 18px | Base app + the ONLY light theme |
| 2 | `terminal.css` | 54.8 KB | `#0a0a0b` | `#ccff43` (brand lime) | 16px | "Terminal" redesign — Inter + Fraunces + Mono, motion tokens |
| 3 | `cockpit.css` | 8.3 KB | — (partial) | — | — | "Cockpit" widgets, blue comparison `#9abaff` |
| 4 | `studio.css` | 9.0 KB | — | blue/violet `#90b6ff` / `#b9a3ff` | — | "Studio" scanner glow theme |
| 5 | `atelier.css` | 11.4 KB | `#0d0e11` | — (blue-grey surfaces) | 12px | "Atelier" editorial hero theme |
| 6 | `session.css` | 7.6 KB | `#0b1118` (navy) | `#efc47a` (**gold**) | — | "Session" theme — loads LAST, wins ties |

**What this means in plain terms:** depending on which selector wins, ApexPro is lime, soft-lime, gold, or blue-violet — sometimes on the same screen. The light theme in `style.css` is actively sabotaged by `terminal.css`, whose `:root` block explicitly targets `[data-theme=light]` and forces `color-scheme: dark` with dark tokens. Five redesigns were *added*; none were ever *removed*. ~122 KB of CSS and ~1,870 selectors ship to say "dark background" six times.

## A2. Fonts — three systems fighting

- `style.css`: system stack (`-apple-system, "Segoe UI"`) + a self-hosted font literally named `Mono` (`/mono.woff2`, weight 100–800).
- `terminal.css`: self-hosted **Inter** (400–600 only — no bold UI text), **Fraunces** (400–500), plus `Mono`.
- Result: headings, body and data each render from a different generation's stack depending on the page. No variable font, no tabular-numbers discipline outside `Mono`, no single type scale.

## A3. Icons — no system

- One real brand mark exists (`icon.svg` — a lime pulse/ladder glyph on `#0a0a0b`, good, keep it).
- In-app icons are a mix of: an `icon()` helper in `app.js`, raw unicode (✕ close, ↗, →, ↘ in `atelier.js`), and text glyphs. No stroke grid, no size tokens, no sprite. Every generation invented its own arrows.

## A4. Flow & transitions — effectively none

- Routing is hash-based (`#/discover`, `#/company/SYM`, `#/compare`, `#/desk`, `#/settings`, `#/about`, home = `#/`). Route change = instant DOM swap. **Zero** View Transitions API, zero shared-element morphs, zero page choreography.
- The only motion in ~122 KB of CSS: a `-2px` hover lift on sector cells, 120/200/320 ms duration tokens defined in `terminal.css` and barely used, a glow toggle (`apexpro:glow`). Scroll position is manually restored for Discover only.
- A research flow that should feel like *diving* — market → sector → company → evidence — feels like seven separate pages stapled together.

## A5. Duplicate information (AK's "no repeat" complaint — confirmed in code)

- The home dashboard assembles `marketHero` + `marketBrief` + `indexStrip` + `macroPanel` + `atelierHero` + `sectorMap` + `breadthPanel` + `radar` + `healthPanel` + `snapshot`/`changesSince` — the market's "how is today" story is told by the hero dial (% in uptrend), the brief, the breadth panel, and the sector mosaic **four separate times** with four different visual languages.
- `snapshot`, `radar`, `changesSince` are referenced across `app.js`, `research.js`, `cockpit.js`, `session.js`, `studio.js` — the same "what changed" idea rendered by multiple modules.
- Company pages repeat the verdict pattern: `companyBrief`, `detailWidgets`, `healthPanel`, evidence sections — quality/growth/value/technical scores surface in the brief, the widgets, and the table columns without one canonical "evidence" block.

## A6. Payload & performance facts

- `/api/screen` = **2,487,211 bytes** of JSON for 994 rows (~110 fields per row, incl. full ladder/vet/magic-formula objects). It is the app's spine — and it is fetched whole.
- `/api/chart?s=RELIANCE` = **407 KB** per company (full price history back to the 1990s). `/api/company?s=` = 4.4 KB. `/api/market` = 4.5 KB. `/api/macro` = 8.4 KB.
- JS: 10 ES modules, ~122 KB total, unbundled. CSS: 6 files, ~122 KB. HTML shell: 2,760 bytes, JS-only — crawlers and no-JS visitors see "Your research workspace is loading" and nothing else (same weakness already flagged on Tripwire).
- Screen data is honest and fresh: `built_on 2026-11-14`, price_date 2026-11-13, `age_days 1.1`, coverage 994/1000, breadth NEUTRAL. The *data* is pro-level. The *presentation* is what undersells it.

## A7. What's genuinely good — keep, do not touch

- **Security headers are excellent:** strict CSP (`script-src 'self'` — remember this in Step 3), HSTS, X-Frame DENY, nosniff, permissions-policy. Do not weaken any of them.
- **The data layer is the moat:** scores with confidence (`q/g/v/tech` + `_conf`), vet checks with plain-English for/against, Greenblatt magic-formula ranking *with its deviations printed*, ladder with tested-level basis, Ahimsa index membership with an explicit "not a score" note. This honesty is the brand. The redesign surfaces it; it never rewrites it.
- **Service worker** (`apexpro-v7-market-desk`) with a proper SHELL list — but it caches the CSS/JS by URL, so **any redesign that forgets to bump VERSION ships the old design to returning users**. Step 2 makes the bump mandatory.
- localStorage namespaces are clean: `apexpro:desk`, `:display`, `:home`, `:visit`, `:glow`, `:quote-cadence`. Keep every key — user data lives there.
- Accessibility bones exist: skip link, aria labels, colourblind mode (`data-colorblind` swaps green/red), reduced-motion mode (`data-motion=reduce`). The Ultimatum keeps all three and makes them first-class.

## A8. Audit verdict

ApexPro's engine room is better than 95% of fintech sites. Its face is five faces. The fix is not a sixth redesign layered on top — it is **consolidation to one design law (DESIGN.md), one token file, one motion spine, and features built on data only ApexPro has.**

---

# PART B — THE STACK: TOP 10 *NEW* GITHUB REPOS (verified 16 Nov 2026, GitHub API)

Deliberately **not** the Tripwire list. Tripwire 4.0 already uses superpowers / mattpocock / karpathy / anthropics / ui-ux-pro-max / taste / addyosmani / marketingskills — none of those repeat here. These ten are the 2025–26 wave: born in the last 12 months, star-verified, still pushed this week, and each one does a job ApexPro specifically needs. Star counts are live GitHub API figures from 16 Nov 2026 — attention, not quality; the job column is why each earns its place.

| # | Repo | ★ (16 Nov) | Born | Job in THIS build |
|---|------|-----------|------|-------------------|
| 1 | `VoltAgent/awesome-design-md` | 127,654 | Mar 2026 | The DESIGN.md pattern: one file that states a brand's whole visual law so an agent can't drift. Step 1 writes ApexPro's DESIGN.md from Part C using this format. |
| 2 | `pbakaus/impeccable` | 110,611 | Nov 2025 | Design vocabulary for agents (polish / critique / audit / bolder / quieter / animate) + **62 deterministic detector rules** that catch AI-slop (purple borders, neon gradients, bounce easing, tiny touch targets) in CI without an LLM. Runs as the Step 5 gate. |
| 3 | `heygen-com/hyperframes` | 84,639 | Mar 2026 | HTML → MP4, built for agents. Used ONLY in U8 to render the shareable "Evidence Reel" from the same HTML as the company brief — no separate video stack. |
| 4 | `emilkowalski/skills` | 57,142 | Mar 2026 | Emil Kowalski's (ex-Vercel/Linear design engineering) animation & detail skills — the micro-interaction standard: easing, timing, when *not* to animate. Governs every duration in Part D. |
| 5 | `Nutlope/hallmark` | 55,351 | Apr 2026 | Anti-AI-slop design skill for **Codex specifically**: builds pages that refuse to look machine-made, lints in a real browser. Step 5's second gate — if Hallmark can tell a page is AI-made, it doesn't ship. |
| 6 | `meta/astryx` | 28,686 | Jan 2026 | Meta's open design system (React 19 + StyleX, 150+ accessible components, agent-ready). ApexPro is vanilla — so Astryx is the **accessibility & component-anatomy reference**, not a dependency: focus rings, dialog behaviour, density rules. |
| 7 | `greensock/gsap-skills` | 18,491 | Mar 2026 | **Official** GSAP skills that teach the agent to use GSAP correctly — timelines, Flip, ScrollTrigger. GSAP itself is now fully free incl. all formerly Club plugins (SplitText, MorphSVG, Flip) since the Webflow acquisition. Powers the Part D motion spine. |
| 8 | `elayadesign/ai-design-skills` | 15,611 | Jul 2026 | Design-rule files agents actually follow: full visual system per build, restyle by editing one values section. The template discipline for DESIGN.md's token section. |
| 9 | `vercel-labs/ui` | 4,836 | Oct 2026 | Vercel Labs' brand-new "library of behaviours for agents to build the next generation of UIs" — the fastest riser of Nov 2026 (+~395★ in a single day, 15 Nov). Source for U6 command-palette behaviour patterns. |
| 10 | `LottieFiles/motion-design-skill` | 3,164 | Mar 2026 | The 12 principles of animation (Disney, via LottieFiles) as an agent skill: timing, easing, choreography, anticipation. The theory check behind Part D — every animation must name its principle or be deleted. |

**Motion engines (libraries, not skills — vendored, self-hosted):** GSAP core + Flip + ScrollTrigger (timeline/morph/scroll choreography), **Lenis** (`darkroomengineering/lenis`, 17,282★ — inertia smooth scroll, wired to GSAP's ticker, one RAF loop never two), **AutoAnimate** (`formkit/auto-animate`, 13,970★ — one-line list/grid transitions for Discover/Desk lists). Component *patterns* may be studied from `DavidHDev/react-bits` (52,014★) and `nolly-studio/cult-ui` (7,448★) — **patterns only, re-implemented in vanilla JS/CSS; no React enters this codebase.**

**Codex install mechanics (Step 0 uses exactly this):** Codex reads skills from `.agents/skills/` in the repo. For each repo above: `npx skills add <owner/repo>` project-local (or Codex's `$skill-installer` where the skill is on OpenAI's curated list). Read each `SKILL.md` fully before use; if two skills share a name, rename the folder and note it in BUILD-LOG.md. GSAP/Lenis/AutoAnimate are **vendored into `/vendor/` as self-hosted files** — the CSP (`script-src 'self'`) forbids CDN scripts, and that CSP does not get weakened for convenience.

---

# PART C — THE DESIGN LAW (one identity, written into DESIGN.md in Step 1)

Name: **The Evidence Observatory** — a calm, dark instrument for looking at companies the way an observatory looks at the sky: one lens, everything measured, nothing decorated without a reason.

## C1. Tokens (the ONLY `:root` that survives — `tokens.css`)

```css
:root{
  color-scheme:dark;
  --bg:#0A0A0B;            /* warm near-black — from terminal.css, the strongest generation */
  --sidebar:#101012;
  --surface:#151517;
  --surface-2:#1C1C1F;
  --line:#29292E;
  --line-strong:#3B3C42;
  --ink:#F4F6FA;
  --muted:#A7AFBC;
  --caption:#929AA7;
  --accent:#CCFF43;        /* brand lime — brand ONLY, never a data colour */
  --accent-ink:#131503;
  --up:#3DDC97;            /* mint — gains, positive evidence */
  --down:#FF6A4D;          /* orange-red — losses, negative evidence (never pure red) */
  --amber:#FFC24B;         /* caution / held / stale */
  --compare:#77C9E5;        /* comparison series — from session.css, its one good idea */
  --gold:#EFC47A;          /* session gold, demoted: premium/print accents only */
  --radius:16px; --radius-s:10px;
  --dur-1:120ms; --dur-2:200ms; --dur-3:320ms; --dur-page:420ms;
  --ease:cubic-bezier(.22,1,.36,1);          /* easeOutQuint family — Emil Kowalski standard */
  --ease-morph:cubic-bezier(.32,.72,0,1);    /* shared-element morphs */
  --shadow:0 8px 32px rgba(0,0,0,.53);
}
:root[data-colorblind="true"]{ --up:#5AAEFF; --down:#FFA040; }   /* existing behaviour, preserved */
```

Light theme: **deleted, honestly.** `terminal.css` already force-kills it; pretending it exists is a bug, not a feature. If a light theme ever ships, it ships as a full token set in one place — not as a sixth layer.

## C2. Type (one scale, three voices)

- **Display — Fraunces** (self-hosted, existing files): headlines ≥24px only, italic for the one emphasised word. This is ApexPro's editorial signature — no other AK product uses a serif display face. Keep it, use it *less*, mean it more.
- **UI — Inter var** (upgrade the existing 400–600 static cuts to the variable file, self-hosted): all interface text, 11/12/13/15px scale, `-0.01em` tracking at 15px+.
- **Data — Mono** (existing `/mono.woff2`, renamed in tokens as `--font-data`): every number, `font-variant-numeric: tabular-nums`, no exceptions — a price that jitters sideways on refresh is a bug.
- Scale: 11 caption · 12 small · 13 body · 15 lead · 20 h3 · 28 h2 · clamp(38px, 4.3vw, 64px) h1 (the Atelier hero size — the one thing Atelier got exactly right).

## C3. Icons (one sprite, one grid)

- Single inline SVG sprite (`/icons.svg`), 24×24 grid, 1.5px stroke, round caps — Lucide discipline. ~28 icons needed: search, desk, discover, compare, settings, about, chart, shield (vet), ladder, sector, sun/moon of market session, arrow-up-right, x, check, alert, clock, download, share, bookmark, plus, filter, calendar, eye, layers, target, book, zap, chevrons.
- **Banned:** unicode arrows/✕/↗ as icons, emoji in UI, per-module icon helpers. The brand mark (`icon.svg` pulse-ladder) stays untouched.

## C4. Layout

- Reading width 760px · data width fluid to 1440px · sidebar collapsible to 64px rail (terminal.css already implements this — keep its mechanism, restyle to tokens).
- Home is **one river, top to bottom, each story told ONCE** (Part E, U1 defines the order — this kills the A5 duplication).
- Mobile: bottom tab bar (exists), 390px is a first-class target, not an afterthought — every acceptance screenshot is taken at 1440 AND 390.

---

# PART D — FLOW & TRANSITIONS (the "ultimatum" feel)

The standard: **the user never teleports.** Every navigation is a physical move — something they were looking at travels to become the next screen. If a transition doesn't help the user keep their place, it gets cut (LottieFiles principle check + Kowalski's "animate only when it aids comprehension").

## D1. The motion spine (Step 3 builds exactly this, nothing more)

1. **View Transitions API** for route changes (`document.startViewTransition`), with named elements: company name, price, and sparkline canvas carry `view-transition-name` from Discover row → Company header. Fallback: GSAP Flip re-parenting where VT is unavailable. Hash routing stays — VT wraps the existing `render()`.
2. **GSAP Flip** for Compare: adding a company flips the tray open; the company card morphs into its compare column. Removing reverses it. No fade-to-white, ever.
3. **Lenis** smooth scroll on desktop data pages only (Discover, Company), wired to GSAP's ticker; **off** on touch, off entirely under `data-motion=reduce` or `prefers-reduced-motion`.
4. **AutoAnimate** on Discover results and Desk lists: filter/sort changes glide (150ms), rows never jump.
5. **Scroll choreography (ScrollTrigger, max 3 moments in the whole app):** (a) home hero dial arc draws in once, (b) sector mosaic cells cascade 20ms stagger on first view, (c) company-page evidence bars grow to value on first view. Three. Not thirty.
6. **Micro-rules (Kowalski):** hover = colour/opacity only, ≤120ms; press = scale .98; toasts slide 8px + fade; skeletons shimmer at 1.2s or not at all; **no bounce, no elastic, no infinite loops** except the live-session pulse (U7) at 2.4s, and that stops when the market closes.

## D2. The flow (one journey, five beats)

`Land (Observatory home) → Scan (Discover) → Dive (Company) → Weigh (Compare) → Keep (Desk)` — and every beat links forward and back with the morph transitions above. The Atelier hero's "01 Observe / 02 Investigate / 03 Revisit" steps were the right story told as decoration; Ultimatum makes them the actual navigation model, labelled in the sidebar: **Observe** (home) · **Investigate** (Discover/Company/Compare) · **Revisit** (Desk).

---

# PART E — THE EIGHT FEATURES NOBODY ELSE HAS (Step 4, in this order)

Each feature is built **only** on data ApexPro already publishes (screen / company / chart / market / macro APIs + localStorage). No new data, no invented numbers.

**U1 — One River Home.** Rebuild home as a single narrative: Session Pulse strip → Observatory Dial (the Atelier instrument, kept and perfected — % in uptrend, one dial, drawn once) → **Since Your Last Visit** (the `changesSince` diff, promoted to position #2 — it's the most personal data on the site and currently buried) → Sector Weather (mosaic, once) → Research Radar → Your Desk preview. Market brief/breadth/index/macro fold INTO these blocks as supporting lines. **Acceptance: no fact appears twice on the home page.** (Fixes audit A5.)

**U2 — Evidence Time Machine (the signature feature).** Company page gets a scrubber under the chart: drag through history and *everything* responds — price, RSI, moving averages, distance from 52-week high, trend state — recomputed as-of the scrubbed date from `/api/chart` data already shipped (407 KB of history finally earns its keep). Fundamentals stay labelled with their fiscal year (they don't time-travel; the UI says so). Nothing like this exists on Screener, Trendlyne or Tickertape: they scrub price; ApexPro scrubs **evidence**. Missing history = scrubber shortens, never fabricates.

**U3 — The Evidence Stack (one canonical company verdict).** Company page reorganised into ONE stack, top to bottom: Verdict line (the existing `vd` object: WATCH etc. + its one-line reason, verbatim) → Score bars Q/G/V/Tech **with their confidence values shown** (a 92 with conf 1.0 and a 92 with conf 0.4 must not look identical — confidence becomes bar opacity + a label) → Vet panel (for/against in plain English, already the best copy on the site) → Ladder (entry/stop/targets on tested levels, basis text visible) → Financial history → Chart + Time Machine. Brief/widgets/health duplicates merge into this stack; the page tells each fact once.

**U4 — Compare Duel.** Compare becomes a duel, not a table: two (max three) companies, paired animated bars per ratio (ROCE, margins, D/E, growth, valuation), each bar pair animating from centre on entry (GSAP), the better value in `--up` — with a permanent footnote: "Better on this ratio is not better overall." Data: rows already carry every field.

**U5 — Sector Weather Front.** The mosaic becomes weather: cell size = company count, cell warmth = median 1-month move (data in `breadth`/rows), unmeasured sectors keep the existing hatched "unmeasured" treatment (honesty as a visual device). Hover lifts a sector into a mini-brief (top mover, breadth inside the sector); click morphs into Discover pre-filtered to that sector. Labelled, always: "Pressure is not a price call."

**U6 — Command Observatory (⌘K, rebuilt).** The existing search dialog becomes a true command palette (behaviour patterns from `vercel-labs/ui`): companies, pages, screens/presets, Desk actions ("add RELIANCE to Desk", "compare TCS vs INFY"), and settings toggles — keyboard-first, grouped, with recents from localStorage. One entry point for the whole app; the sidebar stays for mouse users.

**U7 — Session Pulse.** A living status line tied to the existing quote poller: during NSE hours, a 2.4s breathing dot + "Market open · quotes every Ns" (cadence from `apexpro:quote-cadence`); after hours it goes still and reads "Market closed · screen built 14 Nov, prices as of 13 Nov" — freshness honesty as a design element, using `built_on`/`price_date`/`age_days` straight from the screen payload. Stale (>2 sessions) turns the dot `--amber`. No fake "live" claims, ever.

**U8 — Evidence Brief + Reel (share layer).** Every company page gets "Export brief": (a) a print-perfect one-page brief (print CSS — Fraunces headline, Evidence Stack condensed, as-of stamps, "Educational only · Not investment advice" footer) via the browser's own print/PDF; (b) an optional 20-second vertical **Evidence Reel** rendered by HyperFrames from the same brief HTML — verdict, three strongest for/against points, ladder — for AK's own content channels. Watermarked "ApexPro · paper research · as of <date>". This is the growth loop: the product advertises itself with its honesty intact.

---

# PART F — RUN ORDER (gated steps — a step does not start until the previous gate passes)

**Step 0 — Install the stack.** The ten Part B skills into `.agents/skills/` (project-local). Vendor GSAP (+Flip, +ScrollTrigger), Lenis, AutoAnimate into `/vendor/`. Read every SKILL.md; log versions + any name collisions in BUILD-LOG.md. **Gate:** `ls .agents/skills/` shows ten folders; vendor files load locally with CSP unchanged.

**Step 1 — The law, on paper. STOP for AK's approval.** Write `DESIGN.md` (awesome-design-md format; Part C verbatim as its token/type/icon sections) and `BUILD-PLAN.md` (which of the ~1,870 selectors migrate, which die; module-by-module change list). Use Impeccable's `critique` on the CURRENT site and attach its report to the plan. **No code in this step. Codex stops and waits.**

**Step 2 — One token file to rule the site.** Create `tokens.css` from Part C1; re-point all six stylesheets at the tokens, then **delete the five losing `:root` blocks** and merge the survivors into `app.css` (tokens + base + components). Delete the fake light theme. Update `index.html` to two stylesheets max. **In the same commit:** bump service-worker VERSION (`apexpro-v8-ultimatum`) and fix its SHELL list, or returning users keep the old site. **Gate:** grep finds exactly ONE `--bg:` definition in shipped CSS; every page renders identically to before in layout (pixels may shift, structure may not); Desk/display localStorage still loads.

**Step 3 — Motion spine.** Part D1, items 1–6, in order. Nothing feature-shaped in this step. **Gate:** Discover→Company morph works in Chromium + Safari; with `prefers-reduced-motion` the app is fully static and fully usable; Lighthouse performance does not regress vs the Step 2 baseline (record both in BUILD-LOG.md).

**Step 4 — Features U1–U8, in order.** One feature per commit, each with its acceptance line from Part E checked before moving on. U2 (Time Machine) ships behind a flag in display settings until its recompute is verified against known values for 3 hand-checked companies (RELIANCE + 2 others, values stated in BUILD-LOG.md).

**Step 5 — Anti-slop pass.** Run Impeccable's full detector suite (62 rules) + Hallmark's browser lint on every route at 1440px and 390px. Fix every hit or write a one-line justification in BUILD-LOG.md. Then Kowalski review: list every animation in the app with its duration/easing/principle — any animation that can't justify itself is deleted. **Gate:** zero unjustified detector hits; animation inventory fits on one page.

**Step 6 — Proof gate.** Part G's 14 checks, executed and evidenced (screenshots + numbers in BUILD-LOG.md). Only then is Ultimatum "shipped" — a claim without the BUILD-LOG evidence is not a claim.

---

# PART G — THE 14-CHECK PROOF GATE

1. Exactly one `--bg`, one `--accent`, one `--radius` definition in shipped CSS (grep output pasted).
2. Service worker VERSION bumped; a returning-user browser (warm cache) receives the new design without a hard reload.
3. CSP byte-identical to today; zero CDN scripts; all vendor files self-hosted.
4. No API endpoint, score, weight, ladder, or vet rule changed (diff of data-layer files = empty).
5. Home page: no fact rendered twice (manual pass against U1's block list).
6. Discover→Company morph: name/price/sparkline travel; reduced-motion = instant, complete, usable.
7. Time Machine: 3 hand-verified as-of recomputes match (values in BUILD-LOG).
8. Confidence display: a low-confidence score is visually distinguishable from a high-confidence one at a glance (screenshot pair).
9. Compare Duel footnote present; bars animate once, never loop.
10. ⌘K: company, page, preset, and one Desk action all reachable by keyboard alone.
11. Session Pulse shows closed/stale states truthfully with the real `built_on`/`price_date` values.
12. Export brief prints to exactly one page with the educational-only footer; Reel (if built) carries the as-of watermark.
13. Colourblind mode + keyboard-only pass on all 7 routes; touch targets ≥44px (Impeccable detector output).
14. Payload: total CSS ≤ 60 KB, JS ≤ today's ~122 KB + vendor ≤ 90 KB gzipped budget stated and measured; `/api/screen` untouched (its diet is a separate, future data project — not this run).

---

# PART H — GUARDRAILS & THE AGENTS.md POINTER

**Never in this run:** React/Next/Tailwind migration · API or scoring changes · new data sources · return claims, buy/sell language, or "signals" wording anywhere (ApexPro is educational research; SEBI-safe copy only) · weakening CSP/headers · renaming localStorage keys · deleting user Desk data · a light theme · a sixth stylesheet.

**Repo `AGENTS.md` (Codex reads this every run — keep it under 40 lines):**

```markdown
# ApexPro — agent rules
- Design law lives in DESIGN.md. Tokens live in tokens.css. Nowhere else. Ever.
- Vanilla JS ES modules only. No frameworks, no CDN scripts (CSP: script-src 'self').
- Motion: GSAP + Lenis + View Transitions, per APEXPRO-ULTIMATUM.md Part D. Reduced-motion is a first-class mode.
- Data layer (api/, scores, ladder, vet) is read-only for design work.
- Missing data renders as missing. Never estimate, never fill.
- Copy is educational only — no return claims, no buy/sell calls.
- Any CSS/JS change ships with a service-worker VERSION bump in the same commit.
- Every work session ends with a BUILD-LOG.md entry: changed / verified / untouched.
```

---

*End of prompt. Filed as tracker item 0f (tracker + pack + new per-project file `apexpro.md`) on 16 Nov 2026. Companion audits: Tripwire is a different product with a different prompt (item 0e) — nothing in this file applies to it, and nothing in 0e applies here. No duplicate, by design.*
