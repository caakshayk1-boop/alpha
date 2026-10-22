"""Itemised NSE delivery costs (configs/engines/costs.yaml, costs-1.0.0). Statutory items from official sources; brokerage and DP
0 in the base case and the stress case beside it. Spread and slippage are modelled prices, applied to the FILL, not added here."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CostModel:
    stt_buy: float
    stt_sell: float
    stamp_buy: float
    exch: float
    sebi: float
    gst: float
    brokerage: float
    dp_sell: float
    half_spread: dict
    slippage: float

    @staticmethod
    def from_config(c: dict, stress: bool = False) -> "CostModel":
        st, b = c["statutory"], c["broker"]
        return CostModel(st["stt"]["buy_pct"] / 100, st["stt"]["sell_pct"] / 100, st["stamp_duty"]["buy_pct"] / 100,
                         st["exchange_transaction_charge"]["each_side_pct"] / 100, st["sebi_turnover_fee"]["each_side_pct"] / 100,
                         st["gst"]["rate_pct"] / 100,
                         float(b["stress"]["brokerage_rs_per_order"] if stress else b["brokerage_delivery_rs_per_order"]),
                         float(b["stress"]["dp_charge_per_sell_rs"] if stress else b["dp_charge_per_sell_rs"]),
                         {k: v / 100 for k, v in c["execution"]["half_spread_pct_by_adv"].items()}, c["execution"]["slippage_pct"] / 100)

    def side(self, value: float, buy: bool) -> float:
        """Rupees charged on one order of `value` rupees."""
        fees = value * (self.exch + self.sebi) + self.brokerage
        return value * ((self.stt_buy + self.stamp_buy) if buy else self.stt_sell) + fees + self.gst * fees + (0.0 if buy else self.dp_sell)

    def impact(self, adv_cr: float | None) -> float:
        """Half-spread plus slippage, as a fraction of price, by 20-day median traded value (Rs crore)."""
        if adv_cr is None or adv_cr != adv_cr:
            hs = self.half_spread["10-25"]
        elif adv_cr >= 100:
            hs = self.half_spread[">=100"]
        elif adv_cr >= 25:
            hs = self.half_spread["25-100"]
        else:
            hs = self.half_spread["10-25"]
        return hs + self.slippage

    def statutory_round_trip_pct(self) -> float:
        z = CostModel(**{**self.__dict__, "brokerage": 0.0, "dp_sell": 0.0})
        v = 1e7
        return (z.side(v, True) + z.side(v, False)) / v * 100
