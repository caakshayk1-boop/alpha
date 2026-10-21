# Alpha — DESIGN.md (canonical design tokens and component rules)

> Machine- and human-readable source of truth for Alpha's visual system. Components consume **semantic** tokens only. Values below are a **starting proposal**: calibrate primitives against Alpha's current palette (warm off-white canvas, violet accent, dark theme) before rollout, then lock them here. See `ALPHA_PRO_HANDOFF.md` §23–§26 for rationale.

## 1. Character

Warm, editorial, precise, calm. Serif for statements, sans for actions and numbers. Violet for interaction, green/red only for market direction. Depth from hairlines, not heavy shadows. Motion explains change and place — never decorates numbers.

## 2. Colour

### 2.1 Primitives (proposal — calibrate)

```css
:root {
  /* Sand / canvas */
  --sand-25:  oklch(0.990 0.006 85);
  --sand-50:  oklch(0.975 0.010 85);
  --sand-100: oklch(0.955 0.012 85);
  --sand-200: oklch(0.915 0.014 85);
  /* Ink */
  --ink-900:  oklch(0.205 0.015 285);
  --ink-700:  oklch(0.370 0.015 285);
  --ink-500:  oklch(0.520 0.012 285);
  --ink-300:  oklch(0.760 0.010 285);
  /* Violet (brand / interaction) */
  --violet-700: oklch(0.450 0.170 290);
  --violet-600: oklch(0.520 0.190 290);
  --violet-100: oklch(0.940 0.035 290);
  /* Market */
  --green-600: oklch(0.560 0.140 150);
  --red-600:   oklch(0.560 0.190 25);
  --blue-600:  oklch(0.550 0.150 250);  /* colour-blind "up" */
  --orange-600:oklch(0.660 0.160 55);   /* colour-blind "down" */
  /* Status */
  --amber-600: oklch(0.700 0.150 75);
  /* Dark surfaces */
  --night-950: oklch(0.165 0.010 285);
  --night-900: oklch(0.200 0.012 285);
  --night-850: oklch(0.235 0.012 285);
  --night-800: oklch(0.270 0.012 285);
}
```

### 2.2 Semantic tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--alpha-canvas` | `--sand-50` | `--night-950` | Page background |
| `--alpha-surface-1` | `--sand-25` | `--night-900` | Cards, tables |
| `--alpha-surface-2` | `#fff` | `--night-850` | Popovers, sheets |
| `--alpha-surface-3` | `--sand-100` | `--night-800` | Hover rows, wells |
| `--alpha-text` | `--ink-900` | `--sand-50` | Primary text |
| `--alpha-text-muted` | `--ink-700` | `--ink-300` | Secondary text (≥4.5:1 verified) |
| `--alpha-border` | `--sand-200` | `oklch(1 0 0 / 0.08)` | Hairlines |
| `--alpha-accent` | `--violet-600` | `oklch(0.700 0.150 290)` | Links, focus, primary CTA, active nav |
| `--alpha-accent-contrast` | `#fff` | `--night-950` | Text on accent |
| `--alpha-focus` | `0 0 0 2px var(--alpha-canvas), 0 0 0 4px var(--alpha-accent)` | same | Focus ring |
| `--alpha-up` | `--green-600` | lighter step | Positive change |
| `--alpha-down` | `--red-600` | lighter step | Negative change |
| `--alpha-flat` | `--ink-500` | `--ink-300` | Unchanged |
| `--alpha-warn` | `--amber-600` | same | Stale/under review |
| `--alpha-experimental` | dashed `--alpha-accent` | same | Experimental research |
| `--alpha-assumption` | outline `--alpha-accent` | same | User assumptions |

Colour-blind market mode: `--alpha-up: var(--blue-600); --alpha-down: var(--orange-600);`

Rules: no raw colour literals in components (lint). Every text/background pair ≥4.5:1; UI boundaries ≥3:1, in every theme × accent. Pastels are category-only.

## 3. Typography

