"""RSI(14) on daily, weekly and monthly closes for every name in the panel, written for the app to read through /api/rsi.

Wilder's definition, the same as src/chart.ts (rsiSeries): the first value seeds with a simple mean of n changes, every later one is smoothed
(previous * (n-1) + today) / n. 100 means the average move was all gains, 0 all losses; no movement at all, or too little history, is null.
A weekly close is the last close of an ISO week and a monthly close the last close of a calendar month; the CURRENT week and month count as
they stand today (week to date, month to date), which is how a chart draws them. Closes are the panel's (dividend-adjusted), so a figure
can differ from a chart of raw closes by a fraction of a point. tests: test_research.py, and tests/fixtures/rsi_golden.json shared with the app's tests.
  python rsi_multi.py ../dist/data/screen.json ../ledger/rsi.json"""
from __future__ import annotations
import json, sys, pathlib
import numpy as np, pandas as pd


def wilder(closes, n: int = 14) -> list:
    c = [float(x) for x in closes]; out: list = [None] * len(c)
    if len(c) <= n: return out
    up = [max(c[i] - c[i - 1], 0.0) for i in range(1, len(c))]; dn = [max(c[i - 1] - c[i], 0.0) for i in range(1, len(c))]
    g, l = sum(up[:n]) / n, sum(dn[:n]) / n
    def val(g, l): return None if (g == 0 and l == 0) else 100.0 if l == 0 else 100 - 100 / (1 + g / l)
    out[n] = val(g, l)
    for i in range(n, len(up)):
        g = (g * (n - 1) + up[i]) / n; l = (l * (n - 1) + dn[i]) / n; out[i + 1] = val(g, l)
    return out


def last_rsi(dates, col, frame: str):
    s = pd.Series(col, index=pd.DatetimeIndex(dates)).dropna()
    s = s[s > 0]
    if frame == "weekly": s = s.groupby(s.index.to_period("W-SUN")).last()
    elif frame == "monthly": s = s.groupby(s.index.to_period("M")).last()
    r = wilder(s.to_numpy())
    return r[-1] if r else None


def sheet(dates, syms, C, as_of: str) -> dict:
    # a trailing row in which no name has a close (a session still being written) is not a session yet: the sheet is as of the last row that has prices
    live = np.where(~np.isnan(C).all(axis=1))[0]
    if len(live): C = C[: live[-1] + 1]; dates = dates[: live[-1] + 1]; as_of = str(pd.Timestamp(dates[-1]).date())
    rows = {}
    for j, sym in enumerate(syms):
        col = C[:, j]
        if np.isnan(col[-1]): continue          # no close on the last session: no figure, never a stale one
        r = [last_rsi(dates, col, f) for f in ("daily", "weekly", "monthly")]
        if any(v is not None for v in r): rows[sym] = [None if v is None else round(float(v), 1) for v in r]
    return {"schema": "tripwire-rsi/1", "as_of": as_of, "basis": "RSI 14, Wilder, adjusted closes; the current week and month are to date", "order": ["daily", "weekly", "monthly"], "rows": rows}


if __name__ == "__main__":
    from study import load_real
    screen, out = sys.argv[1], pathlib.Path(sys.argv[2])
    p = load_real(screen, years=3)
    s = sheet(p.dates, list(p.syms), p.C, str(p.dates[-1])[:10])
    out.write_text(json.dumps(s, separators=(",", ":")))
    print(f"rsi sheet: {len(s['rows'])} names, as of {s['as_of']}")
