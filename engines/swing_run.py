"""swing_run.py — every evening: the market gate, new Swing v2 signals under the book limits, every open trade walked
through the plan, and the two published files.

  public/signals.json   the site's feed (Trades, Signals, company pages, Today)
  public/engines.json   the same book in the shape the Telegram alerts and the brief already read (trading-dashboard
                        engine_alerts.py / daily_brief.py), so nothing downstream breaks. `alertable` comes from the owner's
                        rule (21 Oct 2026): only when the backtest's holdout month-clustered t is at least 2.

State: engines/state/swing_registry.json. A plan is written once at issue and never recomputed. The ML engines' registry
was archived on 21 Oct 2026 (engines/archive/) and is read by nothing.

Usage: python swing_run.py [bars.pkl]
"""
from __future__ import annotations

import json
import pathlib
import sys
import time

import pandas as pd

import swing as SW
from common import COST_PCT, Ctx

HERE = pathlib.Path(__file__).resolve().parent
STATE = HERE / "state" / "swing_registry.json"
RESULTS = HERE / "research" / "swing_results.json"
PUBLIC = HERE.parent / "public"
ALERT_MIN_T = SW.ALERT_MIN_T
KEEP_CLOSED_DAYS = 30


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"version": SW.VERSION, "launched": SW.LAUNCHED, "signals": {}, "last_scan": None}


def track(e: dict, df: pd.DataFrame) -> None:
    """Refresh one trade from the bars. Pure function of the stored plan and the prices."""
    d = pd.Timestamp(e["date"])
    if d not in df.index:
        return
    t = df.index.get_loc(d)
    w = SW.walk(df, t, e["ref_price"], e["sl"])
    last_close, last_date = float(df["Close"].iloc[-1]), str(df.index[-1].date())
    e["last_close"], e["last_close_date"] = round(last_close, 2), last_date
    if w is None:
        e["status"] = "pending"
        return
    if w.get("void"):
        e.update(status="void", void_reason=w["reason"], entry=round(w["entry"], 2), entry_date=str(df.index[w["entry_i"]].date()), closed_date=str(df.index[w["entry_i"]].date()))
        return
    risk = w["risk"]
    old_stop = e.get("stop_now")
    if old_stop is not None and round(w["stop"], 2) > old_stop:
        e["stop_raised_on"], e["stop_before"] = last_date, old_stop     # the Trades page names the order to move
    e.update(entry=round(w["entry"], 2), entry_date=str(df.index[w["entry_i"]].date()), t1=round(w["t1"], 2), t2=round(w["t2"], 2),
             risk=round(risk, 2), half=bool(w["half"]), stop_now=round(w["stop"], 2),
             events=[{"date": str(df.index[i].date()), "kind": k, "price": round(p, 2), "fraction": round(fr, 3)} for i, k, p, fr in w["events"]])
    if w["closed"]:
        e.update(status="closed", closed_date=str(df.index[w["exit_i"]].date()), exit_reason=w["exit_reason"],
                 r_net=round(float(w["pnl"] / risk - COST_PCT * w["entry"] / risk), 2))
        e.pop("r_open", None)
    else:
        e.update(status="open", r_open=round(float((w["pnl"] + w["remaining"] * (last_close - w["entry"])) / risk), 2), remaining=w["remaining"])


def gate_view(gate: pd.DataFrame, d: pd.Timestamp) -> dict:
    g = gate.loc[d]
    checks = [
        {"rule": SW.RULES["gate"][0], "ok": bool(g["trend"]), "value": f"Nifty {g['nifty']:,.0f} · 200-day {g['sma200']:,.0f}" if pd.notna(g["sma200"]) else None},
        {"rule": SW.RULES["gate"][1], "ok": bool(g["intermediate"]), "value": f"Nifty {g['nifty']:,.0f} · 50-day {g['sma50']:,.0f}" if pd.notna(g["sma50"]) else None},
        {"rule": SW.RULES["gate"][2], "ok": bool(g["breadth_ok"]), "value": f"{g['breadth'] * 100:.0f}% above" if pd.notna(g["breadth"]) else None},
        {"rule": SW.RULES["gate"][3], "ok": bool(g["vix_ok"]) if pd.notna(g["vix"]) else False, "value": f"VIX {g['vix']:.1f}" if pd.notna(g["vix"]) else "VIX not available"},
    ]
    return {"date": str(d.date()), "on": bool(g["on"]), "checks": checks, "passed": sum(c["ok"] for c in checks)}


