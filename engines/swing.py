"""swing.py — Alpha Swing v2 (launched 21 Oct 2026). One rule book, two setups, one exit plan. Replaces the five ML engines.

WHY THIS EXISTS
  The five ML engines ranked every stock every evening and the top ranks always became signals, whatever the market was
  doing. None cleared a significant holdout (best month-clustered t +1.42). This book does the opposite: it trades only
  when the market itself is in a state where long swing trades have historically worked, only in stocks that are already
  leading, and only on two textbook setups. On most days it issues nothing, and that is the intended behaviour.

THE RULES (fixed in code on 21 Oct 2026, before any test of them was run; round, textbook numbers, not tuned)

  1. Market gate: no new trade unless ALL four hold at the signal close.
       Nifty above its 200-day average, and that average rising over 20 sessions   (the primary trend is up)
       Nifty above its 50-day average                                               (the intermediate trend agrees)
       At least 50% of the universe above its own 50-day average                    (the advance is broad, not a few names)
       India VIX at or below 20                                                     (volatility is normal)
  2. Stock gate: all of
       median traded value of the last 20 sessions >= Rs 10 crore, price >= Rs 50   (you can get in and out)
       close > 50-day average > 200-day average, 200-day rising over 20 sessions    (stage 2 uptrend)
       within 25% of its 52-week high                                               (leaders, not laggards)
       3-month return ahead of the Nifty's                                          (relative strength)
       its group benchmark above a rising 50-day average                            (the sector agrees)
       not up more than 15% in the last 5 sessions                                  (never chase)
  3. Setups (a stock qualifies on one):
       PULLBACK  in the last 5 sessions the low came within 1% of the 20-day EMA and RSI(14) bottomed between 38 and 55;
                 today closes above yesterday's high and above the 20-day EMA, in the top 40% of its range, on at least
                 average volume (the pullback has ended and buyers are back).
       BREAKOUT  today closes above the highest high of the prior 40 sessions, out of a base no deeper than 20%, on at
                 least 1.5x the 50-day average volume, in the top 30% of its range, and not more than 10% above the 20-day
                 EMA (a tight base breaking on demand, not an extended spike).
  4. Plan, written once at issue and never moved by hand:
       entry   the next session's open. Skipped if that open is more than 2% above the signal close (no chasing a gap)
               or at or below the stop. T1 and T2 are then set from the actual entry: entry + 2R and + 4R.
       stop    the lowest low of the last 10 sessions, less 0.2 ATR (below the structure, not a round percentage).
               If that risks more than 8% or less than 2% of the signal close, there is no trade (never widen or squeeze
               a stop to make a trade fit).
       T1      entry + 2R: sell half. The stop on the other half moves to entry + 0.5R (a locked profit, never break-even).
       trail   after T1 the stop rises to the lowest low of the last 10 sessions whenever that is higher. It never falls.
       T2      entry + 4R: sell the rest.
       time    whatever is left exits at the close of session 30.
       A gap through the stop exits at the open. A session that spans the stop and a target counts the stop first.
  5. Book limits: at most 3 new trades a session (ranked by 6-month relative strength), at most 10 open, at most 2 open in
     one sector, one trade per stock, and 20 sessions before the same stock can be traded again.
  6. Costs of 0.25% of entry per round trip are charged on every tested and every live closed trade.

Pure functions of bars known at each close: no lookahead. The backtest and the live tracker use the same walk().
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from common import COST_PCT, Trade
from indicators import atr, ema, rsi, sma

VERSION = "swing-2.0.0"
LAUNCHED = "2026-10-21"

P = {
    "gate_vix_max": 20.0, "gate_breadth_min": 0.50,
    "min_turnover_cr": 10.0, "min_price": 50.0, "max_from_high": 0.25, "max_run_5d": 0.15,
    "pb_touch": 0.01, "pb_rsi_lo": 38.0, "pb_rsi_hi": 55.0, "pb_close_pos": 0.60,
    "bo_lookback": 40, "bo_base_depth": 0.20, "bo_vol_mult": 1.5, "bo_close_pos": 0.70, "bo_max_ext": 0.10,
    "stop_lookback": 10, "stop_atr_pad": 0.2, "risk_min": 0.02, "risk_max": 0.08, "gap_max": 0.02,
    "t1_r": 2.0, "t2_r": 4.0, "lock_r": 0.5, "trail_lookback": 10, "max_hold": 30,
    "max_new_per_day": 3, "max_open": 10, "max_per_sector": 2, "cooldown": 20,
}

# The rules as the site prints them: one sentence each, the same numbers as P.
RULES = {
    "gate": [
        "Nifty above its 200-day average, and that average rising over 20 sessions",
        "Nifty above its 50-day average",
        "At least 50% of stocks above their own 50-day average",
        "India VIX at or below 20",
    ],
    "stock": [
        "Trades at least ₹10 crore a day (20-session median) and costs at least ₹50",
        "Close above the 50-day average, the 50-day above a rising 200-day",
        "Within 25% of its 52-week high",
        "Ahead of the Nifty over 3 months",
        "Its sector benchmark above a rising 50-day average",
        "Not up more than 15% in the last 5 sessions",
    ],
    "setups": {
        "Pullback": "Dipped to the 20-day EMA with RSI 38-55 in the last 5 sessions, then closed above the prior day's high and the EMA, in the top 40% of its range, on average volume or more.",
        "Breakout": "Closed above the highest high of the prior 40 sessions, out of a base no deeper than 20%, on 1.5x average volume, in the top 30% of its range, not more than 10% above the 20-day EMA.",
    },
    "plan": [
        "Enter at the next session's open; skip it if the open is more than 2% above the signal close or at or below the stop. T1 and T2 are set from the actual entry.",
        "Stop: the lowest low of the last 10 sessions, less 0.2 ATR. No trade if that risks more than 8% or less than 2%.",
        "T1 at +2R: sell half. The stop on the rest moves to entry + 0.5R, a locked profit.",
        "After T1 the stop trails up to the lowest low of the last 10 sessions. It never moves down.",
        "T2 at +4R: sell the rest. Whatever is left exits at the close of session 30.",
        "A gap through the stop exits at the open; a session that spans the stop and a target counts the stop first.",
    ],
    "book": [
        "At most 3 new trades a session, ranked by 6-month relative strength.",
        "At most 10 open trades, at most 2 in one sector, one per stock.",
        "20 sessions before the same stock can be traded again.",
    ],
}


# ── the market gate ──────────────────────────────────────────────────────────
def market_gate(bench: pd.Series, vix: pd.Series | None, bars: dict) -> pd.DataFrame:
    """One row per session: the four checks, their values, and `on` when all four hold. VIX missing on a day = not passed
    (the gate never assumes a check it could not make)."""
    idx = bench.index
    s50, s200 = sma(bench, 50), sma(bench, 200)
    closes = pd.DataFrame({s: d["Close"] for s, d in bars.items()}).reindex(idx)
    above50 = (closes > closes.rolling(50, min_periods=50).mean())
    counted = closes.rolling(50, min_periods=50).mean().notna().sum(axis=1)
    breadth = (above50.sum(axis=1) / counted.replace(0, np.nan))
    v = vix.reindex(idx, method="ffill") if vix is not None and len(vix) else pd.Series(np.nan, index=idx)
    g = pd.DataFrame({
        "nifty": bench, "sma50": s50, "sma200": s200,
        "trend": (bench > s200) & (s200 > s200.shift(20)),
        "intermediate": bench > s50,
        "breadth": breadth, "breadth_ok": breadth >= P["gate_breadth_min"],
        "vix": v, "vix_ok": v <= P["gate_vix_max"],
    }, index=idx)
    g["on"] = g["trend"] & g["intermediate"] & g["breadth_ok"] & g["vix_ok"].fillna(False)
    return g


# ── the stock gate and the two setups ───────────────────────────────────────
@dataclass
class Cand:
    sym: str
    t: int
    date: pd.Timestamp
    setup: str
    ref: float
    sl: float
    t1: float
    t2: float
    rank: float
    why: list[str] = field(default_factory=list)


def _features(df: pd.DataFrame) -> pd.DataFrame:
    c, h, lo, v = df["Close"], df["High"], df["Low"], df["Volume"]
    f = pd.DataFrame(index=df.index)
    f["ema20"] = ema(c, 20)
    f["sma50"], f["sma200"] = sma(c, 50), sma(c, 200)
    f["rsi"] = rsi(c, 14)
    f["atr"] = atr(df, 14)
    f["tv"] = (c * v).rolling(20, min_periods=20).median() / 1e7
    f["hi252"] = h.rolling(252, min_periods=200).max()
    f["vol20"], f["vol50"] = v.rolling(20, min_periods=20).mean(), v.rolling(50, min_periods=50).mean()
    rng = (h - lo).replace(0, np.nan)
    f["pos"] = (c - lo) / rng
    f["prior_hi"] = h.shift(1).rolling(P["bo_lookback"], min_periods=P["bo_lookback"]).max()
    f["prior_lo"] = lo.shift(1).rolling(P["bo_lookback"], min_periods=P["bo_lookback"]).min()
    f["low10"] = lo.rolling(P["stop_lookback"], min_periods=P["stop_lookback"]).min()
    f["r63"], f["r5"] = c / c.shift(63) - 1, c / c.shift(5) - 1
    f["touch"] = (lo <= f["ema20"] * (1 + P["pb_touch"])).rolling(5, min_periods=5).max().astype(bool)
    f["rsi_min5"] = f["rsi"].rolling(5, min_periods=5).min()
    return f


def scan_stock(sym: str, df: pd.DataFrame, gate: pd.DataFrame, ctx, nifty_r63: pd.Series, rs126: pd.Series | None,
               lo: pd.Timestamp, hi: pd.Timestamp) -> list[Cand]:
    """Every session in [lo, hi) where this stock passes the gate, the stock checks and one setup, with its plan."""
    if len(df) < 260:
        return []
    f = _features(df)
    c, h, low, v = df["Close"], df["High"], df["Low"], df["Volume"]
    on = gate["on"].reindex(df.index).fillna(False).astype(bool)
    sec = ctx.sec_trend(sym, df.index) if ctx is not None else pd.Series(False, index=df.index)
    nr = nifty_r63.reindex(df.index, method="ffill")
    stock_ok = (
        on & sec
        & (f["tv"] >= P["min_turnover_cr"]) & (c >= P["min_price"])
        & (c > f["sma50"]) & (f["sma50"] > f["sma200"]) & (f["sma200"] > f["sma200"].shift(20))
        & (c >= f["hi252"] * (1 - P["max_from_high"]))
        & (f["r63"] > nr) & (f["r5"] <= P["max_run_5d"])
    )
    pull = (f["touch"] & f["rsi_min5"].between(P["pb_rsi_lo"], P["pb_rsi_hi"]) & (c > h.shift(1)) & (c > f["ema20"])
            & (f["pos"] >= P["pb_close_pos"]) & (v >= f["vol20"]))
    brk = ((c > f["prior_hi"]) & (f["prior_hi"] / f["prior_lo"] - 1 <= P["bo_base_depth"]) & (v >= P["bo_vol_mult"] * f["vol50"])
           & (f["pos"] >= P["bo_close_pos"]) & (c <= f["ema20"] * (1 + P["bo_max_ext"])))
    hit = stock_ok & (pull | brk)
    out: list[Cand] = []
    dates = df.index
    for t in np.flatnonzero(hit.values):
        d = dates[t]
        if d < lo or d >= hi:
            continue
        ref = float(c.iloc[t])
        a = float(f["atr"].iloc[t])
        sl = float(f["low10"].iloc[t]) - P["stop_atr_pad"] * a
        risk = ref - sl
        if not (a > 0) or not (P["risk_min"] <= risk / ref <= P["risk_max"]):
            continue
        setup = "Breakout" if bool(brk.iloc[t]) else "Pullback"
        g = gate.loc[d] if d in gate.index else None
        why = [
            f"Market gate on: Nifty {g['nifty']:,.0f} above its 50-day ({g['sma50']:,.0f}) and rising 200-day ({g['sma200']:,.0f}); "
            f"{g['breadth'] * 100:.0f}% of stocks above their 50-day; VIX {g['vix']:.1f}" if g is not None else "Market gate on",
            f"Uptrend: close {ref:,.2f} > 50-day {f['sma50'].iloc[t]:,.2f} > rising 200-day {f['sma200'].iloc[t]:,.2f}",
            f"{(1 - ref / f['hi252'].iloc[t]) * 100:.1f}% below its 52-week high; 3-month return {f['r63'].iloc[t] * 100:+.1f}% against the Nifty's {nr.iloc[t] * 100:+.1f}%",
            f"Trades ₹{f['tv'].iloc[t]:,.0f} crore a day",
            ("Breakout above ₹{:,.2f}, the 40-session high, on {:.1f}x average volume".format(f["prior_hi"].iloc[t], v.iloc[t] / f["vol50"].iloc[t])
             if setup == "Breakout" else
             "Pullback to the 20-day EMA (RSI low {:.0f}), then a close above the prior high on {:.1f}x average volume".format(f["rsi_min5"].iloc[t], v.iloc[t] / f["vol20"].iloc[t])),
        ]
        rk = rs126.get(d) if rs126 is not None else None
        rk = float(rk) if rk is not None and pd.notna(rk) else 0.0
        out.append(Cand(sym, int(t), d, setup, ref, sl, ref + P["t1_r"] * risk, ref + P["t2_r"] * risk, rk, why))
    return out


# ── the exit plan ────────────────────────────────────────────────────────────
def walk(df: pd.DataFrame, t_signal: int, ref: float, sl: float, t1_r: float = P["t1_r"], t2_r: float = P["t2_r"],
         max_hold: int = P["max_hold"]) -> dict | None:
    """The one implementation of the plan, used by the backtest and the live tracker alike.

    None: no next session yet. {"void": True, ...}: the opening gap skipped it. Otherwise entry, events
    [(bar index, kind, price, fraction)], half (bool: T1 booked), stop (current), closed, exit_i, exit_reason, pnl (price
    units, weighted by fraction sold), remaining, risk, t1, t2. Targets are re-based on the ACTUAL entry: entry + 2R/4R
    with R = entry - stop."""
    o, h, l, c = df["Open"].values, df["High"].values, df["Low"].values, df["Close"].values
    t0 = t_signal + 1
    if t0 >= len(df):
        return None
    entry = float(o[t0])
    risk = entry - sl
    t1, t2 = entry + t1_r * risk, entry + t2_r * risk
    if not (entry > 0) or entry > ref * (1 + P["gap_max"]) or entry <= sl or risk <= 0:
        return {"void": True, "entry": entry, "entry_i": t0, "reason": "gap above the 2% limit" if entry > ref * (1 + P["gap_max"]) else "opened at or below the stop"}
    remaining, pnl, stop, half = 1.0, 0.0, sl, False
    events: list[tuple[int, str, float, float]] = [(t0, "entry", entry, 1.0)]
    last = min(len(df) - 1, t0 + max_hold - 1)
    reason, exit_i, closed = "", t0, False
    for i in range(t0, last + 1):
        if half and i - P["trail_lookback"] >= 0:                    # the trail uses lows already known at this open
            trail = float(np.min(l[i - P["trail_lookback"]:i]))
            if trail > stop:
                stop = trail
        if l[i] <= stop or o[i] <= stop:                             # the stop first, including a gap through it
            px = o[i] if o[i] < stop else stop
            pnl += remaining * (px - entry)
            kind = "stop" if not half else ("trail" if stop > entry + P["lock_r"] * risk + 1e-9 else "lock")
            events.append((i, kind, float(px), remaining))
            reason, exit_i, remaining, closed = kind, i, 0.0, True
            break
        if not half and h[i] >= t1:
            px = o[i] if o[i] > t1 else t1
            pnl += 0.5 * (px - entry)
            remaining, half = 0.5, True
            stop = max(stop, entry + P["lock_r"] * risk)
            events.append((i, "t1", float(px), 0.5))
        if half and h[i] >= t2:
            px = o[i] if o[i] > t2 else t2
            pnl += remaining * (px - entry)
            events.append((i, "t2", float(px), remaining))
            reason, exit_i, remaining, closed = "t2", i, 0.0, True
            break
    if not closed and last == t0 + max_hold - 1:
        pnl += remaining * (c[last] - entry)
        events.append((last, "time", float(c[last]), remaining))
        reason, exit_i, remaining, closed = "time", last, 0.0, True
    return {"void": False, "entry": entry, "entry_i": t0, "events": events, "half": half, "stop": stop, "closed": closed,
            "exit_i": exit_i, "exit_reason": reason, "pnl": pnl, "remaining": remaining, "risk": risk, "t1": t1, "t2": t2}


def to_trade(sym: str, setup: str, date: pd.Timestamp, df: pd.DataFrame, w: dict, cost_pct: float = COST_PCT) -> Trade:
    gross = w["pnl"] / w["risk"]
    t0 = w["entry_i"]
    t1b = next((e[0] - t0 + 1 for e in w["events"] if e[1] == "t1"), None)
    return Trade("swing", sym, date, df.index[t0], df.index[w["exit_i"]], w["entry"], w["entry"] - w["risk"],
                 float(gross - cost_pct * w["entry"] / w["risk"]), float(gross), int(w["exit_i"] - t0 + 1),
                 int(sum(1 for e in w["events"] if e[1] in ("t1", "t2"))), w["exit_reason"], setup, "swing", t1b, None, None)


# ── the book: limits applied in date order, exactly as the live run applies them ─
def run_book(cands: list[Cand], bars: dict, sector_of: dict, limits: bool = True) -> list[tuple[Cand, dict]]:
    """Take candidates in date order under the book limits. A taken trade occupies its slot from the signal date to its exit
    (or to the end of data while open). Returns [(cand, walk result)] for every trade taken, void ones included."""
    by_date: dict[pd.Timestamp, list[Cand]] = {}
    for x in cands:
        by_date.setdefault(x.date, []).append(x)
    taken: list[tuple[Cand, dict]] = []
    active: list[tuple[pd.Timestamp, str, str]] = []          # (exit date, sym, sector)
    last_exit: dict[str, pd.Timestamp] = {}
    for d in sorted(by_date):
        active = [a for a in active if a[0] > d]
        day = sorted(by_date[d], key=lambda x: (-x.rank, x.sym))
        new = 0
        for x in day:
            df = bars[x.sym]
            if limits:
                if new >= P["max_new_per_day"] or len(active) >= P["max_open"]:
                    break
                if any(a[1] == x.sym for a in active):
                    continue
                if sum(1 for a in active if a[2] == sector_of.get(x.sym)) >= P["max_per_sector"]:
                    continue
                le = last_exit.get(x.sym)
                if le is not None and le in df.index and df.index.get_loc(d) - df.index.get_loc(le) < P["cooldown"]:
                    continue
            w = walk(df, x.t, x.ref, x.sl)
            if w is None:
                continue
            taken.append((x, w))
            if w.get("void"):
                continue
            end = df.index[w["exit_i"]] if w["closed"] else pd.Timestamp("2100-01-01")
            active.append((end, x.sym, sector_of.get(x.sym)))
            if w["closed"]:
                last_exit[x.sym] = end
            new += 1
    return taken
