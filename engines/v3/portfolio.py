"""Paper book (PREREGISTRATION §5): one position per symbol, a primary engine plus supporting tags, and the frozen limits.
  risk per position 0.25% of equity · total open initial risk <= 1.5% · at most 6 positions · sector value <= 25% of equity
  shares = floor(risk budget / stop distance), capped by cash, a 20% maximum position and 1% of the 20-day median traded value
Equity is held fixed (no compounding), so a result in rupees is the same result in R at every date. Every plan the book takes is
walked by execsim.simulate on the same bars; nothing is resized after the fact."""
from __future__ import annotations

from dataclasses import dataclass, field

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
        for c in day:
            held = next((p for p in open_ if p.cand.sym == c.sym), None) or taken_today.get(c.sym)
            if held is not None:                                     # one position per symbol: a supporting tag, not a trade
                if c.engine != held.cand.engine and c.engine not in held.tags:
                    held.tags.append(c.engine)
                skipped["symbol_held"] += 1
                continue
            if len(open_) >= limits["max_positions"] or (len(open_) + 1) * limits["risk_pct"] > limits["max_open_risk_pct"] + 1e-9:
                skipped["limits"] += 1
                continue
            dist = c.ref - c.stop
            qty = int(risk_rs // dist) if dist > 0 else 0
            qty = min(qty, int(equity * limits["max_position_pct"] / 100 // c.ref), int((c.tv or 0) * 1e7 * limits["adv_pct"] / 100 // c.ref))
            sec_val = sum(p.qty * p.cand.ref for p in open_ if p.cand.sector == c.sector and c.sector)
            qty = min(qty, int(max(0.0, equity * limits["sector_pct"] / 100 - sec_val) // c.ref))
            if qty < 1:
                skipped["size"] += 1
                continue
            plan: Plan = c.make_plan(qty)
            f = simulate(bars[c.sym], plan, costs)
            if f.status in ("cancelled_gap", "cancelled_chase"):
                skipped["cancelled"] += 1
                continue
            if f.status == "no_next_session":
                skipped["no_next_session"] += 1
                continue
            ed = bars[c.sym].index[f.exit_i] if f.status == "filled" else None
            pos = Position(c, qty, f, ed)
            open_.append(pos)
            taken_today[c.sym] = pos
    return done + open_, skipped


def daily_returns(positions: list[Position], equity: float, index: pd.DatetimeIndex) -> pd.Series:
    """Book return per session: closed trades' net rupee P&L on their exit date, over fixed equity (realised basis)."""
    s = pd.Series(0.0, index=index)
    for p in positions:
        f = p.fill
        if f.status == "filled" and p.exit_date in s.index:
            risk = (f.entry - p.cand.stop) * p.qty
            s.loc[p.exit_date] += f.r_net * risk / equity
    return s
