#!/usr/bin/env python3
"""
Forex Candlestick & Multi-Timeframe Line Test Data Generator
- Timeframes are aggregated (M15 -> H1 -> H4 -> D1) so price action is 100% consistent across all timeframes.
- Lines SNAP to real candle swing highs / swing lows (bám sát đồ thị thật).
- Continuous, unbroken Zigzag Market Structure (HH/HL, LH/LL) following standard price action.
- End-to-end connected legs: Leg 1 (L1 -> H1), Leg 2 (H1 -> HL2), Leg 3 (HL2 -> HH2).
- Strictly non-overlapping time windows across timeframes (D1, H4, H1, M15 lines do not collide).
- High-contrast colors distinct from candlestick colors (NO green #10b981, NO red #ef4444).
- Outputs both plain JSON (.json) and compressed GZIP (.json.gz).
"""

import os
import json
import gzip
import random
import time
from typing import Dict, List, Any


def generate_base_m15_candles(
    start_time: int,
    count: int,
    start_price: float,
    volatility: float
) -> List[Dict[str, Any]]:
    """Generates continuous base M15 candlestick series with distinct, separated Market Structure waves."""
    candles = []
    decimals = 5 if start_price < 20 else 2

    for i in range(count):
        candle_time = start_time + i * 900

        # Window 1: 0..576 (D1 Macro Bullish: L1 -> H1 -> HL2 -> HH2)
        if i < 240:
            target = start_price + (i / 240.0) * (start_price * 0.018)
        elif i < 400:
            target = start_price * 1.018 - ((i - 240.0) / 160.0) * (start_price * 0.010)
        elif i < 576:
            target = start_price * 1.008 + ((i - 400.0) / 176.0) * (start_price * 0.018)
        # Window 2: 576..1050 (H4 Bullish: L1 -> H1 -> HL2 -> HH2)
        elif i < 650:
            target = start_price * 1.026 - ((i - 576.0) / 74.0) * (start_price * 0.021)
        elif i < 780:
            target = start_price * 1.005 + ((i - 650.0) / 130.0) * (start_price * 0.017)
        elif i < 880:
            target = base_price = start_price * 1.022 - ((i - 780.0) / 100.0) * (start_price * 0.010)
        elif i < 1050:
            target = start_price * 1.012 + ((i - 880.0) / 170.0) * (start_price * 0.018)
        # Window 3: 1050..1360 (H1 Bearish: H1 -> L1 -> LH2 -> LL2)
        elif i < 1180:
            target = start_price * 1.030 - ((i - 1050.0) / 130.0) * (start_price * 0.024)
        elif i < 1270:
            target = start_price * 1.006 + ((i - 1180.0) / 90.0) * (start_price * 0.012)
        elif i < 1360:
            target = start_price * 1.018 - ((i - 1270.0) / 90.0) * (start_price * 0.026)
        # Window 4: 1390..1600 (M15 Scalp Bullish: L1 -> H1 -> HL2 -> HH2)
        elif i < 1470:
            target = start_price * 0.992 + ((i - 1390.0) / 80.0) * (start_price * 0.014)
        elif i < 1530:
            target = start_price * 1.006 - ((i - 1470.0) / 60.0) * (start_price * 0.006)
        else:
            target = start_price * 1.000 + ((i - 1530.0) / 70.0) * (start_price * 0.012)

        noise = (random.random() - 0.495) * volatility
        close_p = target + noise
        open_p = close_p - (random.random() - 0.5) * volatility * 0.8
        wick_high = abs(random.random()) * volatility * 1.2
        wick_low = abs(random.random()) * volatility * 1.2
        high_p = max(open_p, close_p) + wick_high
        low_p = min(open_p, close_p) - wick_low

        candles.append({
            "time": candle_time,
            "open": round(open_p, decimals),
            "high": round(high_p, decimals),
            "low": round(low_p, decimals),
            "close": round(close_p, decimals)
        })

    return candles


