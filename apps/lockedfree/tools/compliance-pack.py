#!/usr/bin/env python3
"""Writes COMPLIANCE-REVIEW.md: every investor-facing claim or disclaimer on the built site, grouped by page, so a qualified person can mark each OK or change it.
It lists text; it does not judge it. Run after `astro build`:  python3 tools/compliance-pack.py   (24 Nov 2026)"""
import re, sys
from html.parser import HTMLParser
from pathlib import Path
from datetime import date
DIST = Path("dist")
PAGES = ["/", "/terminal/", "/calls/", "/screener/", "/practice/", "/gate/", "/plan/", "/about/", "/method/", "/terms/", "/privacy/", "/editions/"]
LOOK = re.compile(r"advice|advis|recommend|\bbuy\b|\bsell\b|\bhold\b|return|profit|\bloss|guarantee|SEBI|registered|research analyst|paper|simulat|past |predict|forecast|\btarget|\bstop\b|educational|not investment|risk|invest|capital|income|outperform|beat the|edge|signal", re.I)
BLOCK = {"p", "li", "h1", "h2", "h3", "summary", "figcaption", "td", "th", "button", "label", "a", "span", "div", "caption", "dt", "dd", "em", "strong", "b"}
class T(HTMLParser):
    def __init__(s): super().__init__(); s.out = []; s.buf = []; s.skip = 0
    def handle_starttag(s, t, a):
        if t in ("script", "style", "svg", "noscript"): s.skip += 1
        if t in ("p", "li", "h1", "h2", "h3", "summary", "figcaption", "tr", "caption", "dt", "dd", "div", "section", "br"): s.flush()
    def handle_endtag(s, t):
        if t in ("script", "style", "svg", "noscript"): s.skip = max(0, s.skip - 1)
        if t in ("p", "li", "h1", "h2", "h3", "summary", "figcaption", "tr", "caption", "dt", "dd", "div", "section"): s.flush()
    def handle_data(s, d):
        if not s.skip: s.buf.append(d)
    def flush(s):
        x = re.sub(r"\s+", " ", "".join(s.buf)).strip(); s.buf = []
        if len(x) >= 25: s.out.append(x)
def lines(path):
    p = T(); p.feed(Path(path).read_text(errors="ignore")); p.flush(); seen = []; 
    for x in p.out:
        if x.startswith("RulebookPaper only"): continue   # the header navigation, run together
        if LOOK.search(x) and x not in seen: seen.append(x)
    return seen
pages = list(PAGES)
eds = sorted((DIST / "editions").glob("20*/index.html")); calls = sorted((DIST / "call").glob("*/index.html")); stocks = sorted((DIST / "stock").glob("*/index.html"))
for extra, label in ((eds[-1:] , "an edition"), (calls[:1], "a call page"), (stocks[:1], "a stock page")):
    for f in extra: pages.append("/" + str(f.parent.relative_to(DIST)) + "/")
site, perpage = {}, {}
for u in pages:
    f = DIST / u.strip("/") / "index.html" if u != "/" else DIST / "index.html"
    if not f.exists(): continue
    for x in lines(f): site.setdefault(x, []).append(u)
out = [f"# Rulebook: investor-facing wording for review ({date.today():%d %b %Y})", "",
 "**Purpose.** Rulebook is a paper-only, educational site. This list is every sentence on the built pages that mentions advice, returns, risk, buying or selling, a stop or a target, paper trading, or similar. It is generated from the site and **has not been judged by anyone**.",
 "**Please decide, per line:** OK, or the replacement wording. Also say whether the site needs a registration statement (for example under the SEBI Research Analyst or Investment Adviser regulations) given what it publishes, which this list cannot answer.", "",
 "Lines shown once even where they repeat; the pages that carry each are named.", ""]
shared = {x: p for x, p in site.items() if len(p) >= 4}; own = {x: p for x, p in site.items() if len(p) < 4}
if shared:
    out += ["## Lines repeated across the site (" + str(len(shared)) + ")", ""]
    for x, p in shared.items(): out += [f"- [ ] OK  [ ] change: {x}", f"  - on {len(p)} pages"]
    out.append("")
by = {}
for x, p in own.items(): by.setdefault(p[0], []).append((x, p))
for u in pages:
    if u in by:
        out += [f"## {u}", ""]
        for x, p in by[u]: out += [f"- [ ] OK  [ ] change: {x}" + (f"  _(also on {', '.join(q for q in p if q != u)})_" if len(p) > 1 else "")]
        out.append("")
Path("COMPLIANCE-REVIEW.md").write_text("\n".join(out) + "\n")
print(f"{len(site)} lines ({len(shared)} repeated) from {len(pages)} pages -> COMPLIANCE-REVIEW.md")
