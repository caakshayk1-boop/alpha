"""rotation_export.py — weekly index levels of every benchmark group, so the site can draw a real Relative Rotation Graph.

Writes public/rotation.json: for each group (the real Nifty IT / Pharma / Bank indices where Yahoo has them, otherwise the
equal-weighted industry index built from the screened stocks), the weekly closes of the last WEEKS weeks, the Nifty beside
them, and the members of each group. The site computes RS-Ratio and RS-Momentum from these; nothing is pre-judged here.

Usage: python rotation_export.py bars.pkl      (also called by ai_run_daily.py)
"""
from __future__ import annotations

import json
import pathlib
import sys

import pandas as pd

WEEKS = 90


def weekly(s: pd.Series) -> pd.Series:
    s = s.dropna()
    s.index = pd.to_datetime(s.index)
    return s.resample("W-FRI").last().dropna().iloc[-WEEKS:]


def export(ctx) -> dict:
    nifty = weekly(ctx.bench)
    dates = [d.strftime("%Y-%m-%d") for d in nifty.index]
    groups = {}
    members: dict[str, list[str]] = {}
    for sym, g in ctx.group_of.items():
        members.setdefault(g, []).append(sym)
    for g, lvl in ctx.group_level.items():
        w = weekly(lvl).reindex(nifty.index, method="ffill")
        if w.isna().sum() > 5 or len(w) < 40:
            continue
        groups[g] = {"close": [None if pd.isna(v) else round(float(v), 2) for v in w.values], "members": sorted(members.get(g, [])),
                     "real_index": g.startswith("Nifty")}
    return {"generated": pd.Timestamp.now().strftime("%Y-%m-%dT%H:%M:%S"), "dates": dates, "nifty": [round(float(v), 2) for v in nifty.values], "groups": groups}


if __name__ == "__main__":
    import context
    bars, ctx, _ = context.make_ctx(sys.argv[1])
    out = export(ctx)
    dest = pathlib.Path(__file__).resolve().parent.parent / "public" / "rotation.json"
    dest.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {dest}: {len(out['groups'])} groups, {len(out['dates'])} weeks, through {out['dates'][-1]}")
