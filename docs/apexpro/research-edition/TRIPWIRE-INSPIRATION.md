# Tripwire 5.0 — Prompt Basis: "The Ledger, On Display"
### A Claude prompt built ONLY from GitHub's top-50 related skills — structured on the @sifuyik master-prompt frame

**Filed:** 16 Nov 2026 · **Tracker item:** 0g · **Supersedes as run-order:** 0e (4.0) — 0e's Steps 2–6 remain the spec library; this file is the *basis*: the verified diff, the top-50 skills evidence, and the final paste-ready prompt in `<blocks>`.
**Why 5.0 exists:** AK asked two questions on 16 Nov — (1) what actually changed on Tripwire since the 4.0 markdown, and (2) whether a Claude prompt basis can be built by reviewing the top 50 *related* GitHub skills only. Part A answers (1) with live evidence. Part B answers (2). Part C is the prompt itself.

---

# PART A — THE DIFF: LIVE TRIPWIRE vs THE 4.0 FILE (verified 16 Nov ~10:38 MYT)

Method: production HTML/CSS/JS bundles read directly; `/data/screen.json`, `/data/signals.json`, `/api/ledger` fetched live. Every claim below is labelled **Confirmed** (from the live source), **Assumption** (needs AK's Mac-side check), or **Not found**.

## A1. What changed since the 4.0 file (15 Nov 23:31)

| # | Change | Evidence | Label |
|---|--------|----------|-------|
| 1 | **A new code build is live.** Bundle hash `app.mwg69nvf.*` (14 Nov audit) → `app.mwhuifii.*` (CSS 282,686 B; JS chunks ~280 KB). A deploy happened between the 14 Nov 3.0 audit and now. | Bundle filenames in live HTML | Confirmed |
| 2 | **Data is fresh — 5th straight build.** screen.json `built_on 2026-11-14`, `as_of 2026-11-13`, count 994. Next build due after today's (Mon 16 Nov) close. | screen.json | Confirmed |
| 3 | **The frame is wider.** `.main` now caps at **1320px** (1280px at one breakpoint, sidebar offset 192px) — the 3.0 audit's "desktop void" complaint (~740px column) no longer matches the CSS. Whether every page uses the width well is a visual check. | Production CSS | Confirmed (CSS) / Assumption (visual) |
| 4 | **The ledger grew teeth.** `/api/ledger` (schema `tripwire-ledger/1`, started 25 Oct, updated 14 Nov) now publishes 13 days, with `picks`, `outcomes` (entry, mark, R, T1/T2 hit days), `voided` (with plain-English bug explanations), `transitions` (candidate→pending with reasons), and per-engine `skippedWideStop` counts. | /api/ledger | Confirmed |
| 5 | **Gate is OFF, honestly labelled.** signals.json (13 Nov): gate `on: false`, 0 live signals, version `swing-2.0.1`; `record_note` states the forward record is the nightly ledger and "a second record is not published here." | signals.json | Confirmed |

## A2. What did NOT change — nothing from the markdown files has shipped

| 4.0 step | Status on the live site | Evidence |
|----------|------------------------|----------|
| Step 0 — install the skills stack | No visible output; cannot be verified from outside. No BUILD-LOG exists on the site. | Not found |
| Step 1 — grill/plan gate | between AK and Claude on the Mac; nothing public. | Not found |
| Step 2 (= 2.0 ledger truth in UI) | The realised/unrealised split language is **absent** from the shipped JS. (Bundle hits for "verification" are WebAuthn passkey code; "Quotes:" is the quote poller — not 2.0's truth labels.) The ledger *data* (A1.4) exists; the 2.0 *presentation* does not. | Confirmed absent |
| Step 3 (= 3.0 look) | **Accent is still periwinkle `#A5B4FF`.** Brand lime `#CCFF43` appears nowhere in the CSS. Fraunces: absent. Inter: absent (type still JetBrains Mono + the existing sans/editorial vars). The gate pill still ships — copy softened to "Signals gate: … — r/n checks" with an explainer ("context, not a model-vote count"), but it is still a pill, not 3.0's verdict strip. No ⌘K, no Research sparklines found in the bundle. | Confirmed absent |
| Step 4 — features F1–F8 | **None present as UI.** No Glass Book timeline, no Sit-Out Log page, no Scoreboard/histogram/expectancy, no Why-this-stock, no Regime Weather, no Sector Pressure Map ("pressure" hits are PointerEvent library code), no Watchlist Trips, no per-pick share cards (only the site-wide `og.png`). | Confirmed absent |
| Step 5 — public face | Homepage is still a JS-only shell ("Tripwire needs JavaScript to run"); no landing hero, no email capture, no /pro in the bundle. | Confirmed absent |
| Step 6 — proof gate | No BUILD-LOG, no published checks. | Not found |

## A3. The one-sentence diff

**Since the 4.0 markdown: fresh data, a new build hash, a wider frame, and a much richer ledger API — and zero of the file's named deliverables.** The encouraging asymmetry: F1 (Glass Book), F2 (Sit-Out Log) and F3 (Honest Scoreboard) no longer need new data plumbing — `/api/ledger` already publishes transitions, outcomes-with-R, voided picks *with reasons*, and skipped counts. 4.0's hardest features became UI-only work while nobody was looking. 5.0 exploits that.

---

# PART B — THE TOP-50 EVIDENCE (GitHub API–verified, 16 Nov 2026)

Full research file: `~/workspace/goals/claude-code-artefact-system/hidden_files/top50-skills-research-2026-11-16.md` (10 Search-API sweeps, ~300 repos, 31 individual verifications; 404s dropped: netlify/skills, neon/skills, datadog-labs/skills). Stars are a same-day snapshot — the whole ecosystem is inflating fast (taste-skill +~26K★ in a day), so treat counts as "verified today," not constants.

## B1. The 8 incumbents (4.0's stack) — all still top-tier, all kept

mattpocock/skills **325,241★** · obra/superpowers **318,101★** · karpathy-skills **233,471★** · anthropics/skills **195,411★** · ui-ux-pro-max **149,992★** · addyosmani/agent-skills **117,974★** · taste-skill **116,291★** · marketingskills **60,604★**. Every one grew since 15 Nov. None is displaced.

## B2. The 12 NEW additions 5.0 actually installs (picked from the Top 50 by job, not by stars alone)

| Pick | Repo (Top-50 rank) | ★ | The job it does for Tripwire |
|------|--------------------|---|------------------------------|
| 1 | `NVIDIA/SkillSpector` (#40) | 26,252 | **Safety first:** scans every other skill for malicious patterns BEFORE it enters the repo. Skills are executable instructions from strangers. Non-negotiable Step 0 gate. |
| 2 | `VoltAgent/awesome-design-md` (#4) | 127,680 | One **DESIGN.md** as the site's visual law — the direct cure for the accent-drift bug class (periwinkle) that Tripwire already suffered. |
| 3 | `pbakaus/impeccable` (#7) | 110,806 | **Deterministic design-QA:** 62 detector rules (slop patterns, contrast, touch targets) that run without burning model tokens. The Step 3/6 gate. |
| 4 | `Nutlope/hallmark` (#23) | 55,548 | Second anti-slop opinion, **browser-linted** — if Hallmark can tell a page is AI-made, it doesn't ship. |
| 5 | `emilkowalski/skills` (#22) | 57,236 | Micro-interaction & animation-detail standard (ex-Vercel/Linear). Perceived quality per hour is the highest on this list. |
| 6 | `greensock/gsap-skills` (#42) | 18,491 | Official GSAP guidance — the motion engine that fits a **vanilla-JS** codebase (React component libs don't). Halo, timelines, Flip for the Book. |
| 7 | `larashero3-dotcom/lieflat-charts` (#50) | 6,883 | Smallest pick, most on-brief: a data-viz skill for polished interactive charts — charts ARE Tripwire's core surface. |
| 8 | `AgriciDaniel/claude-seo` (#35) | 29,743 | 26 SEO sub-skills for the Step 5 public landing + Pro/waitlist pages — the growth surface 4.0 under-specified. |
| 9 | `cloudflare/security-audit-skill` (#13) | 73,288 | Multi-phase, machine-verified security audit — runs in Step 6 BEFORE any Lane-A auth/Razorpay work exposes user data. |
| 10 | `DietrichGebert/ponytail` (#2) | 191,503 | Anti-overengineering discipline ("the best code is code never written") — sized for a one-person vanilla codebase under Claude usage limits. |
| 11 | `gsd-build/get-shit-done` (#18) | 64,131 | Spec-driven context engineering — matches and hardens 4.0's gated-step build style. |
| 12 | `blader/humanizer` (#14) | 69,505 | Strips AI-writing tells from landing/waitlist copy (inside the SEBI-safe guardrails — human-sounding, never claim-inflating). |

**Working stack = 20** (8 incumbents + 12 new). **First reserve:** `vercel-labs/ui` (4,991★, created 26 Oct 2026 — the only notable repo born in the last 90 days; ranked #51 on stars, first in if a UI-behaviour need appears).

## B3. The rest of the Top 50 — reference only (do NOT install)

affaan-m/ECC 303,887 · Graphify-Labs/graphify 148,474 · JuliusBrussee/caveman 120,484 · thedotmack/claude-mem 117,402 · nexu-io/open-design 107,778 · tt-a1i/archify 96,832 · Egonex-AI/Understand-Anything 92,742 · heygen-com/hyperframes 84,676 · ComposioHQ/awesome-claude-skills 79,586 · shanraisshan/claude-code-best-practice 69,091 · mvanhorn/last30days-skill 67,788 · cathrynlavery/diagram-design 67,416 · ayghri/i-have-adhd 61,304 · hesreallyhim/awesome-claude-code 58,093 · K-Dense-AI/scientific-agent-skills 57,324 · DavidHDev/react-bits 52,045 (patterns only — no React) · sickn33/agentic-awesome-skills 49,771 · anthropics/claude-plugins-official 47,401 · wshobson/agents 42,560 · github/awesome-copilot 41,191 · vercel-labs/skills 39,526 · VoltAgent/awesome-agent-skills 37,218 · mukul975/Anthropic-Cybersecurity-Skills 36,202 · vercel-labs/agent-skills 34,132 · davila7/claude-code-templates 33,767 · alirezarezvani/claude-skills 29,861 · meta/astryx 28,961 (a11y reference) · openai/skills 28,761 · OthmanAdi/planning-with-files 28,078 · agentskills/agentskills 27,320 · google/skills 24,374 · composio-community/awesome-codex-skills 17,331 · heydamir/unslop 16,795 · travisvn/awesome-claude-skills 15,830 · elayadesign/ai-design-skills 15,611 · google-labs-code/stitch-skills 9,358 · PleasePrompto/notebooklm-skill 7,793 · remotion-dev/skills 7,279.

**Honesty flags from the research:** (a) testing/QA and performance skill repos are star-poor — no test-specific repo earns a Top-50 slot; that job stays with superpowers' TDD + impeccable's detectors + the 2.0 fixture. (b) Most Top-50 repos were created in the 2026 wave († in the research file) — young, fast-moving, occasionally renamed (`kepano/obsidian-skills` → `obsidianmd/obsidian-skills`, cut on relevance). Pin versions at install; re-verify quarterly.

---

# PART C — THE PROMPT (paste-ready; structure follows the @sifuyik master-prompt frame)

```text
<prompt>
<role> You are the lead builder for Tripwire (tripwire.askakshay.com), a paper-only NSE stock-research app: nightly screen of ~994 names, three public rules (MOM / QLT / LVT), a forward ledger, and a positions Book. You work surgically (karpathy-guidelines), spec-first (addyosmani spec-driven-development + get-shit-done), and you never guess: when unsure, you say so and show how to check. </role>

<my_inputs> Product: Tripwire, vanilla JS, no framework migration. Specs on file in this repo: TRIPWIRE-2.0 (ledger truth + labels), TRIPWIRE-3.0 (Terminal Editorial look), TRIPWIRE-4.0 (Glass Book run order + features F1–F8), TRIPWIRE-5.0-BASIS (the live diff + skills evidence — Part A is your ground truth about what is NOT yet shipped). Data sources, read-only: /data/screen.json, /data/signals.json, /api/ledger (schema tripwire-ledger/1: days, picks, outcomes, voided, transitions), /api/rsi, /api/factors, /api/breadth. Audience: Indian retail researchers who distrust black-box tips. Tone: plain, honest, numbers-first. </my_inputs>

<objective> Ship — live, deployed, evidenced — the work 4.0 specified but did not land, in the order in <instructions>. Exploit the diff's key fact: /api/ledger already publishes transitions, outcomes-with-R, voided picks with reasons, and skipped counts, so F1/F2/F3 are UI work, not data work. Do not write production code until the clarify step closes. A step is DONE only when its result is visible on the live site and logged in BUILD-LOG.md with evidence; a plan is never a deliverable. </objective>

<clarify_step> Read the 2.0/3.0/4.0 specs and Part A of the 5.0 basis. If anything material is missing or unclear, ask a maximum of 3 short questions and wait. Specifically confirm: (1) the ledger semantics mapping — which ledger records count as "taken" positions vs observations (print your mapping before building on it); (2) whether DESIGN.md (Step 1 output) may retire the periwinkle accent for brand lime #CCFF43 per 3.0; (3) deploy route + how AK verifies on the live URL. If nothing is missing, say "No questions needed" and continue. Never fill a gap with an unlabelled assumption. </clarify_step>

<break_it_down> Work in these steps, in order. Each step names its expert role and its skills; each ends with a deploy + a BUILD-LOG.md entry (changed / verified / untouched) before the next begins.
STEP 0 — Safety & stack (Role: Platform Engineer; skills: NVIDIA SkillSpector, vercel-labs/skills installer). Scan every skill with SkillSpector before install. Install the 20-skill stack (5.0 basis Part B), project-local, one install route per repo, collisions renamed, versions pinned in BUILD-LOG.md. Read each SKILL.md before trusting it.
STEP 1 — The law & the plan (Role: Design Systems Lead; skills: awesome-design-md, mattpocock grill-with-docs, get-shit-done). Write DESIGN.md from 3.0's tokens (it is the ONLY visual law after this step), ADRs, glossary, BUILD-PLAN. STOP for AK's approval. No code before approval.
STEP 2 — Ledger truth in the UI (Role: Data Integrity Engineer; skills: superpowers TDD, karpathy-guidelines). Implement 2.0 Phases 1–2 exactly: one shared snapshot for every count; realised = booked exits incl. partials net of allocated charges; unrealised = remaining qty vs remaining cost basis; R keeps the original filled-position risk denominator. Gate: the 2.0 acceptance fixture (buy 100 @ ₹100, stop ₹90, sell 50 @ ₹120, mark 50 @ ₹110 → realised ₹1,000, unrealised ₹500, total ₹1,500, 1.5R before charges) passes, and every headline number on the Book recomputes from the snapshot.
STEP 3 — The look (Role: Design Engineer; skills: ui-ux-pro-max reconciled TO DESIGN.md, taste-skill dials variance low / motion low / density high, emilkowalski/skills for micro-interactions, gsap-skills for the one-shot price halo). Implement 3.0 Phases A–C. Gates: impeccable's 62 detectors report zero unjustified hits AND hallmark's browser lint passes, at 1440px and 390px.
STEP 4 — Features, data-readiness order (Role: Product Engineer; skills: lieflat-charts for all chart work, gsap-skills). F1 Glass Book lifecycle timelines from ledger transitions (every headline number gets a trace affordance that recomputes it) → F2 Sit-Out Log from ledger passed-not-picked + skippedWideStop + voided-with-reasons (never inside P&L) → F3 Honest Scoreboard from ledger outcomes (R histogram, expectancy, per-rule breakdown, sample-size honesty labels; gaps render as gaps) → F4 Why-this-stock (template-generated at build time from /api/rsi + /api/factors + screen row; a missing value omits the sentence, never fills it) → F5 Regime Weather → F6 Sector Pressure Map (versioned macro input; "pressure ≠ price call" label) → F7 Watchlist Trips (localStorage only) → F8 Ladder Share Cards (build-time images, as-of stamp, "paper only").
STEP 5 — Public face (Role: Growth Engineer; skills: claude-seo, marketingskills constrained by <rules>, humanizer). 3.0 Phase D landing (hero = the live product + real freshness timestamp + one email-capture CTA + honesty strip), technical SEO pass, human-sounding copy that makes zero return claims.
STEP 6 — Security & proof (Role: QA Lead; skills: cloudflare/security-audit-skill, impeccable). Run the security audit (report filed; criticals fixed or explicitly deferred by AK) BEFORE any auth/payments work is proposed. Then the consolidated proof gate: 4.0's 12 checks + the Step 2 fixture + feature recomputes + iPhone pass + PageSpeed budget, all evidenced in BUILD-LOG.md. </break_it_down>

<fact_rules> 1. Facts come only from the named data sources and the specs; label every important claim in your reports Confirmed (from source), Assumption (needs checking) or Not found. 2. Never invent a number, date, count or quote — a missing value renders as missing. 3. No engine, rule, gate, threshold or cost-model (0.25%) changes, ever, in this run. 4. Paper-only and SEBI-safe: no return claims, no "signals for sale", no buy/sell calls in UI or copy; marketing-skill suggestions that breach this are overridden. 5. Facts and opinions stay in separate places: data in the UI, judgement in BUILD-LOG.md. </fact_rules>

<build_the_prompt> Your working outputs use these labelled blocks, in this order, per step: role, context (what you read), instructions (what you will do), rules (which guardrails bind this step), output format (files changed + deploy + evidence). Keep wording short and direct. Add no step that does not help. </build_the_prompt>

<review_step> After each step, switch to a reviewer role that did not write the code. The reviewer checks: unclear words, missing rules, places where the UI could present a guessed or stale number as fact, counts that disagree across surfaces, and steps that could be misread. The reviewer lists problems; you fix them; only the fixed version deploys. Impeccable + hallmark outputs attach to the Step 3 and Step 6 reviews. </review_step>

<test_step> Run these 3 tests and report what a good result looks like for each, before claiming Step 6 complete: (1) NORMAL — recompute the Scoreboard's expectancy by hand from /api/ledger outcomes for one rule and match it to the UI to 2 decimal places. (2) TRICKY — the partial-exit fixture from Step 2, including a second partial exit and a charge allocation; realised/unrealised must still reconcile to the snapshot. (3) REFUSAL — ask yourself to write landing copy claiming "proven returns"; the correct behaviour is to refuse the claim and produce the SEBI-safe alternative. </test_step>

<output> Deliver, in this order: 1. A 2-line summary of what shipped in this step. 2. The BUILD-LOG.md entry (changed / verified / untouched + evidence links or screenshots). 3. A short list of assumptions made. 4. The reviewer's findings and what changed because of them. 5. What remains, named step by step — never "almost done". </output>

<rules> Never promise accuracy you cannot support. Never hide uncertainty to sound confident. Keep language simple. Ask AK before changing the goal, the run order, or any guardrail. Deploy small, verify live, log honestly — paper progress is the failure mode this prompt exists to kill. </rules>

<final_check> Before answering at any gate, challenge your own work and end with a section titled "WHERE COULD THIS PROMPT FAIL?" listing the top 3 risks with a fix for each. (Seed risks, from the 5.0 basis: 20 skills can conflict or bloat context — fix: staged installs per step, one owner per job, SkillSpector + pinned versions. Ledger semantics may be misread — fix: the printed mapping + fixture gate in Step 2 before any UI. The run can decay into documents again — fix: no step closes without a live deploy and BUILD-LOG evidence.) </final_check>
</prompt>
```

## How AK runs it
1. Mac session, Tripwire repo: paste Part C into Claude Code (the whole `<prompt>` block). Keep the 2.0/3.0/4.0 files and this basis in the repo — the prompt reads them as its spec library.
2. Answer the ≤3 clarify questions (the ledger "taken" mapping is the one that matters).
3. Approve DESIGN.md + BUILD-PLAN at the Step 1 gate. Then let Steps 2–6 run in order, checking BUILD-LOG.md after each — evidence, not summaries.
4. Tonight's session can realistically close Steps 0–1 and open Step 2. That is a good night.

*Filed as tracker item 0g (tracker + pack + tripwire.md §0g) on 16 Nov 2026. 0e (4.0) remains the spec library; 0g is the run order + skills basis that executes it. Nothing in this file has been run yet.*
