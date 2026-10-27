"""Every study run is stamped with what it was run on and what it was run WITH, and with a plain-English list of what changed since the last run of the same study.

A result that moves between two runs has exactly four possible causes, and the stamp names which: the history grew (new sessions), the universe changed (names added or
removed), the data provider restated old closes (dividend or split adjustments reach back), or the code or parameters changed. Without this, "the result changed" is a
question nobody can answer a week later. The previous run's own stamp and a small set of checkpoint closes live beside the results (provenance.json, not shipped to the site)
so the comparison needs no network and no second download.

run id = a hash of (code, data window, universe, parameters): the same id means the same inputs, and then a different result would be a bug."""
from __future__ import annotations
import hashlib, json, os, pathlib
import numpy as np

CHECKPOINTS = 8          # dates spread across the history, each with every symbol's close


def _h(b: bytes) -> str: return hashlib.sha1(b).hexdigest()[:10]


def code_hashes(paths: list[str | pathlib.Path]) -> dict[str, str]:
    return {pathlib.Path(p).name: _h(pathlib.Path(p).read_bytes()) for p in paths}


def snapshot(dates: list[str], syms: list[str], C: np.ndarray) -> dict:
    """C is (T, N). Checkpoints: CHECKPOINTS evenly spaced sessions, closes rounded to paise, NaN as null."""
    T = len(dates); idx = sorted({int(round(i)) for i in np.linspace(0, T - 1, CHECKPOINTS)})
    return {"dates": [dates[i] for i in idx], "syms": list(syms), "closes": [[None if np.isnan(v) else round(float(v), 2) for v in C[i]] for i in idx]}


def explain(prev: dict | None, cur: dict, prev_snap: dict | None, cur_snap: dict) -> list[str]:
    if not prev: return ["First recorded run of this study: nothing to compare with."]
    out: list[str] = []
    pd, cd = prev["data"], cur["data"]
    if cd["last_day"] != pd["last_day"] or cd["first_day"] != pd["first_day"]:
        out.append(f"History window moved: {pd['first_day']} to {pd['last_day']} became {cd['first_day']} to {cd['last_day']} ({cd['sessions'] - pd['sessions']:+d} sessions).")
    ps, cs = set(prev_snap["syms"]) if prev_snap else set(), set(cur_snap["syms"])
    if prev_snap and ps != cs:
        out.append(f"Universe changed: {len(cs - ps)} names added, {len(ps - cs)} removed ({pd['symbols']} to {cd['symbols']}).")
    elif not prev_snap and pd["symbols_hash"] != cd["symbols_hash"]:
        out.append(f"Universe changed ({pd['symbols']} to {cd['symbols']} names).")
    if prev_snap:                                                # did old closes move? compare the checkpoint closes both runs hold for the same name and day
        pi = {(d, s): c for d, row in zip(prev_snap["dates"], prev_snap["closes"]) for s, c in zip(prev_snap["syms"], row)}
        moved = total = 0
        for d, row in zip(cur_snap["dates"], cur_snap["closes"]):
            for s, c in zip(cur_snap["syms"], row):
                a = pi.get((d, s)); 
                if a is None or c is None: continue
                total += 1; moved += abs(a - c) > 0.005 * max(abs(a), 1e-9)
        if total and moved: out.append(f"The provider restated old closes: {moved} of {total} checkpoint closes shared with the previous run differ by more than 0.5% (dividend and split adjustments reach back).")
    if prev["code"]["hash"] != cur["code"]["hash"]:
        ch = [f for f in cur["code"]["files"] if prev["code"]["files"].get(f) != cur["code"]["files"][f]]
        out.append(f"Study code changed: {', '.join(ch) or 'files added or removed'}.")
    pp, cp = prev.get("params", {}), cur.get("params", {})
    diff = sorted(k for k in set(pp) | set(cp) if pp.get(k) != cp.get(k))
    if diff: out.append("Parameters changed: " + "; ".join(f"{k} {pp.get(k)!r} to {cp.get(k)!r}" for k in diff) + ".")
    if not out: out.append("No change in the history window, the universe, the closes, the code or the parameters since the previous run.")
    return out


def stamp(meta: dict, p, outfile: str | pathlib.Path, study: str, params: dict, code_files: list[str | pathlib.Path]) -> dict:
    """Add meta['run'] to a study's meta. `p` is the Panel the study ran on."""
    outfile = pathlib.Path(outfile); state_file = outfile.parent / "provenance.json"
    state = json.loads(state_file.read_text()) if state_file.exists() else {}
    dates = [str(d)[:10] for d in p.dates]; syms = list(p.syms)
    snap = snapshot(dates, syms, p.C); codes = code_hashes(code_files)
    data = {"first_day": dates[0], "last_day": dates[-1], "sessions": len(dates), "symbols": len(syms), "symbols_hash": _h(",".join(sorted(syms)).encode())}
    code = {"files": codes, "hash": _h(json.dumps(codes, sort_keys=True).encode())}
    rid = _h(json.dumps([code["hash"], data, params], sort_keys=True, default=str).encode())
    run = {"id": rid, "study": study, "when": meta.get("when"), "git": (os.environ.get("GITHUB_SHA") or "local")[:7], "data": data, "code": code, "params": params}
    prev = (state.get(study) or {}).get("run")
    run["changes"] = explain(prev, run, (state.get(study) or {}).get("snapshot"), snap)
    run["previous"] = prev["id"] if prev else None
    state[study] = {"run": {k: v for k, v in run.items() if k != "changes"}, "snapshot": snap}
    state_file.write_text(json.dumps(state, separators=(",", ":")))
    return {**meta, "run": run}
