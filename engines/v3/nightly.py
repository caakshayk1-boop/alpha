"""Nightly paper record for E1-E5 (spec §6). Calendar-aware and idempotent; publishes nothing (dry run) and sends nothing.

  1. download about three years of daily bars; keep completed sessions only (no bar dated today in IST before 18:00)
  2. EOD completeness: the newest Nifty session must have a bar for at least 95% of the universe, else nothing is recorded
  3. watermark: if this session is already recorded, stop (a duplicated or retried job writes nothing)
  4. paper signals: every engine's setups on the watermark session, with the spec's signal fields, appended to the hash-chained
     ledger (research/v3/paper_ledger.jsonl) under id engine:symbol:date; a second append of an id is a no-op
  5. closed record: every open ledger signal is walked forward with the same execution simulator; outcomes are appended
  6. forming setups: names meeting every condition but the trigger, with the trigger they still need
  7. the four views' feed is built and kept as research/v3/feed_nightly.json (publish dry-run)
Every record carries the engine's state (RESEARCH / PAPER / ...), bound to the frozen evidence hash."""
from __future__ import annotations

import json
import os
import pathlib
import sys
import time

import numpy as np
import pandas as pd

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from v3 import config, costs as C, engines as EN, ind, ledger as L, publish as PB, regime as RG, setups as S  # noqa: E402
from v3.execsim import simulate  # noqa: E402
from v3.run import complete_sessions  # noqa: E402

OUT = HERE.parent / "research" / "v3"
LEDGER = OUT / "paper_ledger.jsonl"
STATE = OUT / "nightly.json"
TARGET_POLICY = {
    "E1": "no fixed target: exit at the next open after a close below the 20-session low, or after 60 sessions",
    "E2": "exit at the next open after two closes below the broken level, or after 25 sessions",
    "E3": "the whole position at the preceding 20-session high, or after 15 sessions",
    "E4": "exit at the next open once the residual z is back to 0, or after 7 sessions; no third target",
    "E5": "half at the range midpoint, half at the range high (both fixed at the signal), or after 15 sessions; no third target",
}


def fetch() -> dict:
    import urllib.request
    import yfinance as yf
    import data
    with urllib.request.urlopen(urllib.request.Request("https://raw.githubusercontent.com/caakshayk1-boop/trading-dashboard/main/docs/screen.json",
                                                       headers={"User-Agent": "alpha-engines/v3"}), timeout=60) as r:
        rows = json.load(r)["rows"]
    uni = [{"sym": x["sym"], "sector": x.get("sector")} for x in rows]
    adj, ex = data.download([u["sym"] for u in uni], period="3y", with_exchange=True)

    def one(t):
        b = yf.download(t, period="3y", interval="1d", auto_adjust=False, progress=False)
        b.columns = [c[0] if isinstance(c, tuple) else c for c in b.columns]
        s = b["Close"].dropna()
        s.index = pd.to_datetime(s.index).tz_localize(None)
        return s
    return {"adj": adj, "exchange": ex, "universe": uni, "nifty": one("^NSEI"), "vix": one("^INDIAVIX"), "fetched": pd.Timestamp.utcnow().isoformat()}


