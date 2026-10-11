"""run_daily.py — scan the latest bars with the four frozen engines and write public/engines.json.

Signals are the engines' own output for the last three sessions that are still actionable (price has not
already passed the first target or the stop). Measured results come from research/results.json, written by
finalize.py; they are published beside every signal.

Usage: python run_daily.py [bars.pkl]      (no argument: download fresh bars)
"""
from __future__ import annotations

import importlib
import json
import pathlib
import sys
import time

import pandas as pd

import registry
from common import Ctx

ENGINES = {"rebound": "e1_rebound", "divergence": "e2_divergence", "breakout": "e3_breakout", "swing": "e4_swing"}

RULES = {
    "rebound": {
        "entry": ["Up to 45% and at least 15% below the 52-week high, and at least 10% above the 52-week low",
                  "Weekly RSI at 46 or more and rising over two weeks",
                  "Three-year return positive",
                  "Trigger: a close above the 20-day average and above the prior five-day high"],
        "stop": "The wider of the 50-day swing low less half an ATR, or three ATR below the price, kept between 4% and 12% below entry.",
        "targets": "T1 is 40% of the way back to the 52-week high (never less than 1R), T2 is 70%, T3 is the high itself.",
    },
    "divergence": {
        "entry": ["Price makes a lower low while the 14-day RSI makes a higher low, the first low under RSI 45",
                  "Armed for six sessions after the second low is confirmed",
                  "Fires on a close above the prior day's high on a bullish candle, with at least two of: RSI rising two bars, MACD histogram turning up, volume 1.2x average, reclaim of the 10-day average, stochastic turning up from the low zone, hammer or engulfing"],
        "stop": "0.3 ATR below the divergence low, never more than 10% below entry.",
        "targets": "T1, T2 and T3 are the 38.2%, 61.8% and 100% retracements of the decline into the divergence low. The full retracement must pay at least 1.8R.",
    },
    "breakout": {
        "entry": ["A pattern completes on a close: Darvas box, flat base, bull flag, cup and handle, inverse head and shoulders, double bottom, or a 55-day closing high out of a quiet range. A separate weekly rule fires on a close above the prior 26-week closing high.",
                  "The breakout candle is strong and bullish, on at least 2x average volume",
                  "Stage-2 trend (price above the 50-day, the 50 above the 200), within 15% of the 52-week high",
                  "In the top fifth of the market over six months, while the Nifty is above a rising 200-day average, and ahead of the index over three months"],
        "stop": "Below the pattern's own floor (box bottom, base low, flag low, handle low, shoulder, trough), less 0.3 ATR, never more than 10% below entry (15% on the weekly rule).",
        "targets": "Measured moves: T1 is half the pattern height above the breakout level, T2 the full height, T3 one and a half times. The full move must pay at least 1.5R.",
    },
    "swing": {
        "entry": ["Uptrend: 50-day above 200-day, price above the 50-day and the 50-day rising",
                  "A pullback that tagged the 20-day average with RSI cooling below 50 but not below 28",
                  "Trigger: a bullish close above the prior high, back above the 20-day average, RSI turning up between 42 and 65, ADX 16 or more",
                  "Ahead of the index over three months, in the top 15% of the market over six, with the Nifty above a rising 200-day"],
        "stop": "Below the lowest low of the pullback less 0.2 ATR, never more than 7% below entry.",
        "targets": "T1 at 1.2R, T2 at 2R or the 20-day high if higher, T3 at 3R.",
    },
}

EXIT_PLAN = [
    "Enter at the next session's open, not at the signal close, and skip it if it opens past T1 or below the stop.",
    "Sell one third at T1, one third at T2, the last third at T3.",
    "After T1, move the stop on the rest to your entry. After T2, move it to T1.",
    "If a session gaps through the stop, you are out at the open, not at the stop price.",
    "If nothing has resolved by the time limit, exit what is left at that day's close.",
    "Size so that a stop-out costs an amount you can afford to lose repeatedly. The stop is the plan; the targets are the hope.",
]


def _bench_meta(ctx: Ctx, sym: str, df: pd.DataFrame, t: int) -> dict | None:
    """How the stock's own benchmark was behaving on the signal day."""
    g = ctx.group_name(sym)
    if g is None:
        return None
    idx = df.index
    b = ctx.bench_for(sym, idx)
    if b is None:
        return None
    c = df["Close"]
    r63_b = float(b.iloc[t] / b.iloc[t - 63] - 1) * 100 if t >= 63 else None
    r63_s = float(c.iloc[t] / c.iloc[t - 63] - 1) * 100 if t >= 63 else None
    return {
        "name": g, "members": ctx.group_n.get(g) or None,
        "uptrend": bool(ctx.sec_trend(sym, idx).iloc[t]), "leads_nifty": bool(ctx.sec_lead(sym, idx).iloc[t]),
        "stock_3m_pct": round(r63_s, 1) if r63_s is not None else None, "benchmark_3m_pct": round(r63_b, 1) if r63_b is not None else None,
        "stock_vs_benchmark_pct": round(r63_s - r63_b, 1) if r63_s is not None and r63_b is not None else None,
    }


