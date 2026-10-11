"""context.py — load the bars and build the market context the models read."""
import pandas as pd

from common import Ctx


def make_ctx(path: str):
    d = pd.read_pickle(path)
    return d["bars"], Ctx(d["bars"], d["bench"], d["universe"], d.get("indices")), d["universe"]