def build(bars, uni, bench, indices, vix, reg, log=print) -> tuple[dict, dict]:
    ctx = Ctx(bars, bench, uni, indices)
    try:                                         # the Rotation page's file is built from the same context, as it always was
        import rotation_export
        (PUBLIC / "rotation.json").write_text(json.dumps(rotation_export.export(ctx), separators=(",", ":")))
    except Exception as e:                       # secondary: must not stop the book, but must be loud
        print(f"WARNING rotation export failed: {e!r}", file=sys.stderr)
    info = {u["sym"]: u for u in uni}
    sector_of = {u["sym"]: u.get("sector") for u in uni}
    gate = SW.market_gate(bench, vix, bars)
    nifty_r63 = bench / bench.shift(63) - 1
    dates = bench.index[bench.index <= max(df.index[-1] for df in bars.values())]
    today = dates[-1]
    last = reg.get("last_scan")
    launched = pd.Timestamp(reg.get("launched") or SW.LAUNCHED)
    lo = max(pd.Timestamp(last) + pd.Timedelta(days=1), launched - pd.Timedelta(days=1)) if last else max(today, launched - pd.Timedelta(days=1))
    sigs = reg["signals"]
    for e in sigs.values():                                           # refresh the book first: the limits read it
        if e["status"] in ("pending", "open") and e["sym"] in bars:
            track(e, bars[e["sym"]])
    cands = []
    for sym, df in bars.items():
        cands += SW.scan_stock(sym, df, gate, ctx, nifty_r63, ctx.rs126[sym] if sym in ctx.rs126 else None, lo, today + pd.Timedelta(days=1))
    by_day: dict = {}
    for c in cands:
        by_day.setdefault(c.date, []).append(c)
    for d in sorted(by_day):
        active = [e for e in sigs.values() if e["status"] in ("pending", "open")]
        new = 0
        for c in sorted(by_day[d], key=lambda x: (-x.rank, x.sym)):
            if new >= SW.P["max_new_per_day"] or len(active) >= SW.P["max_open"]:
                break
            if any(e["sym"] == c.sym for e in active):
                continue
            if sum(1 for e in active if sector_of.get(e["sym"]) == sector_of.get(c.sym)) >= SW.P["max_per_sector"]:
                continue
            prev = [e for e in sigs.values() if e["sym"] == c.sym and e.get("closed_date")]
            df = bars[c.sym]
            if prev:
                le = pd.Timestamp(max(e["closed_date"] for e in prev))
                if le in df.index and df.index.get_loc(d) - df.index.get_loc(le) < SW.P["cooldown"]:
                    continue
            sid = f"swing:{c.sym}:{d.date()}"
            if sid in sigs:
                continue
            e = {"id": sid, "engine": "swing", "sym": c.sym, "name": info.get(c.sym, {}).get("name", c.sym), "sector": sector_of.get(c.sym),
                 "setup": c.setup, "date": str(d.date()), "ref_price": round(c.ref, 2), "sl": round(c.sl, 2),
                 "risk_pct": round((c.ref - c.sl) / c.ref * 100, 1), "t1_plan": round(c.t1, 2), "t2_plan": round(c.t2, 2),
                 "max_hold": SW.P["max_hold"], "why": c.why, "first_seen": str(today.date()), "status": "pending", "events": [], "half": False}
            sigs[sid] = e
            track(e, df)
            active.append(e)
            new += 1
    reg["last_scan"] = str(today.date())
    reg["version"] = SW.VERSION

    results = json.loads(RESULTS.read_text()) if RESULTS.exists() else None
    hold = (results or {}).get("rules", {}).get("holdout", {})
    alertable, alert_why = SW.eligibility(results)      # A15: bound to this version and these exact parameters
    cutoff = today - pd.Timedelta(days=KEEP_CLOSED_DAYS)
    view = [e for e in sigs.values() if e["status"] in ("pending", "open") or pd.Timestamp(e.get("closed_date") or e["date"]) >= cutoff]
    order = {"open": 0, "pending": 1, "closed": 2, "void": 3}
    view.sort(key=lambda e: (order.get(e["status"], 9), e["sym"]))
    hist = gate.loc[gate.index >= today - pd.Timedelta(days=200)]
    closed = [e for e in sigs.values() if e["status"] == "closed"]
    record = {"closed": len(closed), "wins": sum(1 for e in closed if e["r_net"] > 0),
              "total_r": round(sum(e["r_net"] for e in closed), 2), "avg_r": round(sum(e["r_net"] for e in closed) / len(closed), 3) if closed else None}
    feed = {
        "schema": "alpha-signals/2", "version": SW.VERSION, "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "data_through": str(today.date()),
        "launched": reg.get("launched"), "gate": gate_view(gate, today), "gate_history": [{"d": str(d.date()), "on": bool(v)} for d, v in hist["on"].items()],
        "rules": SW.RULES, "params": SW.P, "cost_round_trip_pct": COST_PCT * 100,
        "alertable": alertable, "alert_why": alert_why, "record": record,
        "backtest": {k: results.get(k) for k in ("version", "generated", "periods", "universe", "gate_on_pct_by_year", "rules", "no_gate", "random", "curve", "notes")} if results else None,
        "signals": view,
    }
    # the old contract, for engine_alerts.py and daily_brief.py: one engine, the same signals
    compat = {
        "generated": feed["generated"], "data_through": feed["data_through"], "launched": feed["launched"], "schema": "alpha-signals/2-compat",
        "engines": {"swing": {"id": 1, "key": "swing", "name": "Swing", "status": "GATE ON" if feed["gate"]["on"] else "GATE OFF",
                              "alertable": alertable, "alert_why": alert_why, "signal_count": sum(1 for e in view if e["status"] in ("pending", "open")),
                              "trades": {"holdout": {"expectancy_r": hold.get("expectancy_r")}}}},
        "signals": [{**e, "engine_name": "Swing", "horizon": "swing", "targets": [e.get("t1") or e["t1_plan"], e.get("t2") or e["t2_plan"]], "r_multiples": [SW.P["t1_r"], SW.P["t2_r"]],
                     "max_hold_days": e["max_hold"], "also_names": []} for e in view],
    }
    log(f"gate {'ON' if feed['gate']['on'] else 'OFF'} ({feed['gate']['passed']}/4) on {today.date()}; {sum(1 for e in view if e['status'] in ('pending', 'open'))} active, {len(closed)} closed")
    return feed, compat


