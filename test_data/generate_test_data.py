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

    # 5. Swing points on H4
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

    # 6. Swing points on H1
    h1_lows = find_swing_lows(h1_candles, 4)
    h1_highs = find_swing_highs(h1_candles, 4)
    h1_low1_idx = h1_lows[2] if len(h1_lows) > 2 else 40
    h1_high1_idx = h1_highs[2] if len(h1_highs) > 2 else 60
    h1_low2_idx = h1_lows[5] if len(h1_lows) > 5 else 120
    h1_c_low1 = h1_candles[h1_low1_idx]
    h1_c_high1 = h1_candles[h1_high1_idx]
    h1_c_low2 = h1_candles[h1_low2_idx]

    # 7. Swing points on M15
    m15_lows = find_swing_lows(m15_candles, 6)
    m15_highs = find_swing_highs(m15_candles, 6)
    m15_l1_idx = m15_lows[-4] if len(m15_lows) > 3 else len(m15_candles) - 180
    m15_h2_idx = m15_highs[-2] if len(m15_highs) > 1 else len(m15_candles) - 50
    m15_c_low1 = m15_candles[m15_l1_idx]
    m15_c_high2 = m15_candles[m15_h2_idx]

    # =========================================================================
    # 1. COMMON DRAWINGS (Chỉ có 2 chiều: Tăng 'up' hoặc Giảm 'down', KHÔNG có label)
    # - Chiều tăng: Đáy nến 1 (Low) -> Đỉnh nến 2 (High)
    # - Chiều giảm: Đỉnh nến 1 (High) -> Đáy nến 2 (Low)
    # =========================================================================
    common_drawings = [
        {
            "id": f"common-{pair_name.lower()}-bullish-line",
            "type": "line",
            "direction": "up", # Chiều tăng: Đáy nến đầu -> Đỉnh nến cuối
            "color": "#10b981",
            "fromTime": c_low1["time"],
            "toTime": c_high1["time"],
            "lineWidth": 2,
            "stretch": True,
            "description": "Bullish line from candle 1 Low to candle 2 High across all timeframes."
        },
        {
            "id": f"common-{pair_name.lower()}-bearish-line",
            "type": "line",
            "direction": "down", # Chiều giảm: Đỉnh nến đầu -> Đáy nến cuối
            "color": "#ef4444",
            "fromTime": c_high1["time"],
            "toTime": c_low2["time"],
            "lineWidth": 2,
            "stretch": True,
            "description": "Bearish line from candle 1 High to candle 2 Low across all timeframes."
        }
    ]

    # =========================================================================
    # 2. SPECIFIC DRAWINGS (Chỉ có 2 chiều: Tăng 'up' hoặc Giảm 'down', KHÔNG có label)
    # =========================================================================
    timeframes_dict = {
        # --- H4 (4-Hour) ---
        "H4": {
            "candles": h4_candles,
            "drawings": [
                {
                    "id": f"h4-{pair_name.lower()}-swing-up",
                    "type": "line",
                    "direction": "up",
                    "color": "#38bdf8",
                    "fromTime": c_low1["time"],
                    "toTime": c_high2["time"],
                    "lineWidth": 2,
                    "stretch": True, # Kéo dãn theo nến trên H1 và M15
                    "description": "H4 Bullish line (candle 1 Low -> candle 2 High), stretches across H1 and M15."
                }
            ]
        },

        # --- H1 (1-Hour) ---
        "H1": {
            "candles": h1_candles,
            "drawings": [
                {
                    "id": f"h1-{pair_name.lower()}-intraday-down",
                    "type": "line",
                    "direction": "down",
                    "color": "#eab308",
                    "fromTime": h1_c_high1["time"],
                    "toTime": h1_c_low2["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "description": "H1 Intraday Bearish line (candle 1 High -> candle 2 Low)."
                }
            ]
        },

        # --- M15 (15-Minute) ---
        "M15": {
            "candles": m15_candles,
            "drawings": [
                {
                    "id": f"m15-{pair_name.lower()}-scalp-up",
                    "type": "line",
                    "direction": "up",
                    "color": "#a855f7",
                    "fromTime": m15_c_low1["time"],
                    "toTime": m15_c_high2["time"],
                    "lineWidth": 2,
                    "stretch": False, # Cố định ở M15
                    "description": "M15 Scalp Bullish line (candle 1 Low -> candle 2 High)."
                }
            ]
        },

        # --- D1 (Daily) ---
        "D1": {
            "candles": d1_candles,
            "drawings": []
        }
    }

    return {
        "symbol": pair_name,
        "title": f"{pair_name} Multi-Timeframe Line Structure",
        "description": "Candles and lines are 100% price-consistent across all timeframes. Lines snap to actual candle wicks.",
        "commonDrawings": common_drawings,
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
