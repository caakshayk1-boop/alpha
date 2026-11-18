"""Annual fundamentals and price features for the screens' universe -> ledger/fundamentals.json (not committed; rebuilt weekly).
Universe: the same feed the owner's other products read (ALPHA_BASE/data/screen.json rows: sym, name, sector, mcap_cr), market cap >= 1000 cr.
Look-ahead guard (methodology): a statement is used only once 90 days have passed since its period end. A missing field stays missing (None); nothing is filled.
Unofficial source (Yahoo Finance via yfinance). Fails (exit 1) if fewer than 70% of names yield two usable years, so a blind week publishes nothing."""
import json, os, sys, time, pathlib, datetime as dt, urllib.request
import yfinance as yf
ROOT = pathlib.Path(__file__).resolve().parent.parent / "ledger"
BASE = os.environ.get("ALPHA_BASE", "https://alpha.askakshay.com")
CR = 1e7
LAG_DAYS = 90
MAP = {  # our field: (statement, [yfinance row names, first found wins])
    "revenue": ("inc", ["Total Revenue", "Operating Revenue"]), "gross_profit": ("inc", ["Gross Profit"]), "net_income": ("inc", ["Net Income", "Net Income Common Stockholders"]), "ebit": ("inc", ["EBIT", "Operating Income"]),
    "cfo": ("cf", ["Operating Cash Flow", "Cash Flow From Continuing Operating Activities"]),
    "total_assets": ("bs", ["Total Assets"]), "long_term_debt": ("bs", ["Long Term Debt", "Long Term Debt And Capital Lease Obligation"]), "current_assets": ("bs", ["Current Assets"]), "current_liabilities": ("bs", ["Current Liabilities"]),
    "net_fixed_assets": ("bs", ["Net PPE"]), "equity": ("bs", ["Stockholders Equity", "Common Stock Equity"]), "total_debt": ("bs", ["Total Debt"]), "cash": ("bs", ["Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments"]),
    "shares": ("bs", ["Ordinary Shares Number", "Share Issued"]),
}

def get(df, names, col):
    if df is None or df.empty or col not in df.columns: return None
    for n in names:
        if n in df.index:
            v = df.loc[n, col]
            if v == v and v is not None: return float(v)
    return None

def company(row, today):
    t = yf.Ticker(f"{row['sym']}.NS"); inc, bs, cf = t.income_stmt, t.balance_sheet, t.cashflow; src = {"inc": inc, "bs": bs, "cf": cf}
    cols = sorted({c for d in (inc, bs, cf) if d is not None and not d.empty for c in d.columns}, reverse=True); years = []
    for c in cols:
        if (today - c.date()).days < LAG_DAYS: continue                     # not yet knowable: skip
        y = {"fy": c.year}
        for k, (s, names) in MAP.items():
            v = get(src[s], names, c)
            y[k] = None if v is None else (v if k == "shares" else v / CR)
        years.append({k: v for k, v in y.items() if v is not None})
    h = t.history(period="15mo", interval="1d", auto_adjust=False)
    close = ma200 = mom = None
    if len(h) > 200:
        c = h["Close"]; close = float(c.iloc[-1]); ma200 = float(c.iloc[-200:].mean())
        if len(c) > 252: mom = float((c.iloc[-22] / c.iloc[-253] - 1) * 100)   # 12-1 month
    return {"symbol": row["sym"], "name": row.get("name"), "sector": row.get("sector"), "mcap_cr": row.get("mcap_cr"), "years": years[:4], "close": close, "ma200": ma200, "mom_12_1": mom}

def main():
    req = urllib.request.Request(f"{BASE}/data/screen.json", headers={"User-Agent": "rulebook-fundamentals/1.0"})
    rows = [r for r in json.load(urllib.request.urlopen(req, timeout=60))["rows"] if (r.get("mcap_cr") or 0) >= 1000]
    today = dt.date.today(); out, failed = [], 0
    for i, r in enumerate(rows):
        for attempt in range(3):
            try: out.append(company(r, today)); break
            except Exception as e:
                if attempt == 2: failed += 1; print(f"{r['sym']}: {e}", file=sys.stderr)
                time.sleep(2 * (attempt + 1))
        time.sleep(0.3)
        if i % 50 == 0: print(f"{i}/{len(rows)}", flush=True)
    usable = sum(1 for c in out if len(c["years"]) >= 2)
    if not rows or usable < 0.7 * len(rows): sys.exit(f"only {usable} of {len(rows)} names have two usable years; refusing to publish a blind week")
    (ROOT / "fundamentals.json").write_text(json.dumps({"fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "universe_n": len(rows), "failed": failed, "companies": out}))
    print(f"{len(out)} companies, {usable} with 2+ years, {failed} failed")
main()
