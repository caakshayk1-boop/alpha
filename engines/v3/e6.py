"""E6 · Earnings surprise and post-event drift: the collector interface and the seasonal-surprise arithmetic (configs/engines/E6.yaml).

The engine stays BLOCKED_DATA until a point-in-time source of exchange announcement timestamps and statements is configured: with
`NullSource` (the only source in this repository) every call raises BlockedData and no candidate is produced. What is real here is
the part that does not depend on that source: the surprise calculation, its refusal rules, the first-full-session rule and the
stop. The only surprise defined is the SEASONAL one, labelled as such; it is never called a consensus beat, and a timestamp is never
simulated. Tests use fixtures in tests/test_ops.py only."""
from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date, datetime, time as dtime, timedelta
from typing import Protocol
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
LABEL = "seasonal surprise, not an analyst-consensus beat"
MIN_PRIOR = 8
Z_MIN = 1.0
REL_VOLUME_MIN = 1.5
STOP_PAD_ATR = 0.25


class BlockedData(Exception):
    """No trustworthy event history is available. Raised, never worked around."""


@dataclass(frozen=True)
class Announcement:
    symbol: str
    kind: str                    # e.g. "financial results"
    published_at: datetime       # timezone-aware, from the exchange record
    source_url: str


@dataclass(frozen=True)
class Quarter:
    end: date                    # fiscal quarter end
    published_at: datetime       # when the result was made public (exchange timestamp), timezone-aware
    eps: float | None            # as reported
    adj_factor: float | None     # multiply reported EPS by this to put it on one share basis (splits, bonuses); None = not adjusted


class EventSource(Protocol):
    name: str
    def announcements(self, symbol: str, since: date) -> list[Announcement]: ...
    def quarters(self, symbol: str) -> list[Quarter]: ...


class NullSource:
    """The only source here. It has no data and says so."""
    name = "none"
    def announcements(self, symbol: str, since: date) -> list[Announcement]:
        raise BlockedData("no point-in-time announcement source is configured (MISSING_DATA_AND_ACCESS rows 1-2)")
    def quarters(self, symbol: str) -> list[Quarter]:
        raise BlockedData("no point-in-time quarterly statements are configured (MISSING_DATA_AND_ACCESS rows 1-2)")


def state_for(source: EventSource) -> str:
    return "BLOCKED_DATA" if isinstance(source, NullSource) else "RESEARCH"


@dataclass(frozen=True)
class Surprise:
    z: float | None
    change: float | None
    n_prior: int
    sd: float | None
    label: str
    reason: str | None           # why z is None


def _usable(q: Quarter) -> bool:
    return q.eps is not None and q.adj_factor is not None and q.adj_factor > 0 and q.published_at.tzinfo is not None


def yoy_changes(quarters: list[Quarter]) -> list[tuple[datetime, date, float]]:
    """Year-on-year change in adjusted EPS for every quarter that has a usable twin a year earlier: (published_at, quarter end, change).
    A quarter without a corporate-action adjustment factor, or with a missing EPS, is not used: it is not guessed."""
    use = sorted((q for q in quarters if _usable(q)), key=lambda q: q.end)
    out = []
    for q in use:
        twin = next((p for p in use if abs((q.end - p.end).days - 365) <= 6), None)
        if twin:
            out.append((q.published_at, q.end, q.eps * q.adj_factor - twin.eps * twin.adj_factor))
    return out


def seasonal_surprise(quarters: list[Quarter], end: date) -> Surprise:
    """The surprise of the quarter ending `end`: its year-on-year EPS change divided by the sample standard deviation of the
    year-on-year changes that were PUBLISHED STRICTLY BEFORE it was. Refused (z None, with the reason) when fewer than eight prior
    changes exist, when the denominator is zero, or when the quarter itself cannot be computed."""
    ch = yoy_changes(quarters)
    cur = next((c for c in ch if c[1] == end), None)
    if cur is None:
        return Surprise(None, None, 0, None, LABEL, "the quarter has no usable year-earlier twin, or lacks EPS or a corporate-action adjustment")
    prior = [c[2] for c in ch if c[0] < cur[0] and c[1] != end]
    if len(prior) < MIN_PRIOR:
        return Surprise(None, cur[2], len(prior), None, LABEL, f"only {len(prior)} prior changes known before publication; {MIN_PRIOR} needed")
    sd = statistics.stdev(prior)
    if not sd > 0:
        return Surprise(None, cur[2], len(prior), sd, LABEL, "the prior changes have zero spread: the denominator is zero")
    return Surprise(cur[2] / sd, cur[2], len(prior), sd, LABEL, None)


def first_full_session(published_at: datetime, sessions: list[date]) -> date | None:
    """The first session that is entirely after the publication: the same day if it was published before the 09:15 IST open, else
    the next session. None when `sessions` does not reach it (no entry is invented)."""
    t = published_at.astimezone(IST)
    day = t.date() if t.time() <= dtime(9, 15) else t.date() + timedelta(days=1)
    return next((s for s in sorted(sessions) if s >= day), None)


def qualifies(s: Surprise, sector_adj_event_return: float | None, rel_volume: float | None) -> tuple[bool, list[str]]:
    """The initial hypothesis, all three at once. A measure that is missing fails its test: unmeasured is never a pass."""
    why = []
    if s.z is None:
        why.append(f"no surprise: {s.reason}")
    elif s.z < Z_MIN:
        why.append(f"surprise z {s.z:.2f} is below {Z_MIN}")
    if sector_adj_event_return is None:
        why.append("sector-adjusted event return not measured")
    elif not sector_adj_event_return > 0:
        why.append("sector-adjusted event return is not positive")
    if rel_volume is None:
        why.append("relative volume not measured")
    elif rel_volume < REL_VOLUME_MIN:
        why.append(f"relative volume {rel_volume:.2f} is below {REL_VOLUME_MIN}")
    return (not why, why)


def invalidation(session_low: float, atr14: float) -> float:
    """That first full post-publication session's low, less a quarter of the 14-session ATR."""
    return session_low - STOP_PAD_ATR * atr14
