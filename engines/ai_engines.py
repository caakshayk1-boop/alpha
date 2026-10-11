"""ai_engines.py — the five AI engines: what each one predicts, how its scores become trades, and how those trades are exited.

An engine is a model (walkfwd.py) plus a TRADE LAYER. The model ranks stocks; the trade layer decides which ranks become
signals and prices a stop and three targets from the stock's own volatility (ATR), never from a hand-drawn chart level.
The exits are the same for every engine (common.walk): thirds at T1, T2, T3; the stop moves to entry after T1 and to T1
after T2; a gap through the stop fills at the open; a time limit closes the rest.

    1 RANK         ranks the whole market on 21-day return against the market's own median.         Swing to positional
    2 BARRIER      the probability that a +3 ATR target is touched before a -1.5 ATR stop in 15 days.   Swing
    3 RELATIVE     ranks every stock against its OWN sector benchmark, sector move removed.            Positional
    4 SNAPBACK     ranks the market on 5-day return against its median: the shortest horizon.         Short swing
    5 COMPOUNDER   ranks the market on 126-day return against its median: the longest horizon.         Long term
"""
from __future__ import annotations

from dataclasses import dataclass, field

ATR_COST_PCT = 0.0025


@dataclass(frozen=True)
class Engine:
    id: int
    key: str
    name: str
    tagline: str
    style: str
    kind: str                   # reg | clf | rotation
    target: str                 # labels column the model is trained on
    outcome: str                # excess-return column it is judged on
    H: int                      # label horizon in sessions (also the training embargo)
    picks_per_day: int          # how many top-ranked stocks may become signals each session
    cooldown: int               # sessions before the same stock can be signalled again by this engine
    stop_atr: float             # stop distance in ATRs
    targets_r: tuple            # T1, T2, T3 as multiples of the risk
    max_hold: int               # time limit in sessions
    max_risk_pct: float         # a stop wider than this fraction of the price is capped
    min_score: float | None = None
    horizon_label: str = "swing"
    how: list = field(default_factory=list)


ENGINES: dict[str, Engine] = {e.key: e for e in [
    Engine(1, "rank", "Rank", "Ranks every stock against the market and keeps the strongest", "Swing to positional, about a month", "reg",
           "rank_21", "excess_21", 21, 3, 21, 2.0, (1.0, 2.0, 3.5), 25, 0.12, None, "positional",
           ["A gradient-boosted model reads 59 measures of each stock every evening: momentum, volatility, volume, trend, its position against its own sector benchmark, and the state of the market.",
            "It was trained to rank stocks by how much they beat the market's median over the next 21 sessions, and nothing else.",
            "The three highest-ranked stocks each session become signals."]),
    Engine(2, "barrier", "Barrier", "The odds that a stock reaches its target before its stop", "Swing, up to 15 sessions", "clf",
           "barrier", "excess_21", 15, 3, 15, 1.5, (1.0, 2.0, 3.5), 15, 0.10, None, "swing",
           ["A classifier learns, from every stock-day in the past, whether a +3 ATR target was touched before a -1.5 ATR stop within 15 sessions.",
            "Each evening it scores every stock with that probability; the base rate across the market is about one in four.",
            "The three most probable become signals, with exactly those barriers as the stop and the second target."]),
    Engine(3, "relative", "Relative", "Picks the stocks most likely to beat their own sector benchmark", "Positional, about a month", "reg",
           "rank_gr_21", "excess_gr_21", 21, 3, 21, 2.0, (1.0, 2.0, 3.5), 25, 0.12, None, "positional",
           ["Every stock is judged against its own benchmark: Nifty IT, Nifty Pharma and Nifty Bank where those exist, otherwise an index of its industry built from its peers.",
            "The model is trained to rank stocks inside their own group by how far they beat that group's median over the next 21 sessions. The sector's own move is removed, so what is left is stock selection.",
            "Because it carries the group's momentum, breadth and trend as inputs, it knows when a sector is strong or weak, and the three best-ranked stocks become signals."]),
    Engine(4, "snapback", "Snapback", "The shortest horizon: who beats the market over the next week", "Short swing, 3 to 7 sessions", "reg",
           "rank_5", "excess_5", 5, 3, 5, 1.2, (0.8, 1.5, 2.5), 7, 0.06, None, "swing",
           ["The same inputs as Rank, but trained to rank stocks by their return over the next 5 sessions, so it learns short-term effects such as exhaustion and snap-back that a one-month model averages away.",
            "The three highest-ranked become signals, with a tight stop and a one-week limit."]),
    Engine(5, "compounder", "Compounder", "The longest horizon: which stocks keep beating the market for six months", "Long term, up to 6 months", "reg",
           "rank_126", "excess_126", 126, 3, 63, 3.0, (1.5, 3.0, 5.0), 126, 0.18, None, "long",
           ["Trained to rank stocks by their return over the next 126 sessions (about six months) against the market's median.",
            "It leans on persistence: multi-month momentum, steadiness of the trend, drawdown recovery and sector strength.",
            "The three highest-ranked become signals, with a wide stop and a six-month limit."]),
]}
