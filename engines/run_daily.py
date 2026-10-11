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


def build(bars: dict, uni: list[dict], bench: pd.Series, results: dict) -> dict:
    ctx = Ctx(bars, bench)
    info = {u["sym"]: u for u in uni}
    signals = []
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
                if s.t < n - 3:
                    continue
                last = float(df["Close"].iloc[-1])
                t1, t2, t3 = s.targets
                if last >= t1 or last <= s.sl:       # already past the first target or the stop: no longer actionable
                    continue
                risk = s.ref_price - s.sl
                signals.append({
                    "engine": key, "engine_name": st["name"], "sym": sym, "name": info.get(sym, {}).get("name", sym),
                    "sector": info.get(sym, {}).get("sector"), "date": str(s.date.date()), "setup": s.setup, "horizon": s.horizon,
                    "ref_price": round(s.ref_price, 2), "last_close": round(last, 2),
                    "entry_zone": [round(min(last, s.ref_price), 2), round(s.ref_price * 1.01, 2)],
                    "sl": round(s.sl, 2), "risk_pct": round(risk / s.ref_price * 100, 1),
                    "targets": [round(x, 2) for x in s.targets], "r_multiples": [round((x - s.ref_price) / risk, 2) for x in s.targets],
                    "max_hold_days": s.max_hold, "reasons": s.reasons,
                    "typical_days_to_t1": st["timeline"]["median_days_to_t1"],
                    "engine_status": st["status"],
                })
    signals.sort(key=lambda x: (x["engine"], x["date"], x["sym"]), reverse=False)
    engines = {}
    for key, st in results["engines"].items():
        engines[key] = {**st, "rules": RULES[key], "signal_count": sum(1 for x in signals if x["engine"] == key)}
    return {"generated": time.strftime("%Y-%m-%dT%H:%M:%S"), "data_through": str(max(d.index[-1] for d in bars.values()).date()),
            "backtest": {k: results[k] for k in ("generated", "data_through", "universe", "cost_round_trip_pct", "splits")},
            "exit_plan": EXIT_PLAN, "engines": engines, "signals": signals}


if __name__ == "__main__":
    import data
    results = json.loads(pathlib.Path("research/results.json").read_text())
    if len(sys.argv) > 1:
        d = pd.read_pickle(sys.argv[1])
        bars, uni, bench = d["bars"], d["universe"], d["bench"]
    else:
        import yfinance as yf
        uni = data.universe()
        bars = data.download([u["sym"] for u in uni], period="5y")
        b = yf.download("^NSEI", period="5y", interval="1d", auto_adjust=True, progress=False)
        b.columns = [c[0] if isinstance(c, tuple) else c for c in b.columns]
        bench = b["Close"].dropna()
        bench.index = pd.to_datetime(bench.index).tz_localize(None)
    out = build(bars, uni, bench, results)
    dest = pathlib.Path("../public/engines.json")
    dest.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {dest}: {len(out['signals'])} live signals, data through {out['data_through']}")
    for k, e in out["engines"].items():
        print(f"  {k:<11} {e['status']:<18} {e['signal_count']} signals now")