```css
:root {
  --font-display: "Instrument Serif", Georgia, serif;          /* single weight + italic; never faux-bold */
  --font-ui: "Inter Tight", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace; /* optional, tickers/formulas */

  --type-display-xl: clamp(2.5rem, 1.6rem + 3.2vw, 4.25rem);
  --type-display-l:  clamp(2rem, 1.5rem + 1.8vw, 3rem);
  --type-title: 1.5rem;     --type-heading: 1.125rem;
  --type-body: 1rem;        --type-reading: 1.125rem;
  --type-data: 0.9375rem;   --type-data-hero: clamp(1.75rem, 1.4rem + 1.2vw, 2.5rem);
  --type-label: 0.8125rem;  --type-meta: 0.75rem;
}
.num, td.num, [data-numeric] { font-variant-numeric: tabular-nums lining-nums; }
```

Max 3 families; self-hosted via `next/font`; subset incl. ₹ (U+20B9) and true minus (U+2212); phone inputs ≥16px; reading measure 65–75ch.

## 4. Space, grid, radius, elevation

```css
:root {
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px;
  --space-6: 32px; --space-7: 48px; --space-8: 64px; --space-9: 96px;
  --radius-s: 6px; --radius-m: 10px; --radius-l: 16px; --radius-pill: 999px;
  --container-reading: 68ch; --container: 1200px; --container-wide: 1440px;
  --elev-0: none;
  --elev-1: 0 1px 2px oklch(0.2 0.02 285 / 0.06), 0 0 0 1px var(--alpha-border);
  --elev-2: 0 8px 24px oklch(0.2 0.02 285 / 0.10), 0 0 0 1px var(--alpha-border);
  --row-h: 36px; --row-h-compact: 30px;
}
```

Grid: 12 / 8 / 4 columns at ≥1024 / 768–1023 / <768; gutters 24 / 16 / 16. Dark theme uses surface steps instead of shadows.

## 5. Components (rules)

| Component | Rules |
|---|---|
| **Button** | Variants: primary (one per view), secondary (outline), quiet (text), danger. Heights 36/44 (touch). Press `scale(0.98)`. Busy state keeps width. Disabled shows reason via tooltip/text |
| **Chip** | Filter chips (pill), status chips (§24.4 of handoff). Remove button labelled "Remove {clause}" |
| **Card** | Roles: featured insight (radius-l, elev-1), standard panel (radius-m, hairline), compact list item (no box). Never nest cards |
| **Table** | Sortable headers are `<button>`s inside `<th>` with `aria-sort`; numerics right-aligned + tabular; `—` for unknown; sticky header/first column; virtualise >200 rows |
| **Metric** | Value + unit + as-of chip + source popover; change shows sign, arrow, colour |
| **Dialog/Sheet** | Shared primitive: portal, focus trap, inert background, Escape, focus restore, scroll lock; bottom sheet on phone |
| **Popover/Tooltip** | Opens on click/tap and focus; hover only enhances; never the sole route to information |
| **Command palette** | ARIA combobox; groups: Companies, Pages, Saved, Actions; recent items; no private notes sent to any service |
| **Toast** | Polite live region; undo where destructive; auto-dismiss ≥5s, pausable on hover/focus |
| **Skeleton** | Matches final dimensions; no shimmer when reduced motion |
| **Empty state** | One sentence + one relevant action; never a decorative zero |

## 6. Motion tokens

```css
:root {
  --dur-instant: 80ms; --dur-fast: 140ms; --dur-base: 200ms; --dur-slow: 280ms; --dur-flash: 500ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-enter: cubic-bezier(0, 0, 0.2, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --distance-s: 6px; --distance-m: 12px;
}
@media (prefers-reduced-motion: reduce) {
  :root { --dur-fast: 0ms; --dur-base: 0ms; --dur-slow: 0ms; --distance-s: 0px; --distance-m: 0px; }
}
```

Animate only transform/opacity/clip-path/colour. Max two simultaneous motions in view. Never animate numeric text. Same-document View Transitions for navigation (progressive enhancement); `view-transition-name: ticker-<symbol>` for shared ticker continuity.

## 7. Do / Don't

| Do | Don't |
|---|---|
| Put as-of and source next to the number | Hide dates in footnotes |
| Use violet for interaction | Use violet or green as "good stock" |
| Show `—` with a reason popover | Show 0 or N/A for unknown |
| Equal weight for Case and Countercase | Collapse risks by default |
| One primary action per view | Three filled buttons side by side |
| Hairlines and whitespace for structure | Boxes around every sentence |
| Text summaries for charts | Hover-only tooltips |