def forming(engine: str, sym: str, df: pd.DataFrame, ctx: dict) -> dict | None:
    """Every condition but the trigger, on the watermark session. E3 and E4 have no forming definition in the frozen rules."""
    c, h = df["Close"], df["High"]
    t = len(df) - 1
    if engine == "E1":
        s50 = ind.sma(c, 50)
        lvl = ind.prev_max(h, 20).iloc[t]
        mp = ctx["mom_pct"][sym].reindex(df.index).iloc[t]
        if s50.iloc[t] > s50.iloc[t - 10] and ctx["mom"][sym].reindex(df.index).iloc[t] > 0 and mp >= 80 and lvl * 0.97 <= c.iloc[t] <= lvl:
            return {"met": "top-quintile momentum, 50-day average rising", "missing": f"a close above {lvl:.2f} (the 20-session high)"}
    if engine == "E2":
        a = ind.atr(df, 14)
        atrp = a / c
        q25 = ind.preceding_quantile(atrp, 252, 0.25, 126)
        lvl = ind.prev_max(h, 20).iloc[t]
        if atrp.iloc[t] < q25.iloc[t] and lvl * 0.97 <= c.iloc[t] <= lvl:
            return {"met": "volatility compressed below its 25th percentile", "missing": f"a close above {lvl:.2f} on 1.5x the 20-session median volume"}
    if engine == "E5":
        lo20 = ind.prev_min(df["Low"], 20)
        rng = df["High"] - df["Low"]
        loc = (c - df["Low"]) / rng.replace(0, np.nan)
        rec = (df["Low"] < lo20) & (c >= lo20) & (loc >= 0.75)
        for i in range(max(0, t - 4), t + 1):
            if bool(rec.iloc[i]) and not (c.iloc[i + 1:t + 1] > h.iloc[i]).any():
                return {"met": f"failed breakdown reclaimed on {df.index[i].date()}", "missing": f"a completed close above {h.iloc[i]:.2f}"}
    return None


