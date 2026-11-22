#!/usr/bin/env python3
"""
Forex Candlestick & Multi-Timeframe Line Test Data Generator
- Timeframes are aggregated (M15 -> H1 -> H4 -> D1) so price action is 100% consistent across all timeframes.
- Lines SNAP to real candle swing highs / swing lows (bám sát đồ thị thật).
- Lines start strictly from (candle 1, price 1) to (candle 2, price 2) as solid lines.
- NO labels for lines (label không cần cho line, đã xoá bỏ hoàn toàn).
- Kéo dãn theo thứ tự nến khi chuyển từ H4 sang H1 và M15 (chuẩn TradingView).
- Outputs both plain JSON (.json) and compressed GZIP (.json.gz).
"""

import os
import json
import gzip
import math
import random
import time
from typing import Dict, List, Any


def generate_base_m15_candles(start_time: int, count: int, start_price: float, volatility: float) -> List[Dict[str, Any]]:
    """Generates continuous base M15 candlestick series."""
    candles = []
    current_close = start_price

    for i in range(count):
        candle_time = start_time + i * 900
        macro_cycle = math.sin(i / 160.0) * 0.0003 * start_price
        medium_cycle = math.cos(i / 35.0) * 0.00015 * start_price
        random_step = (random.random() - 0.495) * volatility
        drift = macro_cycle + medium_cycle + random_step

        decimals = 5 if start_price < 20 else 2
        open_p = round(current_close, decimals)
        close_p = round(max(0.0001, open_p + drift), decimals)

        wick_high = abs(random.random() * volatility * 1.2)
        wick_low = abs(random.random() * volatility * 1.2)
        high_p = round(max(open_p, close_p) + wick_high, decimals)
        low_p = round(min(open_p, close_p) - wick_low, decimals)

        candles.append({
            "time": candle_time,
            "open": open_p,
            "high": high_p,
            "low": low_p,
            "close": close_p
        })
        current_close = close_p

    return candles


def aggregate_candles(base_candles: List[Dict[str, Any]], group_size: int, decimals: int) -> List[Dict[str, Any]]:
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


def find_swing_lows(candles: List[Dict[str, Any]], window: int = 3) -> List[int]:
    """Finds indices of local swing lows (troughs) touching candle wicks."""
    lows = []
    for i in range(window, len(candles) - window):
        val = candles[i]["low"]
        if all(val < candles[i - w]["low"] and val < candles[i + w]["low"] for w in range(1, window + 1)):
            lows.append(i)
    return lows


def find_swing_highs(candles: List[Dict[str, Any]], window: int = 3) -> List[int]:
    """Finds indices of local swing highs (peaks) touching candle wicks."""
    highs = []
    for i in range(window, len(candles) - window):
        val = candles[i]["high"]
        if all(val > candles[i - w]["high"] and val > candles[i + w]["high"] for w in range(1, window + 1)):
            highs.append(i)
    return highs


