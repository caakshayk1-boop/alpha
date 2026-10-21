# Alpha Pro Edition — Claude Code pack

## What's inside

```
alpha-pro-pack/
├── README.md                          ← this file
├── CHANGELOG.md                       ← what changed vs the original handoff
├── docs/alpha/ALPHA_PRO_HANDOFF.md    ← master brief: Part A (Pro, new) + Part B (original audit, preserved)
├── docs/alpha/DESIGN.md               ← canonical design tokens and component rules
└── .claude/commands/alpha-pro.md      ← Claude Code slash command
```

## Install (from your Mac, inside the Alpha repository root)

```bash
unzip ~/Downloads/Alpha_Pro_Edition_Pack.zip -d /tmp/alpha-pro
cp -R /tmp/alpha-pro/alpha-pro-pack/docs ./
mkdir -p .claude/commands && cp /tmp/alpha-pro/alpha-pro-pack/.claude/commands/alpha-pro.md .claude/commands/
git add docs/alpha .claude/commands/alpha-pro.md
git commit -m "docs: add Alpha Pro Edition handoff, DESIGN.md and /alpha-pro command"
```

## Run in Claude Code

| Command | What happens |
|---|---|
| `/alpha-pro status` | Reads everything, reports current state and open gates; changes nothing |
| `/alpha-pro 0` | Baseline: commit, routes, screenshots, bundle sizes, tokens |
| `/alpha-pro 1` | Correctness fixes (A01–A03, A05, A10, A11, A14–A16) |
| `/alpha-pro 2` … `4` | Coherence → product & motion → launch (original scope) |
| `/alpha-pro 5` | Pro design system (tokens, type, formatter, design lint) |
| `/alpha-pro 6` | Pro decision UX & motion (⌘K, Case/Countercase, View Transitions, explorer) |
| `/alpha-pro 7` | Pro AI ("Ask Alpha" with eval suite) & growth |
| `/alpha-pro all` | Runs waves in order, stops at first failed gate |

Recommended: run one wave per session, review the report and preview, then continue. Production deployment always needs your separate instruction.
