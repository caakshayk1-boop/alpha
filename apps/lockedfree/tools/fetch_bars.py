"""Daily bars for the symbols the ledger needs (picks not yet closed, plus names in pending runs) and the benchmark.
Writes ledger/bars.json: { fetched_at, benchmark_symbol, benchmark: {date: close}, bars: {SYM: {date: {o,h,l,c}}}, missing: [SYM] }.
A bar missing any of open/high/low/close is dropped, never filled. Prices are split-adjusted exchange prices (auto_adjust=False,
Yahoo's split-adjusted Close), not dividend-adjusted, because paper fills must be prices a person could have seen. Unofficial source; may fail."""
import json, pathlib, sys, datetime as dt
import yfinance as yf
ROOT = pathlib.Path(__file__).resolve().parent.parent / "ledger"
BENCH = "^CRSLDX"

def needed() -> list[str]:
    syms: set[str] = set()
    f = ROOT / "ledger.json"
    if f.exists():
        for p in json.loads(f.read_text()).get("picks", []):
            if p["status"] in ("pending", "open"): syms.add(p["symbol"])
    for r in (ROOT / "runs").glob("*.json") if (ROOT / "runs").exists() else []:
        syms.update(json.loads(r.read_text()).get("passed", []))
    det = ROOT / "detail"
    if det.exists():
        latest = {}
        for f in sorted(det.glob("*.json")): latest[f.name.split("__")[0]] = f
        for f in latest.values(): syms.update(json.loads(f.read_text()).get("stocks", {}).keys())
    return sorted(syms)

def series(df, sym):
    out = {}
    for ts, row in df.iterrows():
        v = [row.get(c) for c in ("Open", "High", "Low", "Close")]
        if any(x is None or x != x for x in v): continue
        out[ts.strftime("%Y-%m-%d")] = {"o": round(float(v[0]), 2), "h": round(float(v[1]), 2), "l": round(float(v[2]), 2), "c": round(float(v[3]), 2)}
    return out

def main():
    syms = needed(); bars, missing = {}, []
    for s in syms:
        try:
            d = yf.download(f"{s}.NS", period="1y", interval="1d", auto_adjust=False, progress=False)
            if hasattr(d.columns, "levels"): d.columns = d.columns.get_level_values(0)
            b = series(d, s)
            (bars.__setitem__(s, b) if b else missing.append(s))
        except Exception as e:
            print(f"{s}: {e}", file=sys.stderr); missing.append(s)
    bd = yf.download(BENCH, period="1y", interval="1d", auto_adjust=False, progress=False)
    if hasattr(bd.columns, "levels"): bd.columns = bd.columns.get_level_values(0)
    bench = {d: v["c"] for d, v in series(bd, BENCH).items()}
    if not bench: sys.exit("benchmark returned no bars; refusing to write")
    (ROOT / "bars.json").write_text(json.dumps({"fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "benchmark_symbol": BENCH, "benchmark": bench, "bars": bars, "missing": missing}))
    print(f"{len(bars)} symbols, {len(missing)} missing, benchmark {len(bench)} days, last {max(bench)}")
main()
