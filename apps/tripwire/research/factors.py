"""The nightly factor sheet: for every eligible stock, where it stands (0 to 100, among eligible names) on each of the less common indicators,
signed so that 100 is the end the literature calls favourable. Written to apps/tripwire/ledger/factors.json and read by the app through
/api/factors. It is DESCRIPTIVE context: each indicator carries the verdict of the pre-registered study (study.py), so the app can say which
ones did not pass. Missing values are left out, never zero.
  python factors.py ../dist/data/screen.json ../ledger/factors.json results/factor_study.json"""
from __future__ import annotations
import json, sys, pathlib
import numpy as np, pandas as pd
from indicators import FEATURES, Panel

SHOW = ["mom12_1", "near_high", "smooth_fip", "eff_ratio60", "resid_mom", "max5", "overnight60", "vol_shock", "ud_vol", "clv20", "coil", "skew60"]


def sheet(p: Panel, as_of: str, verdicts: dict | None = None) -> dict:
    i = len(p.dates) - 1
    tv = np.nanmedian(p.C[i - 19: i + 1] * p.V[i - 19: i + 1], axis=0)
    el = (tv >= 1e8) & (p.C[i] >= 50) & ~np.isnan(p.C[i - 252])
    cols = {}
    for f in SHOW:
        x = np.where(el, FEATURES[f](p, i), np.nan)
        ok = ~np.isnan(x)
        cols[f] = pd.Series(np.where(ok, x, np.nan)).rank(pct=True).to_numpy() * 100
    rows = {}
    for j, s in enumerate(p.syms):
        if not el[j]: continue
        r = {f: round(float(cols[f][j]), 1) for f in SHOW if not np.isnan(cols[f][j])}
        if r: rows[s] = r
    study = {}
    for f in SHOW:
        v = (verdicts or {}).get(f)
        if v: study[f] = {"adopt": bool(v["adopt"]), "kind": v["kind"]}
    return {"schema": "tripwire-factors/1", "as_of": as_of, "universe": int(el.sum()), "rows": rows, "study": study}


if __name__ == "__main__":
    from study import load_real
    screen, out = sys.argv[1], pathlib.Path(sys.argv[2])
    p = load_real(screen, years=2)
    verdicts = None
    if len(sys.argv) > 3 and pathlib.Path(sys.argv[3]).exists(): verdicts = json.loads(pathlib.Path(sys.argv[3]).read_text()).get("verdict")
    s = sheet(p, str(p.dates[-1])[:10], verdicts)
    out.write_text(json.dumps(s, separators=(",", ":")))
    print(f"factor sheet: {len(s['rows'])} names, as of {s['as_of']}")
