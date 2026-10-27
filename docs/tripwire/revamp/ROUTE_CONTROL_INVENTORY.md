# Route and control inventory (UI branch)

Routes are hash routes (`#/...`). "Main" is `main#main`; the first Tab stop on every route is the skip link "Skip to main content". The primary tab bar (`nav` "Primary") is Today, Discover, Signals, My Desk, Profile; it is last in the DOM, so on a phone it is reached after the page content. Rows for screens another agent is rebuilding carry that agent's name; their controls are listed as of this branch's base.

| route | purpose | main controls (accessible name) | keyboard order | known gaps |
|---|---|---|---|---|
| `#/today` | session, market read, picks, paper book, news, trend map (owner: today) | hide/show amounts (icon button, aria-pressed), Search, pick rows (links), "Open the live blotter", trend-map links, news tabs | skip link, header buttons, content top to bottom, tab bar | Today is being rebuilt by the TODAY agent; commodity strip is compact (CSS only: sparklines hidden), the 8 tiles remain |
| `#/discover` | screener (owner: discover) | search, filter, view switch, column filters | skip link, toolbar, results | owner: discover |
| `#/signals?v=picks|tracker|auto|record|evidence` | paper picks, positions, book, record, evidence | segmented tabs, pick cards, "Take a trade" | skip link, tabs, cards | long method text still inside cards (see Methodology) |
| `#/desk?v=follow|journal|plans|saved` | follows, notes, plans (owner: today) | tabs, Follow, thesis buttons | | owner: today |
| `#/c/:sym` | company page | Back; TradingView link (icon); Follow (icon, aria-pressed); Search; price (one label); "Why this trend" (disclosure); **Read in 30 seconds**: one primary button (Follow / Write a thesis / Review your thesis / Create a paper plan), "Why it surfaced, next review, data quality" (disclosure); chart: radiogroups **Range, Detail, Style, Scale, Compare**, Indicators (toggles: MA 50/200, VOLUME, RSI 14, DRAWDOWN, LEVELS when levels exist, EVENTS when events exist), crosshair slider ("price, range, frame", arrows/Home/End/Escape), "About this chart", "The same chart as a table"; Case and Countercase (disclosures); Same sector and Similar measured patterns (link lists); Engine check (disclosures); News; Scrip intelligence (disclosures, ownership nested); Business table (region, scrolls sideways); Fab row: Follow, Compare, Thesis, Paper plan | skip link, header, price card, disclosure, summary, primary button, chart controls (one tab stop per radiogroup, arrows within), content, fab row, tab bar | the fixed action row sits above the tab bar and can cover the last content line on a short phone; 5 chart groups wrap to 5 rows at 360px (44px targets in Range, Detail, Style; Scale, Compare, Indicators are 36px, a listed exception) |
| `#/m/:key` | commodity, currency, Bitcoin chart | same chart controls (no Style, no Compare) | | |
| `#/compare?s=A,B,C` | up to three names | | | not reviewed in this pass |
| `#/report/:sym` | printable one-page report | Print, Back | | prints the screen figures; carries its own short disclaimer |
| `#/data` | **Data and Coverage** | | | linked from Profile "Help and method", Methodology, Help, Today footer |
| `#/methodology` | **Methodology and evidence**: engines (read from their own rule text), eligibility steps, trend rule, price and chart basis, shareholding | engine disclosures | skip link, header, disclosures, links | linked from the decision summary "The evidence" and Profile |
| `#/help` | **How to use Tripwire** | links | | |
| `#/ops` | **Operations**: probe timings, binding names, secret count | Back | | **linked from nowhere, and not access-protected: no authentication exists, `/api/health` is public. It is a separate page, not security.** |
| `#/profile` | settings | selects (horizon, experience), sector chips (aria-pressed), planner number fields, switches (Hide my amounts, **Lock**, Motion, Haptics), service list (disclosures with status tags), Export, Journal CSV, Import, Delete (two-step), Help and method links | skip link, fields top to bottom | the lock switch is disabled with the reason when the browser has no platform authenticator; haptics text states what is unverified |
| `#/live`, `#/lab` | live blotter, research lab | | | not reviewed in this pass |
| Sheets (search, plan, thesis, explain) | dialogs | Close; fields | focus moves in, Tab wraps, Escape closes, focus returns to the opener | keyboard-open behaviour (`--kb`, `visualViewport`) is code-reviewed, checked by `comfort.mjs` with a shrunken viewport, **not on a real phone** |

## Accessible-name conventions used by the tests

Radio items are named by their visible text (`DAILY`, `MONTHLY`, `LINE`, `CANDLES`, `LINEAR`, `LOG`, `PRICE`, `VS NIFTY`, `1Y`..`MAX`); a disabled item is named by its reason (`10Y: only 14 months of history`). Indicator toggles stay buttons with `aria-pressed`.