def create_forex_dataset(pair_name: str, base_price: float, volatility: float) -> Dict[str, Any]:
    """Builds an aligned multi-timeframe dataset where lines cling directly to candle wicks."""
    now = int(time.time())
    decimals = 5 if base_price < 20 else 2
    
    total_m15 = 1600 # 400 hours
    start_time = now - total_m15 * 900

    # 1. Base M15
    m15_candles = generate_base_m15_candles(start_time, total_m15, base_price, volatility)
    # 2. H1 = 4 x M15
    h1_candles = aggregate_candles(m15_candles, 4, decimals)
    # 3. H4 = 4 x H1
    h4_candles = aggregate_candles(h1_candles, 4, decimals)
    # 4. D1 = 6 x H4
    d1_candles = aggregate_candles(h4_candles, 6, decimals)

    # 5. Swing points on D1
    d1_lows = find_swing_lows(d1_candles, 2)
    d1_highs = find_swing_highs(d1_candles, 2)
    d1_l1 = d1_candles[d1_lows[0] if len(d1_lows) > 0 else 2]
    d1_h1 = d1_candles[d1_highs[0] if len(d1_highs) > 0 else 5]
    d1_l2 = d1_candles[d1_lows[1] if len(d1_lows) > 1 else 8]

    # 6. Swing points on H4
    h4_lows = find_swing_lows(h4_candles, 3)
    h4_highs = find_swing_highs(h4_candles, 3)

    low1_idx = h4_lows[1] if len(h4_lows) > 1 else 15
    low2_idx = h4_lows[-2] if len(h4_lows) > 3 else min(len(h4_candles) - 5, low1_idx + 40)
    high1_idx = h4_highs[1] if len(h4_highs) > 1 else 25
    high2_idx = h4_highs[-2] if len(h4_highs) > 3 else min(len(h4_candles) - 5, high1_idx + 40)

    c_low1 = h4_candles[low1_idx]
    c_low2 = h4_candles[low2_idx]
    c_high1 = h4_candles[high1_idx]
    c_high2 = h4_candles[high2_idx]

    # 7. Swing points on H1
    h1_lows = find_swing_lows(h1_candles, 4)
    h1_highs = find_swing_highs(h1_candles, 4)
    h1_low1_idx = h1_lows[2] if len(h1_lows) > 2 else 40
    h1_high1_idx = h1_highs[2] if len(h1_highs) > 2 else 60
    h1_low2_idx = h1_lows[5] if len(h1_lows) > 5 else 120
    h1_c_low1 = h1_candles[h1_low1_idx]
    h1_c_high1 = h1_candles[h1_high1_idx]
    h1_c_low2 = h1_candles[h1_low2_idx]

    # 8. Swing points on M15
    m15_lows = find_swing_lows(m15_candles, 6)
    m15_highs = find_swing_highs(m15_candles, 6)
    m15_l1_idx = m15_lows[-4] if len(m15_lows) > 3 else len(m15_candles) - 180
    m15_h2_idx = m15_highs[-2] if len(m15_highs) > 1 else len(m15_candles) - 50
    m15_c_low1 = m15_candles[m15_l1_idx]
    m15_c_high2 = m15_candles[m15_h2_idx]

    # =========================================================================
    # TIMEFRAME-SPECIFIC MARKET STRUCTURE (HH / HL & LH / LL)
    # - 1-Way Downward Inheritance (D1 -> H4 -> H1 -> M15)
    # - NO commonDrawings (Tất cả lines xài riêng cho từng timeframe)
    # =========================================================================
    timeframes_dict = {
        # --- D1 (Daily Macro Structure) ---
        "D1": {
            "candles": d1_candles,
            "drawings": [
                {
                    "id": f"d1-{pair_name.lower()}-ms-leg1",
                    "type": "line",
                    "direction": "up",
                    "color": "#10b981",
                    "element": "D1 Bullish Market Structure (HH/HL)",
                    "fromTime": d1_l1["time"],
                    "toTime": d1_h1["time"],
                    "lineWidth": 2.5,
                    "stretch": True,
                    "sourceTimeframe": "D1",
                    "description": "D1 Higher Low (HL) to Higher High (HH)"
                },
                {
                    "id": f"d1-{pair_name.lower()}-ms-leg2",
                    "type": "line",
                    "direction": "down",
                    "color": "#f59e0b",
                    "element": "D1 Bullish Market Structure (HH/HL)",
                    "fromTime": d1_h1["time"],
                    "toTime": d1_l2["time"],
                    "lineWidth": 2.5,
                    "stretch": True,
                    "sourceTimeframe": "D1",
                    "description": "D1 Higher High pullback to Higher Low (HH -> HL)"
                }
            ]
        },

        # --- H4 (4-Hour Market Structure) ---
        "H4": {
            "candles": h4_candles,
            "drawings": [
                {
                    "id": f"h4-{pair_name.lower()}-ms-leg1",
                    "type": "line",
                    "direction": "up",
                    "color": "#38bdf8",
                    "element": "H4 Bullish Market Structure (HH/HL)",
                    "fromTime": c_low1["time"],
                    "toTime": c_high1["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "H4",
                    "description": "H4 Higher Low to Higher High (HL1 -> HH1)"
                },
                {
                    "id": f"h4-{pair_name.lower()}-ms-leg2",
                    "type": "line",
                    "direction": "down",
                    "color": "#fb7185",
                    "element": "H4 Bullish Market Structure (HH/HL)",
                    "fromTime": c_high1["time"],
                    "toTime": c_low2["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "H4",
                    "description": "H4 Pullback Higher High to Higher Low (HH1 -> HL2)"
                },
                {
                    "id": f"h4-{pair_name.lower()}-ms-leg3",
                    "type": "line",
                    "direction": "up",
                    "color": "#38bdf8",
                    "element": "H4 Bullish Market Structure (HH/HL)",
                    "fromTime": c_low2["time"],
                    "toTime": c_high2["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "H4",
                    "description": "H4 Continuation Higher Low to Higher High (HL2 -> HH2)"
                }
            ]
        },

        # --- H1 (1-Hour Bearish Market Structure) ---
        "H1": {
            "candles": h1_candles,
            "drawings": [
                {
                    "id": f"h1-{pair_name.lower()}-ms-leg1",
                    "type": "line",
                    "direction": "down",
                    "color": "#ef4444",
                    "element": "H1 Bearish Market Structure (LH/LL)",
                    "fromTime": h1_c_high1["time"],
                    "toTime": h1_c_low1["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "H1",
                    "description": "H1 Lower High to Lower Low (LH1 -> LL1)"
                },
                {
                    "id": f"h1-{pair_name.lower()}-ms-leg2",
                    "type": "line",
                    "direction": "up",
                    "color": "#fbbf24",
                    "element": "H1 Bearish Market Structure (LH/LL)",
                    "fromTime": h1_c_low1["time"],
                    "toTime": h1_c_high1["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "H1",
                    "description": "H1 Pullback Lower Low to Lower High"
                },
                {
                    "id": f"h1-{pair_name.lower()}-ms-leg3",
                    "type": "line",
                    "direction": "down",
                    "color": "#ef4444",
                    "element": "H1 Bearish Market Structure (LH/LL)",
                    "fromTime": h1_c_high1["time"],
                    "toTime": h1_c_low2["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "H1",
                    "description": "H1 Continuation Lower High to Lower Low (LH2 -> LL2)"
                }
            ]
        },

        # --- M15 (15-Minute Scalp Structure) ---
        "M15": {
            "candles": m15_candles,
            "drawings": [
                {
                    "id": f"m15-{pair_name.lower()}-ms-leg1",
                    "type": "line",
                    "direction": "up",
                    "color": "#a855f7",
                    "element": "M15 Scalp Structure (HH/HL)",
                    "fromTime": m15_c_low1["time"],
                    "toTime": m15_c_high2["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "sourceTimeframe": "M15",
                    "description": "M15 Scalp HL -> HH"
                }
            ]
        }
    }

    # Timeframe Units (in Seconds)
    timeframe_units = {
        "D1": 86400,
        "H4": 14400,
        "H1": 3600,
        "M15": 900,
        "M5": 300,
        "M2": 120,
        "M1": 60
    }

    # 1-Way Downward Conversion Ratios (Larger -> Smaller)
    timeframe_conversions = [
        {"from": "D1", "to": "H4", "ratio": 6.0},
        {"from": "H4", "to": "H1", "ratio": 4.0},
        {"from": "H1", "to": "M15", "ratio": 4.0},
        {"from": "M15", "to": "M5", "ratio": 3.0},
        {"from": "M5", "to": "M2", "ratio": 2.5}, # Non-divisible scenario
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

    with gzip.open(gz_path, "wb") as f:
        f.write(json_bytes)

    json_size_kb = len(json_bytes) / 1024.0
    gz_size_kb = os.path.getsize(gz_path) / 1024.0
    ratio = (1.0 - gz_size_kb / json_size_kb) * 100

    print(f"Generated: {symbol_slug}")
    print(f"   -> JSON: {json_filename} ({json_size_kb:.1f} KB)")
    print(f"   -> GZIP: {gz_filename} ({gz_size_kb:.1f} KB, -{ratio:.1f}% compression)\n")


def main():
    print("=" * 65)
    print("Forex Multi-Timeframe Line JSON & GZIP Test Data Generator")
    print("Price-Consistent Aggregation & Wick-Anchored Lines (NO LABELS)")
    print("=" * 65 + "\n")

    pairs = [
        {"name": "EUR/USD", "base": 1.0850, "volatility": 0.00065},
        {"name": "GBP/USD", "base": 1.2950, "volatility": 0.00085},
        {"name": "USD/JPY", "base": 152.80, "volatility": 0.15000},
        {"name": "XAU/USD", "base": 2680.0, "volatility": 2.50000},
    ]

    script_dir = os.path.dirname(os.path.abspath(__file__))

    for pair in pairs:
        dataset = create_forex_dataset(pair["name"], pair["base"], pair["volatility"])
        save_test_dataset(dataset, script_dir)

    print("=" * 65)
    print("All line test files successfully updated in test_data/!")
    print("=" * 65)


if __name__ == "__main__":
    main()