def main() -> None:
    cfgs = config.all_configs()
    snap = complete_sessions(fetch())
    bars = {s: d for s, d in snap["exchange"].items() if len(d) >= 260}
    nifty, vix = snap["nifty"], snap["vix"]
    wm = nifty.index[-1]
    have = sum(1 for d in bars.values() if d.index[-1] == wm)
    prev = json.loads(STATE.read_text()) if STATE.exists() else {}
    state = {"watermark": str(wm.date()), "universe": len(bars), "with_bar": have, "ran": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    if have < 0.95 * len(bars):
        state["status"] = f"incomplete: {have} of {len(bars)} symbols have a {wm.date()} bar; nothing recorded"
        STATE.write_text(json.dumps({**prev, "last_attempt": state}, indent=1))
        print(state["status"])
        return
    if prev.get("watermark") == state["watermark"]:
        print(f"{wm.date()} already recorded; nothing to do")
        return
    results = json.loads((OUT / "results.json").read_text()) if (OUT / "results.json").exists() else {"engines": {}}
    st = {e: PB.bound_state(results.get("engines", {}).get(e, {}).get("state", "RESEARCH"), results.get("engines", {}).get(e, {}).get("evidence"), cfgs["evidence"]) for e in config.ENGINES}
    life = PB.lifecycle()                                   # configs/engines/states.yaml: retired and paused engines
    why = {e: results.get("engines", {}).get(e, {}).get("why") for e in config.ENGINES}
    for e, d in life.get("retired", {}).items():
        st[e], why[e] = "RETIRED", f"retired {d['date']}: {d['why']}"
    for e, d in (life.get("paused") or {}).items():
        st[e], why[e] = "PAUSED", f"paused {d['date']}: {d['why']}"
    adj = pd.DataFrame({s: snap["adj"][s]["Close"] for s in bars if s in snap["adj"]})
    sector_of = {u["sym"]: u.get("sector") for u in snap["universe"]}
    ctx = S.context(adj, sector_of)
    regime = RG.regime(nifty, vix, cfgs["regime"]["hysteresis_sessions"])
    cost = C.CostModel.from_config(cfgs["costs"])
    mret = nifty.pct_change(fill_method=None)
    paper, form = [], []
    for e in EN.ENGINES:
        if st[e] in ("RETIRED", "PAUSED"):
            continue                                        # a retired engine records nothing new; its past stays in the ledger
        cfg = cfgs["engines"][e]
        for c in EN.candidates(e, "baseline", bars, ctx, cfg, regime, sector_of, mret, cost, wm, wm + pd.Timedelta(days=1)):
            sig = {"id": f"{e}:{c.sym}:{c.date.date()}", "kind": "signal", "engine": e, "version": cfg["version"], "state": st[e], "symbol": c.sym,
                   "exchange": "NSE", "as_of": str(c.date.date()), "earliest_entry": "next session open", "expiry": "end of the next session",
                   "regime": c.regime, "regime_status": c.status,
                   "entry_rule": f"next open, cancelled at or below {c.stop:.2f} or above {c.ref + 0.5 * c.atr:.2f}",
                   "invalidation": round(c.stop, 2), "chase": round(c.ref + 0.5 * c.atr, 2), "target_policy": TARGET_POLICY[e],
                   "initial_risk_pct": round((c.ref - c.stop) / c.ref * 100, 2), "ref_close": round(c.ref, 2), "rank_score": round(c.score, 4),
                   "rank_components": [None if f is None or f != f else round(float(f), 4) for f in getattr(c, "feats", [])],
                   "data_watermark": str(wm.date()), "sources": ["Yahoo Finance daily bars (exchange prices)", "NSE screen universe"],
                   "evidence": cfgs["evidence"], "reason_codes": [e, c.regime], "recorded": state["ran"]}
            paper.append(sig)
            L.append(LEDGER, sig)
        if e in ("E1", "E2", "E5"):
            for sym, df in bars.items():
                if df.index[-1] != wm or len(df) < 260:
                    continue
                f = forming(e, sym, df, ctx)
                if f:
                    form.append({"engine": e, "symbol": sym, "as_of": str(wm.date()), "state": st[e], **f})
    # closed record: walk every ledger signal without an outcome through the same simulator
    rows = L.read(LEDGER)
    outcomes = {r["body"]["id"][:-6] for r in rows if r["body"]["id"].endswith(":close")}
    closed = []
    for r in rows:
        b = r["body"]
        if b.get("kind") != "signal" or b["id"] in outcomes or b["symbol"] not in bars:
            continue
        df = bars[b["symbol"]]
        d = pd.Timestamp(b["as_of"])
        if d not in df.index:
            continue
        t = df.index.get_loc(d)
        fr = EN.setup_frame(b["engine"], b["symbol"], df, ctx, cfgs["engines"][b["engine"]], mret, cost)
        # the plan as RECORDED: the ledger's stop and chase, never levels recomputed from revised bars (review finding 10)
        plan = EN._plan(b["engine"], "baseline", b["symbol"], df, fr, t, cfgs["engines"][b["engine"]], float(fr["tv"].iloc[t]), 1, stop_override=float(b["invalidation"]))
        if b.get("chase") is not None:
            plan.chase = float(b["chase"])
        fl = simulate(df, plan, cost)
        if fl.status in ("filled", "cancelled_gap", "cancelled_chase", "cancelled_risk"):
            out = {"id": f"{b['id']}:close", "kind": "outcome", "of": b["id"], "status": fl.status, "r_net": None if fl.r_net is None else round(fl.r_net, 4),
                   "r_gross": None if fl.r_gross is None else round(fl.r_gross, 4), "exit_reason": fl.reason, "ambiguous_bar": fl.ambiguous_bar,
                   "exit_date": None if fl.exit_i is None else str(df.index[fl.exit_i].date()), "recorded": state["ran"]}
            L.append(LEDGER, out)
            closed.append({**b, **{k: out[k] for k in ("status", "r_net", "exit_reason", "exit_date")}})
    ok, why = L.verify(LEDGER)
    feed = PB.build_feed({"engines": {e: {"state": st[e], "evidence": cfgs["evidence"], "version": "v1.0.0", "why": why[e]} for e in config.ENGINES}},
                         form, paper, closed, str(wm.date()))
    # published only by the scheduled job on main (V3_PUBLISH=1, DECISIONS #14); every other run is a dry run
    print(PB.publish(feed, HERE.parent.parent / "public" / "engines_v3.json", dry_run=os.environ.get("V3_PUBLISH") != "1"))
    (OUT / "feed_nightly.json").write_text(json.dumps(feed, indent=1, default=str))
    state.update({"status": "recorded", "signals": len(paper), "forming": len(form), "closed": len(closed), "ledger_ok": ok, "ledger_check": why, "states": st})
    STATE.write_text(json.dumps(state, indent=1))
    print(json.dumps(state, indent=1))


if __name__ == "__main__":
    main()
