"""Execution simulator (PREREGISTRATION §3-§4). One function walks one plan through daily bars after the signal:

  entry     next-session open plus modelled impact (half-spread + slippage). CANCELLED if the open is at or below the stop or
            above the chase limit (signal close + 0.5 ATR); the plan expires after the next session.
  stops     a gap through the stop fills at the open; otherwise at the stop. When a bar touches the stop AND a target, the stop
            is taken first and the trade is flagged `ambiguous_bar`.
  partials  each exit's R is measured against the ORIGINAL risk (entry - initial stop); R is never reset when a stop moves.
  trailing  computed on the completed bar, effective from the next session's open.
  costs     itemised rupees per order (costs.CostModel), converted to R on the original risk; gross and net are both kept.
The fill rules apply the same way to every engine; engine-specific exits arrive as callables evaluated on completed bars only."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np
import pandas as pd

from .costs import CostModel


@dataclass
class Plan:
    engine: str
    sym: str
    t_signal: int                                  # bar index of the completed signal bar
    stop: float
    chase: float                                   # highest acceptable entry open
    time_stop: int                                 # sessions held, counting the entry session
    targets: list[tuple[float, float]] = field(default_factory=list)    # (price, fraction of the original position)
    exit_on_close: Callable[[int, float], bool] | None = None            # (bar index, entry) -> exit the rest at next open
    trail: Callable[[int], float | None] | None = None                   # bar index -> new stop from that completed bar
    adv_cr: float | None = None
    qty: int = 1


@dataclass
class Fill:
    status: str                                    # filled | cancelled_gap | cancelled_chase | no_next_session | open
    entry: float | None = None
    entry_i: int | None = None
    exits: list = field(default_factory=list)      # (bar index, price, fraction, reason)
    r_gross: float | None = None
    r_net: float | None = None
    cost_rs: float = 0.0
    ambiguous_bar: bool = False
    exit_i: int | None = None
    reason: str | None = None


def simulate(df: pd.DataFrame, plan: Plan, costs: CostModel) -> Fill:
    o, h, l, c = (df[k].to_numpy(dtype=float) for k in ("Open", "High", "Low", "Close"))
    i0 = plan.t_signal + 1
    if i0 >= len(df):
        return Fill("no_next_session")
    imp = costs.impact(plan.adv_cr)
    if o[i0] <= plan.stop:
        return Fill("cancelled_gap")
    if o[i0] > plan.chase:
        return Fill("cancelled_chase")
    entry = o[i0] * (1 + imp)
    risk = entry - plan.stop
    if risk <= 0:
        return Fill("cancelled_gap")
    stop, left, exits, amb = plan.stop, 1.0, [], False
    pending_exit = False
    targets = sorted(plan.targets)
    last = min(len(df) - 1, i0 + plan.time_stop - 1)
    for i in range(i0, last + 1):
        if pending_exit:                            # a close-based exit decided on bar i-1 executes at this open
            exits.append((i, o[i] * (1 - imp), left, "rule_exit"))
            left = 0.0
            break
        if i > i0 and o[i] <= stop:                # gap through the stop: filled at the open
            exits.append((i, o[i] * (1 - imp), left, "stop_gap"))
            left = 0.0
            break
        hit_t = [tp for tp in targets if h[i] >= tp[0]]
        if l[i] <= stop:
            if hit_t:
                amb = True                          # stop and target in one bar: stop first, flagged
            exits.append((i, stop * (1 - imp), left, "stop"))
            left = 0.0
            break
        for tp in hit_t:
            frac = min(tp[1], left)
            if frac > 0:
                exits.append((i, tp[0] * (1 - imp), frac, "target"))
                left -= frac
            targets.remove(tp)
        if left <= 1e-12:
            left = 0.0
            break
        if plan.trail is not None:                  # completed-bar trail, effective next session
            ns = plan.trail(i)
            if ns is not None and ns > stop:
                stop = ns
        if plan.exit_on_close is not None and plan.exit_on_close(i, entry):
            pending_exit = True
            if i == len(df) - 1:
                break
    if left > 0:
        if last - i0 + 1 == plan.time_stop:         # held the full time: exit at the close of the last allowed session
            exits.append((last, c[last] * (1 - imp), left, "time"))
            left = 0.0
        else:                                       # the data end first: the trade is still open, nothing is booked
            return Fill("open", entry=entry, entry_i=i0, exits=exits, ambiguous_bar=amb)
    value_in = entry * plan.qty
    cost = costs.side(value_in, True) + sum(costs.side(px * plan.qty * fr, False) for _, px, fr, _ in exits)
    gross_pnl = sum((px - entry) * fr for _, px, fr, _ in exits)
    r_gross = gross_pnl / risk
    r_net = r_gross - cost / (risk * plan.qty)
    xi = exits[-1][0]
    return Fill("filled", entry, i0, exits, float(r_gross), float(r_net), float(cost), amb, xi, exits[-1][3])


def signal_close_plus_atr(close: float, atr: float, k: float = 0.5) -> float:
    return close + k * atr
