"""The price panel behind the Strategy Lab: ten years of adjusted daily closes for the liquid universe, in one small file the browser can read.

FORMAT (lab_panel.json + lab_panel.bin.gz; the browser decodes it with src/lab/panel.ts and a golden fixture pins both sides)
  lab_panel.json  { built, dates: [ISO day, ...] (T of them, the Nifty's sessions), syms: [...], first: [index of each symbol's first close], scale: 100 }
  lab_panel.bin.gz  gzip of little-endian int32, for each symbol in order, the closes from first[j] to the last session as DELTAS in paise
                    (the first value is the close itself, every later value is today's minus yesterday's). A session where the symbol did not print is
                    carried forward from its last close, so a holiday mismatch never reads as a crash. Nothing before first[j] is stored: a name is
                    absent before it listed, never zero.
  Closes are dividend-adjusted (auto_adjust), the same as every other study here. Survivorship applies: today's constituents only."""
from __future__ import annotations
import gzip, json, sys, pathlib, datetime as dt
import numpy as np
from study import load_real

SCALE = 100


def encode(dates: list[str], syms: list[str], C: np.ndarray) -> tuple[dict, bytes]:
    """C is (T, N) closes with NaN where a name had no print. Returns (meta, gzip bytes)."""
    T, N = C.shape; first, parts = [], []
    for j in range(N):
        col = C[:, j]; ok = np.where(~np.isnan(col) & (col > 0))[0]
        if not len(ok): first.append(T); continue
        f = int(ok[0]); first.append(f); s = col[f:].copy()
        for k in range(1, len(s)):
            if np.isnan(s[k]) or s[k] <= 0: s[k] = s[k - 1]
        q = np.rint(s * SCALE).astype(np.int64)
        if (np.abs(np.diff(q)) > 2 ** 31 - 1).any() or q[0] > 2 ** 31 - 1: raise ValueError(f"{syms[j]}: a price jump does not fit in 32 bits")
        d = np.diff(q, prepend=0).astype("<i4"); parts.append(d.tobytes())
    meta = {"built": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC"), "dates": dates, "syms": syms, "first": first, "scale": SCALE}
    return meta, gzip.compress(b"".join(parts), compresslevel=9, mtime=0)


def decode(meta: dict, blob: bytes) -> np.ndarray:
    """The inverse of encode: (T, N) closes, NaN before each name's first close."""
    T, N = len(meta["dates"]), len(meta["syms"]); raw = np.frombuffer(gzip.decompress(blob), dtype="<i4").astype(np.int64)
    C = np.full((T, N), np.nan); at = 0
    for j in range(N):
        f = meta["first"][j]
        if f >= T: continue
        n = T - f; C[f:, j] = np.cumsum(raw[at:at + n]) / meta["scale"]; at += n
    return C


if __name__ == "__main__":
    screen = sys.argv[1]; outdir = pathlib.Path(sys.argv[2]); outdir.mkdir(parents=True, exist_ok=True)
    p = load_real(screen); dates = [str(d)[:10] for d in p.dates]
    meta, blob = encode(dates, list(p.syms), p.C)
    (outdir / "lab_panel.json").write_text(json.dumps(meta, separators=(",", ":"))); (outdir / "lab_panel.bin.gz").write_bytes(blob)
    print(f"lab panel: {len(p.syms)} symbols, {len(dates)} sessions, {len(blob) / 1e6:.2f} MB gzipped")
