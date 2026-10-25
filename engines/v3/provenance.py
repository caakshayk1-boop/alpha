"""What every recorded input and output must carry (brief: DATA PIPELINE). One function builds the block; every ledger record and
the published feed carry it, so a number can be traced to its source, session, observation time, ingestion time, adjustment
policy and the exact dataset it was computed on. Nothing here is estimated: an unknown value is None, never a guess."""
from __future__ import annotations

import hashlib

import pandas as pd

SOURCE = "Yahoo Finance daily bars via yfinance (hourly bars rebuild a finished session Yahoo's daily series still lacks)"
ADJUSTMENT = {
    "levels": "split-adjusted exchange prices (auto_adjust=False): entries, stops, targets and fills",
    "returns": "dividend- and split-adjusted closes: momentum, relative strength and residuals",
    "unexplained_gap": "a bar with an overnight move beyond 40% is excluded as unclean, never traded",
}


def dataset_version(bars: dict[str, pd.DataFrame]) -> str:
    """A short hash of what the run actually saw: each symbol, its bar count, its last session and last close. Two runs on the same
    data give the same version; a late bar, a revision or a different universe gives a different one."""
    h = hashlib.sha256()
    for sym in sorted(bars):
        df = bars[sym]
        if len(df):
            h.update(f"{sym}|{len(df)}|{df.index[-1].date()}|{float(df['Close'].iloc[-1]):.4f}\n".encode())
    return h.hexdigest()[:16]


def provenance(session: str, ingested_at: str, dataset: str, symbol: str | None = None) -> dict:
    """`observed_at` is the session close (15:30 IST) of the bar the record is about; `ingested_at` is when this run read it."""
    return {"source": SOURCE, "exchange": "NSE", "currency": "INR", "timezone": "Asia/Kolkata", "symbol": symbol, "session": session,
            "observed_at": f"{session}T15:30:00+05:30", "ingested_at": ingested_at, "adjustment_policy": ADJUSTMENT, "dataset_version": dataset}


REQUIRED = ("source", "exchange", "currency", "session", "observed_at", "ingested_at", "adjustment_policy", "dataset_version")


def missing(p: dict | None) -> list[str]:
    """The required provenance fields a record lacks or leaves empty. A record with any is refused by the publisher."""
    return [k for k in REQUIRED if not p or p.get(k) in (None, "", {})]