def aggregate_candles(
    base_candles: List[Dict[str, Any]],
    group_size: int,
    decimals: int
) -> List[Dict[str, Any]]:
    """Aggregates smaller timeframe candles into larger ones (M15 -> H1 -> H4 -> D1)."""
    aggregated = []
    for i in range(0, len(base_candles), group_size):
        chunk = base_candles[i:i + group_size]
        if not chunk:
            continue
        c_time = chunk[0]["time"]
        c_open = chunk[0]["open"]
        c_high = max(c["high"] for c in chunk)
        c_low = min(c["low"] for c in chunk)
        c_close = chunk[-1]["close"]

        aggregated.append({
            "time": c_time,
            "open": round(c_open, decimals),
            "high": round(c_high, decimals),
            "low": round(c_low, decimals),
            "close": round(c_close, decimals)
        })
    return aggregated


def get_lowest_candle(candles: List[Dict[str, Any]], start_idx: int, end_idx: int) -> Dict[str, Any]:
    sub = candles[start_idx:end_idx]
    return min(sub, key=lambda c: c["low"])


def get_highest_candle(candles: List[Dict[str, Any]], start_idx: int, end_idx: int) -> Dict[str, Any]:
    sub = candles[start_idx:end_idx]
    return max(sub, key=lambda c: c["high"])