if __name__ == "__main__":
    import data
    if len(sys.argv) > 1:
        d = pd.read_pickle(sys.argv[1])
        bars, uni, bench, indices, vix = d.get("exchange") or d["bars"], d["universe"], d["bench"], d.get("indices"), d.get("vix")
    else:
        import yfinance as yf
        uni = data.universe()
        _adj, bars = data.download([u["sym"] for u in uni], period="2y", with_exchange=True)
        ist = pd.Timestamp.now(tz="Asia/Kolkata")
        if ist.hour * 60 + ist.minute < 16 * 60 + 30:      # a bar dated today is still forming before the close
            bars = {k: (df[df.index < ist.tz_localize(None).normalize()] if len(df) and df.index[-1] >= ist.tz_localize(None).normalize() else df) for k, df in bars.items()}
        late = data.refetch_late(_adj, bars, "2y")
        if late:
            print(f"WARNING {len(late)} stocks still have no bar for the newest session: {', '.join(late[:20])}", file=sys.stderr)
        if len(bars) < 0.85 * len(uni):
            raise SystemExit(f"only {len(bars)} of {len(uni)} symbols downloaded: refusing to publish")

        def one(t):
            b = yf.download(t, period="2y", interval="1d", auto_adjust=False, progress=False)
            b.columns = [c[0] if isinstance(c, tuple) else c for c in b.columns]
            s = b["Close"].dropna()
            s.index = pd.to_datetime(s.index).tz_localize(None)
            return s
        bench, vix = one("^NSEI"), one("^INDIAVIX")
        if ist.hour * 60 + ist.minute < 16 * 60 + 30:
            bench = bench[bench.index < ist.tz_localize(None).normalize()]
            vix = vix[vix.index < ist.tz_localize(None).normalize()]
        indices = data.indices("2y")
    reg = load_state()
    feed, compat = build(bars, uni, bench, indices, vix, reg)
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(reg, indent=1, sort_keys=True))
    (PUBLIC / "signals.json").write_text(json.dumps(feed, separators=(",", ":")))
    (PUBLIC / "engines.json").write_text(json.dumps(compat, separators=(",", ":")))
    print(f"wrote signals.json and engines.json: {len(feed['signals'])} signals in view")
