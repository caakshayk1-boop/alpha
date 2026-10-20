"""conviction.py — which signals are featured as 'high' conviction. The rule TAGS signals; it never adds, removes or reprices one.

THE RULE (chosen on the development period only, then read once on the holdout; docs/agents/signals.md section 2-3)
  high       the market's breadth on the signal date (breadth_50: share of liquid stocks above their own 50-day average,
             features.py) is at least 60%.
  standard   everything else.

It is a market-timing switch, not a stock pick: on a session with broad participation every signal is 'high', on a narrow one none is.
Breadth on date t uses closes up to t only, so the tier is known at the signal close, before the next-open entry.
"""
from __future__ import annotations

import math

BREADTH_MIN = 0.60

RULE = {
    "rule": "High conviction when market breadth on the signal date is at least 60% (share of liquid stocks above their own 50-day average). "
            "It is a market-timing switch: on a broad day every engine's signals are high conviction, on a narrow day none are.",
    "field": "breadth_50",
    "threshold": BREADTH_MIN,
    "chosen_on": "development",
    "periods": {"development": ["2023-01-01", "2025-03-31"], "holdout": ["2025-04-01", "2026-10-15"]},
    "holdout": {
        "high": {"trades": 1969, "expectancy_r": 0.231, "t_clustered": 2.05, "months": 10, "win_rate": 56.7},
        "all_signals": {"trades": 5435, "expectancy_r": 0.088, "t_clustered": 0.87, "months": 19, "win_rate": 52.1},
        "random_same_days": {"trades": 1969, "expectancy_r": 0.052},
        "random_all": {"trades": 5434, "expectancy_r": -0.052},
    },
    "development": {"high": {"trades": 4103, "expectancy_r": 0.343, "t_clustered": 2.56, "months": 18},
                    "all_signals": {"trades": 8188, "expectancy_r": 0.206, "t_clustered": 2.80, "months": 27}},
    "caveats": [
        "The holdout t of 2.05 rests on 10 months and only just clears the bar of 2; eight filter families were tested, so one pass by luck is plausible.",
        "Random stocks on the same broad days also did better (+0.05R vs -0.05R): most of the gain is the market, not the models' picks.",
        "Snapback signals lost money even on broad days in the holdout (-0.10R over 399 trades).",
        "Costs of 0.25% per round trip are included. Every figure is a backtest on today's stock list (survivorship bias); paper only.",
    ],
}


def tier(breadth: float | None) -> tuple[str, str]:
    """('high' | 'standard', why) for one signal, from the breadth on its signal date."""
    if breadth is None or (isinstance(breadth, float) and math.isnan(breadth)):
        return "standard", "Market breadth on the signal date is unknown, so it cannot qualify as high conviction."
    pct = round(float(breadth) * 100)
    if breadth >= BREADTH_MIN:
        return "high", f"Market breadth was {pct}% on the signal date (at least 60%): broad days carried the tested edge."
    return "standard", f"Market breadth was {pct}% on the signal date, below the 60% the high-conviction rule needs."
