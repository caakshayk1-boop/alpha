"""Paper book (PREREGISTRATION §5): one position per symbol, a primary engine plus supporting tags, and the frozen limits.
  risk per position 0.25% of equity · total open initial risk <= 1.5% · at most 6 positions · sector value <= 25% of equity
  shares = floor(risk budget / stop distance), capped by CASH (no leverage), a 20% maximum position and 1% of the 20-day median
  traded value; open risk is the sum of actual stop distances x shares, not a count of positions
Orders are decided at the signal close. One that the next open cancels still used its place that day: a lower-ranked name never
takes its slot with knowledge of the open (DECISIONS #8g). Equity is fixed (no compounding). Every plan the book takes is walked
by execsim.simulate on the same bars; nothing is resized after the fact. Daily returns are marked to market every session."""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .costs import CostModel
from .execsim import Plan, simulate

LIMITS = {"risk_pct": 0.25, "max_open_risk_pct": 1.5, "max_positions": 6, "sector_pct": 25.0, "max_position_pct": 20.0, "adv_pct": 1.0}


@dataclass
class Cand:
    engine: str
    sym: str
    date: pd.Timestamp
    t: int
    score: float
    ref: float
    stop: float
    atr: float
    tv: float
    sector: str | None
    regime: str
    status: str                      # active | paper_only
    make_plan: object                # callable(qty) -> Plan


@dataclass
class Position:
    cand: Cand
    qty: int
    fill: object
    exit_date: pd.Timestamp | None
    tags: list = field(default_factory=list)


def run_book(cands: list[Cand], bars: dict[str, pd.DataFrame], costs: CostModel, equity: float = 1_000_000.0,
             limits: dict = LIMITS) -> tuple[list[Position], dict]:
    by_day: dict[pd.Timestamp, list[Cand]] = {}
    for c in cands:
        by_day.setdefault(c.date, []).append(c)
    open_: list[Position] = []
    done: list[Position] = []
    skipped = {"symbol_held": 0, "limits": 0, "size": 0, "cancelled": 0, "no_next_session": 0}
    risk_rs = equity * limits["risk_pct"] / 100
    for d in sorted(by_day):
        still = []
        for p in open_:
            if p.exit_date is not None and p.exit_date <= d:
                done.append(p)
            else:
                still.append(p)
        open_ = still
        day = sorted(by_day[d], key=lambda c: (-c.score, c.engine, c.sym))
        taken_today: dict[str, Position] = {}
        placed: list[tuple[Cand, int]] = []                       # orders placed at today's close, filled or not
        pending_tags: dict[str, list] = {}
        for c in day:
            held = next((p for p in open_ if p.cand.sym == c.sym), None) or taken_today.get(c.sym)
            first = next((pc for pc, _ in placed if pc.sym == c.sym), None)
            if held is not None or first is not None:
                owner, tags = (held.cand, held.tags) if held is not None else (first, pending_tags.setdefault(c.sym, []))
                if c.engine != owner.engine and c.engine not in tags:
                    tags.append(c.engine)
                skipped["symbol_held"] += 1
                continue
            n_open = len(open_) + len(placed)
            open_risk = sum((p.cand.ref - p.cand.stop) * p.qty for p in open_) + sum((pc.ref - pc.stop) * q for pc, q in placed)
            cash_used = sum(p.cand.ref * p.qty for p in open_) + sum(pc.ref * q for pc, q in placed)
            if n_open >= limits["max_positions"]:
                skipped["limits"] += 1
                continue
            dist = c.ref - c.stop
            qty = int(risk_rs // dist) if dist > 0 else 0
            qty = min(qty, int(equity * limits["max_position_pct"] / 100 // c.ref), int((c.tv or 0) * 1e7 * limits["adv_pct"] / 100 // c.ref),
                      int(max(0.0, equity - cash_used) // c.ref))
            sec_val = sum(p.qty * p.cand.ref for p in open_ if p.cand.sector == c.sector and c.sector) + sum(q * pc.ref for pc, q in placed if pc.sector == c.sector and c.sector)
            qty = min(qty, int(max(0.0, equity * limits["sector_pct"] / 100 - sec_val) // c.ref))
            if qty >= 1 and open_risk + dist * qty > equity * limits["max_open_risk_pct"] / 100 + 1e-6:
                qty = int(max(0.0, equity * limits["max_open_risk_pct"] / 100 - open_risk) // dist) if dist > 0 else 0
                if qty < 1:
                    skipped["limits"] += 1
                    continue
            if qty < 1:
                skipped["size"] += 1
                continue
            placed.append((c, qty))
        for c, qty in placed:                                    # the next open decides which placed orders fill
            f = simulate(bars[c.sym], c.make_plan(qty), costs)
            if f.status in ("cancelled_gap", "cancelled_chase", "cancelled_risk"):
                skipped["cancelled"] += 1
                continue
            if f.status == "no_next_session":
                skipped["no_next_session"] += 1
                continue
            ed = bars[c.sym].index[f.exit_i] if f.status == "filled" else None
            pos = Position(c, qty, f, ed, list(pending_tags.get(c.sym, [])))
            open_.append(pos)
            taken_today[c.sym] = pos
    return done + open_, skipped


def position_pnl(df: pd.DataFrame, p: Position, costs: CostModel) -> pd.Series:
    """Rupee P&L of one position, session by session, marked at each close; fills, exits and costs on the sessions they happen.
    Sums to the trade's net rupee result."""
    f = p.fill
    c = df["Close"].to_numpy(float)
    out = pd.Series(0.0, index=df.index)
    if f.status not in ("filled", "open") or f.entry_i is None:
        return out
    last = f.exit_i if f.status == "filled" else len(df) - 1
    by_bar: dict[int, list] = {}
    for i, px, fr, _ in f.exits:
        by_bar.setdefault(i, []).append((px, fr))
    held, mark_prev = float(p.qty), f.entry * p.qty
    vals = np.zeros(len(df))
    vals[f.entry_i] -= costs.side(f.entry * p.qty, True)
    for i in range(f.entry_i, last + 1):
        cash = 0.0
        for px, fr in by_bar.get(i, []):
            q = fr * p.qty
            cash += px * q - costs.side(px * q, False)
            held -= q
        mark = held * c[i]
        vals[i] += cash + mark - mark_prev
        mark_prev = mark
    return pd.Series(vals, index=df.index)


def daily_returns(positions: list[Position], equity: float, index: pd.DatetimeIndex, bars: dict | None = None, costs: CostModel | None = None) -> pd.Series:
    """Book return per session over fixed equity, marked to market every session (DECISIONS #8c). Without bars, the old
    realised-on-exit basis (kept for the unit tests that pin it)."""
    s = pd.Series(0.0, index=index)
    for p in positions:
        f = p.fill
        if bars is not None and costs is not None:
            if f.status in ("filled", "open"):
                s = s.add(position_pnl(bars[p.cand.sym], p, costs).reindex(index, fill_value=0.0) / equity, fill_value=0.0)
        elif f.status == "filled" and p.exit_date in s.index:
            risk = (f.entry - p.cand.stop) * p.qty
            s.loc[p.exit_date] += f.r_net * risk / equity
    return s