def sector_board(ctx: Ctx, bars: dict) -> list[dict]:
    """Every benchmark group's current state: the board the engines are reading."""
    out = []
    nb = ctx.bench
    for g, lvl in ctx.group_level.items():
        lvl = lvl.dropna()
        if len(lvl) < 260:
            continue
        s50 = lvl.rolling(50).mean()
        n3 = nb.reindex(lvl.index, method="ffill")
        r21, r63 = float(lvl.iloc[-1] / lvl.iloc[-22] - 1) * 100, float(lvl.iloc[-1] / lvl.iloc[-64] - 1) * 100
        n63 = float(n3.iloc[-1] / n3.iloc[-64] - 1) * 100
        out.append({"name": g, "members": ctx.group_n.get(g) or None, "r1m": round(r21, 1), "r3m": round(r63, 1), "vs_nifty_3m": round(r63 - n63, 1),
                    "uptrend": bool(lvl.iloc[-1] > s50.iloc[-1] and s50.iloc[-1] > s50.iloc[-11]), "leads_nifty": bool(r63 > n63),
                    "real_index": g.startswith("Nifty")})
    out.sort(key=lambda x: -x["vs_nifty_3m"])
    return out


def build(bars: dict, uni: list[dict], bench: pd.Series, results: dict, indices: dict | None = None, reg: dict | None = None) -> dict:
    ctx = Ctx(bars, bench, uni, indices)
    info = {u["sym"]: u for u in uni}
    today = str(max(d.index[-1] for d in bars.values()).date())
    candidates = []
    reg = reg if reg is not None else registry.load()
    window = 1 if not reg["signals"] else 5       # the first run issues only today's signals, so the live record starts clean
    for key, modname in ENGINES.items():
        mod = importlib.import_module(modname)
        st = results["engines"][key]
        for sym, df in bars.items():
            try:
                sigs = mod.scan(df, sym, ctx)
            except Exception as e:  # noqa: BLE001
                print(f"  {key} {sym}: {type(e).__name__}: {e}")
                continue
            n = len(df)
            for s in sigs:
                if s.t < n - window:                  # only fresh signals enter the registry
                    continue
                risk = s.ref_price - s.sl
                if risk <= 0:
                    continue
                candidates.append({
                    "engine": key, "engine_name": st["name"], "sym": sym, "name": info.get(sym, {}).get("name", sym),
                    "sector": info.get(sym, {}).get("sector"), "date": str(s.date.date()), "issued": str(s.date.date()),
                    "setup": s.setup, "horizon": s.horizon, "ref_price": round(s.ref_price, 2),
                    "entry_zone": [round(s.ref_price, 2), round(s.ref_price * 1.01, 2)],
                    "sl": round(s.sl, 2), "risk_pct": round(risk / s.ref_price * 100, 1),
                    "targets": [round(x, 2) for x in s.targets], "r_multiples": [round((x - s.ref_price) / risk, 2) for x in s.targets],
                    "max_hold": s.max_hold, "reasons": s.reasons, "benchmark": _bench_meta(ctx, sym, df, s.t), "bench_ok": s.meta.get("bench_ok"),
                })
    registry.update(reg, candidates, bars, today)
    view = registry.active_view(reg, 14, today)
    signals = []
    for e in view:
        st = results["engines"][e["engine"]]
        signals.append({**e, "engine_status": st["status"], "engine_name": st["name"], "max_hold_days": e["max_hold"],
                        "typical_days_to_t1": st["timeline"]["median_days_to_t1"],
                        "also_names": [results["engines"][x]["name"] for x in e.get("also", []) if x in results["engines"]]})
    order = {"open": 0, "pending": 1, "closed": 2, "void": 3}
    signals.sort(key=lambda x: (order.get(x["status"], 9), 0 if x.get("bench_ok") else 1, x["engine"], x["sym"]))
    engines = {}
    for key, st in results["engines"].items():
        act = [x for x in signals if x["engine"] == key and x["status"] in ("pending", "open")]
        engines[key] = {**st, "rules": RULES[key], "signal_count": len(act)}
    return {"generated": time.strftime("%Y-%m-%dT%H:%M:%S"), "data_through": today,
            "backtest": {k: results[k] for k in ("generated", "data_through", "universe", "cost_round_trip_pct", "splits", "notes")},
            "launched": reg.get("launched"), "live_record": registry.forward_record(reg),
            "exit_plan": EXIT_PLAN, "benchmarks": sector_board(ctx, bars), "engines": engines, "signals": signals}


if __name__ == "__main__":
    import data
    results = json.loads(pathlib.Path("research/results.json").read_text())
    if len(sys.argv) > 1:
        d = pd.read_pickle(sys.argv[1])
        bars, uni, bench, indices = d["bars"], d["universe"], d["bench"], d.get("indices")
    else:
        import yfinance as yf
        uni = data.universe()
        bars = data.download([u["sym"] for u in uni], period="5y")
        # A thin download must never become a published result: a stock missing from the data cannot be selected, and its
        # open trade would silently stop being tracked.
        if len(bars) < 0.85 * len(uni):
            raise SystemExit(f"only {len(bars)} of {len(uni)} symbols downloaded: refusing to publish")
        latest = max(d.index[-1] for d in bars.values())
        if (pd.Timestamp.now().normalize() - latest).days > 5:
            raise SystemExit(f"newest price bar is {latest.date()}: the data is stale, refusing to publish")
        b = yf.download("^NSEI", period="5y", interval="1d", auto_adjust=True, progress=False)
        b.columns = [c[0] if isinstance(c, tuple) else c for c in b.columns]
        bench = b["Close"].dropna()
        bench.index = pd.to_datetime(bench.index).tz_localize(None)
        indices = data.indices("5y")
    reg = registry.load()
    out = build(bars, uni, bench, results, indices, reg)
    registry.save(reg)
    dest = pathlib.Path("../public/engines.json")
    dest.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {dest}: {len(out['signals'])} signals in view, data through {out['data_through']}; registry now {len(reg['signals'])} trades")
    for k, e in out["engines"].items():
        print(f"  {k:<11} {e['status']:<18} {e['signal_count']} signals now")