def create_forex_dataset(pair_name: str, base_price: float, volatility: float) -> Dict[str, Any]:
    """Builds an aligned multi-timeframe dataset where lines cling directly to candle wicks."""
    random.seed(hash(pair_name) % 100000)
    now = int(time.time())
    decimals = 5 if base_price < 20 else 2

    total_m15 = 1600
    start_time = now - total_m15 * 900

    # 1. Base M15
    m15_candles = generate_base_m15_candles(start_time, total_m15, base_price, volatility)
    # 2. H1 = 4 x M15
    h1_candles = aggregate_candles(m15_candles, 4, decimals)
    # 3. H4 = 4 x H1
    h4_candles = aggregate_candles(h1_candles, 4, decimals)
    # 4. D1 = 6 x H4
    d1_candles = aggregate_candles(h4_candles, 6, decimals)

    # 5. D1 Bullish Market Structure: Window 1 (bars 0..6)
    d1_l1 = get_lowest_candle(d1_candles, 0, 2)
    d1_h1 = get_highest_candle(d1_candles, 2, 4)
    d1_l2 = get_lowest_candle(d1_candles, 3, 5)
    d1_h2 = get_highest_candle(d1_candles, 5, 7)

    # 6. H4 Bullish Market Structure: Window 2 (bars 38..66)
    h4_l1 = get_lowest_candle(h4_candles, 38, 44)
    h4_h1 = get_highest_candle(h4_candles, 46, 51)
    h4_l2 = get_lowest_candle(h4_candles, 52, 57)
    h4_h2 = get_highest_candle(h4_candles, 58, 66)

    # 7. H1 Bearish Market Structure: Window 3 (bars 263..344)
    h1_h1 = get_highest_candle(h1_candles, 263, 273)
    h1_l1 = get_lowest_candle(h1_candles, 288, 302)
    h1_h2 = get_highest_candle(h1_candles, 310, 324)
    h1_l2 = get_lowest_candle(h1_candles, 332, 344)

    # 8. M15 Scalp Bullish Structure: Window 4 (bars 1385..1595)
    m15_l1 = get_lowest_candle(m15_candles, 1385, 1405)
    m15_h1 = get_highest_candle(m15_candles, 1460, 1485)
    m15_l2 = get_lowest_candle(m15_candles, 1515, 1540)
    m15_h2 = get_highest_candle(m15_candles, 1565, 1595)

    pair_slug = pair_name.lower().replace('/', '_')

    # Color Palette: High-contrast, vibrant, and strictly distinct from green/red candles
    # D1  : Electric Cyan (#06b6d4) & Tangerine Orange (#fb923c)
    # H4  : Royal Violet/Purple (#8b5cf6) & Warm Coral Pink (#fb7185)
    # H1  : Vivid Orange (#f97316) & Sunshine Gold (#facc15)
    # M15 : Hot Fuchsia/Pink (#ec4899) & Deep Sky Blue (#0ea5e9)

    timeframes_dict = {
        # --- D1 (Daily Macro Bullish Structure: L1 -> H1 -> HL2 -> HH2) ---
        "D1": {
            "candles": d1_candles,
            "drawings": [
                {
                    "id": f"d1-{pair_slug}-ms-leg1",
                    "type": "line",
                    "direction": "up",
                    "color": "#06b6d4",
                    "element": "D1 Bullish Market Structure (HH/HL)",
                    "fromTime": d1_l1["time"],
                    "toTime": d1_h1["time"],
                    "lineWidth": 2.5,
                    "stretch": True,
                    "sourceTimeframe": "D1",
                    "description": "D1 Swing Low to Swing High (L1 -> H1)"
                },
                {
                    "id": f"d1-{pair_slug}-ms-leg2",
                    "type": "line",
                    "direction": "down",
                    "color": "#fb923c",
                    "element": "D1 Bullish Market Structure (HH/HL)",
                    "fromTime": d1_h1["time"],
                    "toTime": d1_l2["time"],
                    "lineWidth": 2.5,
                    "stretch": True,
                    "sourceTimeframe": "D1",
                    "description": "D1 Pullback Swing High to Higher Low (H1 -> HL2)"
                },
                {
                    "id": f"d1-{pair_slug}-ms-leg3",
                    "type": "line",
                    "direction": "up",
                    "color": "#06b6d4",
                    "element": "D1 Bullish Market Structure (HH/HL)",
                    "fromTime": d1_l2["time"],
                    "toTime": d1_h2["time"],
                    "lineWidth": 2.5,
                    "stretch": True,
                    "sourceTimeframe": "D1",
                    "description": "D1 Continuation Higher Low to Higher High (HL2 -> HH2)"
                }
            ]
        },

        # --- H4 (4-Hour Bullish Market Structure: L1 -> H1 -> HL2 -> HH2) ---
        "H4": {
            "candles": h4_candles,
            "drawings": [
                {
                    "id": f"h4-{pair_slug}-ms-leg1",
                    "type": "line",
                    "direction": "up",
                    "color": "#8b5cf6",
                    "element": "H4 Bullish Market Structure (HH/HL)",
                    "fromTime": h4_l1["time"],
                    "toTime": h4_h1["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "H4",
                    "description": "H4 Swing Low to Swing High (L1 -> H1)"
                },
                {
                    "id": f"h4-{pair_slug}-ms-leg2",
                    "type": "line",
                    "direction": "down",
                    "color": "#fb7185",
                    "element": "H4 Bullish Market Structure (HH/HL)",
                    "fromTime": h4_h1["time"],
                    "toTime": h4_l2["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "H4",
                    "description": "H4 Pullback Swing High to Higher Low (H1 -> HL2)"
                },
                {
                    "id": f"h4-{pair_slug}-ms-leg3",
                    "type": "line",
                    "direction": "up",
                    "color": "#8b5cf6",
                    "element": "H4 Bullish Market Structure (HH/HL)",
                    "fromTime": h4_l2["time"],
                    "toTime": h4_h2["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "H4",
                    "description": "H4 Continuation Higher Low to Higher High (HL2 -> HH2)"
                }
            ]
        },

        # --- H1 (1-Hour Bearish Market Structure: H1 -> L1 -> LH2 -> LL2) ---
        "H1": {
            "candles": h1_candles,
            "drawings": [
                {
                    "id": f"h1-{pair_slug}-ms-leg1",
                    "type": "line",
                    "direction": "down",
                    "color": "#f97316",
                    "element": "H1 Bearish Market Structure (LH/LL)",
                    "fromTime": h1_h1["time"],
                    "toTime": h1_l1["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "H1",
                    "description": "H1 Swing High to Swing Low (H1 -> L1)"
                },
                {
                    "id": f"h1-{pair_slug}-ms-leg2",
                    "type": "line",
                    "direction": "up",
                    "color": "#facc15",
                    "element": "H1 Bearish Market Structure (LH/LL)",
                    "fromTime": h1_l1["time"],
                    "toTime": h1_h2["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "H1",
                    "description": "H1 Retracement Swing Low to Lower High (L1 -> LH2)"
                },
                {
                    "id": f"h1-{pair_slug}-ms-leg3",
                    "type": "line",
                    "direction": "down",
                    "color": "#f97316",
                    "element": "H1 Bearish Market Structure (LH/LL)",
                    "fromTime": h1_h2["time"],
                    "toTime": h1_l2["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "H1",
                    "description": "H1 Continuation Lower High to Lower Low (LH2 -> LL2)"
                }
            ]
        },

        # --- M15 (15-Minute Scalp Bullish Structure: L1 -> H1 -> HL2 -> HH2) ---
        "M15": {
            "candles": m15_candles,
            "drawings": [
                {
                    "id": f"m15-{pair_slug}-ms-leg1",
                    "type": "line",
                    "direction": "up",
                    "color": "#ec4899",
                    "element": "M15 Scalp Structure (HH/HL)",
                    "fromTime": m15_l1["time"],
                    "toTime": m15_h1["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "M15",
                    "description": "M15 Scalp L1 -> H1"
                },
                {
                    "id": f"m15-{pair_slug}-ms-leg2",
                    "type": "line",
                    "direction": "down",
                    "color": "#0ea5e9",
                    "element": "M15 Scalp Structure (HH/HL)",
                    "fromTime": m15_h1["time"],
                    "toTime": m15_l2["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "M15",
                    "description": "M15 Scalp Pullback H1 -> HL2"
                },
                {
                    "id": f"m15-{pair_slug}-ms-leg3",
                    "type": "line",
                    "direction": "up",
                    "color": "#ec4899",
                    "element": "M15 Scalp Structure (HH/HL)",
                    "fromTime": m15_l2["time"],
                    "toTime": m15_h2["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "M15",
                    "description": "M15 Scalp Continuation HL2 -> HH2"
                }
            ]
        }
    }

    timeframe_units = {
        "D1": 86400,
        "H4": 14400,
        "H1": 3600,
        "M15": 900,
        "M5": 300,
        "M2": 120,
        "M1": 60
    }

    timeframe_conversions = [
        {"from": "D1", "to": "H4", "ratio": 6.0},
        {"from": "H4", "to": "H1", "ratio": 4.0},
        {"from": "H1", "to": "M15", "ratio": 4.0},
        {"from": "M15", "to": "M5", "ratio": 3.0},
        {"from": "M5", "to": "M2", "ratio": 2.5},
        {"from": "M2", "to": "M1", "ratio": 2.0}
    ]

    return {
        "symbol": pair_name,
        "title": f"{pair_name} Multi-Timeframe Market Structure",
        "description": "Market Structure (HH/HL, LH/LL) with 1-way downward inheritance and wick-perfect snapping.",
        "timeframeUnits": timeframe_units,
        "timeframeConversions": timeframe_conversions,
        "timeframes": timeframes_dict,
        "defaultTimeframe": "H4"
    }


def save_test_dataset(data: Dict[str, Any], output_dir: str):
    """Saves both uncompressed .json and compressed .json.gz files."""
    os.makedirs(output_dir, exist_ok=True)
    symbol_slug = data["symbol"].replace("/", "_")

    json_filename = f"{symbol_slug}_test_data.json"
    gz_filename = f"{symbol_slug}_test_data.json.gz"

    json_path = os.path.join(output_dir, json_filename)
    gz_path = os.path.join(output_dir, gz_filename)

    json_bytes = json.dumps(data, indent=2).encode("utf-8")
    with open(json_path, "wb") as f:
        f.write(json_bytes)

    with gzip.open(gz_path, "wb", compresslevel=9) as gz_f:
        gz_f.write(json_bytes)

    orig_size = len(json_bytes) / 1024.0
    gz_size = os.path.getsize(gz_path) / 1024.0
    ratio = (1.0 - (gz_size / orig_size)) * 100.0

    print(f"Generated: {data['symbol']}")
    print(f"   -> JSON: {json_filename} ({orig_size:.1f} KB)")
    print(f"   -> GZIP: {gz_filename} ({gz_size:.1f} KB, -{ratio:.1f}% compression)")


def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    pairs = [
        ("EUR/USD", 1.08200, 0.00045),
        ("GBP/USD", 1.26500, 0.00055),
        ("USD/JPY", 154.20, 0.08),
        ("XAU/USD", 2650.00, 1.8),
    ]

    print("=" * 65)
    print("Forex Multi-Timeframe Line JSON & GZIP Test Data Generator")
    print("Zigzag Market Structure (HH/HL & LH/LL) & Wick-Anchored Lines")
    print("=" * 65)

    for pair, price, vol in pairs:
        dataset = create_forex_dataset(pair, price, vol)
        save_test_dataset(dataset, root_dir)

    print("\n" + "=" * 65)
    print("All line test files successfully updated in test_data/!")
    print("=" * 65)


if __name__ == "__main__":
    main()
