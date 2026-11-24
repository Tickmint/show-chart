#!/usr/bin/env python3
"""
Forex Candlestick, Market Structure & POI / Key Level Test Data Generator
- Timeframes: Exactly 3 timeframes: M5 (300s), M2 (120s), M1 (60s).
- Hierarchical Market Structure Cycle:
    * M5: Largest macro structure spanning the entire dataset (Swings 1 to 6).
    * M2: Formed STRICTLY in the LATEST pullback (Swing 5: LL4 -> LH5) and pulse wave (Swing 6: LH5 -> LL6)
      as price tests the M5 Key Level at LH5 and M5 POI at LL4.
    * M1: Formed STRICTLY in M2's latest pullback/pulse wave (M2 Swing 5).
- Key Levels & POI Requirements:
    * Key Level Finite: Originates at HL2, extends horizontally across until Leg 4 breaks below
      it explicitly executed by 2 consecutive Bearish Marubozu candles.
    * POI Finite: Originates on the rally leg (HL2 -> HH3), extends horizontally across until
      the downward leg cuts through it.
    * Key Level Infinite ("Key Level Infi"): Originates at LH5, extends infinitely to the right.
    * POI Infinite ("POI Infi"): Originates at LL4 level on Leg 6 continuation, extends infinitely to the right.
    * Imbalance (Fair Value Gap - FVG): Formed by a 3-candle sequence where Candle 2 has a large
      impulsive displacement body and Candle 1 High < Candle 3 Low (untouched gap).
- Downward-only inheritance: POIs/drawings on lower timeframes do NOT appear on higher timeframes.
- Outputs both plain JSON (.json) and compressed GZIP (.json.gz).
"""

import os
import json
import gzip
import random
from typing import Dict, List, Any


def generate_smooth_swing(
    start_p: float,
    end_p: float,
    count: int,
    vol: float,
    decimals: int,
    start_time: int,
    time_step: int = 60
) -> List[Dict[str, Any]]:
    """Generates continuous candlestick series along a price swing path with realistic wicks and bodies."""
    candles = []
    curr_p = start_p

    for i in range(count):
        remaining = count - i
        step_target = (end_p - curr_p) / remaining
        c_open = curr_p
        drift = step_target + (random.random() - 0.48) * (vol * 0.45)
        c_close = c_open + drift

        # Generate realistic forex wicks
        w_up = abs(random.gauss(0, vol * 0.35))
        w_dn = abs(random.gauss(0, vol * 0.35))
        c_high = max(c_open, c_close) + w_up
        c_low = min(c_open, c_close) - w_dn

        # Clamp low and high
        c_high = max(c_high, max(c_open, c_close) + 0.00001)
        c_low = min(c_low, min(c_open, c_close) - 0.00001)

        candles.append({
            "time": start_time + i * time_step,
            "open": round(c_open, decimals),
            "high": round(c_high, decimals),
            "low": round(c_low, decimals),
            "close": round(c_close, decimals)
        })
        curr_p = c_close

    return candles


def generate_base_m1_candles(
    start_time: int,
    total_count: int,
    base_price: float,
    volatility: float
) -> List[Dict[str, Any]]:
    """Generates continuous base M1 candlestick series (1200 candles) with clean fractal market structures.
    Total M1: 1200 candles (M5: 240 candles, M2: 600 candles).
    Macro M5 Swings:
      - Swing 1 (0..199 = M5 0..39): L0 -> H1
      - Swing 2 (200..349 = M5 40..69): H1 -> HL2 (smooth macro pullback, no LTF drawings here)
      - Swing 3 (350..599 = M5 70..119): HL2 -> HH3 (contains M5 FVG Imbalance and Finite POI)
      - Swing 4 (600..849 = M5 120..169): HH3 -> LL4 (contains 2 M5 Marubozu breakout candles breaking Key Level)
      - Swing 5 (850..1024 = M5 170..204): LL4 -> LH5 (Pullback mới nhất -> M2 forms internal rally into M5 Key Level at LH5)
      - Swing 6 (1025..1199 = M5 205..239): LH5 -> LL6 (Pulse wave mới nhất -> M2 breaks Key Level & M1 forms micro structure)
    """
    decimals = 5 if base_price < 20 else 2

    # Proportional price targets for M5 Macro Structure
    p_l0 = base_price
    p_h1 = base_price * 1.0055
    p_hl2 = base_price * 1.0022
    p_hh3 = base_price * 1.0090
    p_ll4 = base_price * 0.9960
    p_lh5 = base_price * 1.0015
    p_ll6 = base_price * 0.9935

    candles: List[Dict[str, Any]] = []

    # -------------------------------------------------------------
    # 1. Swing 1: M1 0..199 (M5 0..39) -> L0 to H1 (Impulse Up)
    # -------------------------------------------------------------
    sw1 = generate_smooth_swing(p_l0, p_h1, 200, volatility, decimals, start_time)
    candles.extend(sw1)

    # -------------------------------------------------------------
    # 2. Swing 2: M1 200..349 (M5 40..69) -> H1 to HL2 (Smooth Macro Pullback)
    # -------------------------------------------------------------
    t200 = start_time + 200 * 60
    sw2 = generate_smooth_swing(candles[-1]["close"], p_hl2, 150, volatility, decimals, t200)
    candles.extend(sw2)

    # -------------------------------------------------------------
    # 3. Swing 3: M1 350..599 (M5 70..119) -> HL2 to HH3 (Macro Rally Up)
    # Contains M5 FVG Imbalance and M5 Finite POI
    # -------------------------------------------------------------
    t350 = start_time + 350 * 60
    sw3 = generate_smooth_swing(candles[-1]["close"], p_hh3, 250, volatility, decimals, t350)
    candles.extend(sw3)

    # -------------------------------------------------------------
    # 4. Swing 4: M1 600..849 (M5 120..169) -> HH3 to LL4 (Macro Plunge Down)
    # Crosses M5 FVG, M5 POI, and breaks M5 Key Level (HL2) with 2 Marubozu candles
    # -------------------------------------------------------------
    t600 = start_time + 600 * 60
    sw4 = generate_smooth_swing(candles[-1]["close"], p_ll4, 250, volatility, decimals, t600)
    candles.extend(sw4)

    # -------------------------------------------------------------
    # 5. Swing 5 & 6: M1 850..1199 (M5 170..239, M2 425..599)
    # PULLBACK MỚI NHẤT & PULSE WAVE MỚI NHẤT:
    # Here, smaller timeframe M2 develops its structure at the latest M5 Key Level (LH5) and POI (LL4)!
    # -------------------------------------------------------------
    p_m2_h1 = base_price * 0.9990
    p_m2_hl2 = base_price * 0.9975
    p_m2_ll4 = base_price * 0.9955
    p_m2_lh5 = base_price * 0.9980

    # M2 Sw1: 850..899 (50 candles = M2 425..449) -> LL4 to M2 H1
    t850 = start_time + 850 * 60
    candles.extend(generate_smooth_swing(candles[-1]["close"], p_m2_h1, 50, volatility, decimals, t850))

    # M2 Sw2: 900..939 (40 candles = M2 450..469) -> M2 H1 to M2 HL2
    t900 = start_time + 900 * 60
    candles.extend(generate_smooth_swing(candles[-1]["close"], p_m2_hl2, 40, volatility, decimals, t900))

    # M2 Sw3: 940..1024 (85 candles = M2 470..512) -> M2 HL2 to M2 HH3 (= M5 LH5, testing M5 Key Level!)
    t940 = start_time + 940 * 60
    candles.extend(generate_smooth_swing(candles[-1]["close"], p_lh5, 85, volatility, decimals, t940))

    # M2 Sw4: 1025..1109 (85 candles = M2 513..554) -> M2 HH3 to M2 LL4 (Breakout plunge from M5 Key Level)
    t1025 = start_time + 1025 * 60
    candles.extend(generate_smooth_swing(candles[-1]["close"], p_m2_ll4, 85, volatility, decimals, t1025))

    # M2 Sw5: 1110..1159 (50 candles = M2 555..579) -> M2 LL4 to M2 LH5 (pullback wave mới nhất of M2)
    # Inside this wave, M1 forms its micro structure!
    p_m1_h1 = base_price * 0.9968
    p_m1_hl2 = base_price * 0.9962
    p_m1_hh3 = p_m2_lh5
    p_m1_ll4 = base_price * 0.9958
    p_m1_lh5 = base_price * 0.9965
    t1110 = start_time + 1110 * 60
    candles.extend(generate_smooth_swing(candles[-1]["close"], p_m1_h1, 8, volatility * 0.5, decimals, t1110))
    candles.extend(generate_smooth_swing(candles[-1]["close"], p_m1_hl2, 8, volatility * 0.5, decimals, t1110 + 8 * 60))
    candles.extend(generate_smooth_swing(candles[-1]["close"], p_m1_hh3, 12, volatility * 0.5, decimals, t1110 + 16 * 60))
    candles.extend(generate_smooth_swing(candles[-1]["close"], p_m1_ll4, 10, volatility * 0.5, decimals, t1110 + 28 * 60))
    candles.extend(generate_smooth_swing(candles[-1]["close"], p_m1_lh5, 7, volatility * 0.5, decimals, t1110 + 38 * 60))
    candles.extend(generate_smooth_swing(candles[-1]["close"], p_m2_lh5, 5, volatility * 0.5, decimals, t1110 + 45 * 60))

    # M2 Sw6: 1160..1199 (40 candles = M2 580..599) -> M2 LH5 to M2 LL6 = M5 LL6 (Pulse wave continuation)
    t1160 = start_time + 1160 * 60
    candles.extend(generate_smooth_swing(candles[-1]["close"], p_ll6, 40, volatility, decimals, t1160))

    # =========================================================================
    # INJECT TEXTBOOK IMBALANCE (FAIR VALUE GAP - FVG)
    # Bullish FVG: Candle 1 High < Candle 3 Low (Displacement candle 2 creates untouched gap)
    # =========================================================================
    # 1. M5 Imbalance: M5 candles 90, 91, 92 (M1 candles 450..464)
    fvg_bottom_m5 = round(candles[449]["close"] + volatility * 1.5, decimals)
    for i in range(450, 455):
        candles[i]["high"] = min(candles[i]["high"], fvg_bottom_m5)
        candles[i]["open"] = min(candles[i]["open"], fvg_bottom_m5)
        candles[i]["close"] = min(candles[i]["close"], fvg_bottom_m5)
        candles[i]["low"] = min(candles[i]["low"], fvg_bottom_m5)
    candles[452]["high"] = fvg_bottom_m5  # Candle 1 High = fvg_bottom_m5

    curr_fvg = fvg_bottom_m5
    step_fvg = (volatility * 1.8)
    for i in range(455, 460):
        c_open = curr_fvg
        c_close = c_open + step_fvg
        candles[i]["open"] = round(c_open, decimals)
        candles[i]["high"] = round(c_close + volatility * 0.1, decimals)
        candles[i]["low"] = round(c_open - volatility * 0.05, decimals)
        candles[i]["close"] = round(c_close, decimals)
        curr_fvg = c_close

    fvg_top_m5 = round(fvg_bottom_m5 + volatility * 2.2, decimals)
    for i in range(460, 465):
        candles[i]["low"] = max(candles[i]["low"], fvg_top_m5)
        candles[i]["open"] = max(candles[i]["open"], fvg_top_m5)
        candles[i]["close"] = max(candles[i]["close"], fvg_top_m5)
        candles[i]["high"] = max(candles[i]["high"], fvg_top_m5 + volatility * 0.5)
    candles[461]["low"] = fvg_top_m5  # Candle 3 Low = fvg_top_m5

    # 2. M2 Imbalance: In the latest wave M2 Sw3, M2 candles 495, 496, 497 (M1 candles 990..995)
    fvg_bottom_m2 = round(candles[989]["close"] + volatility * 0.8, decimals)
    candles[990]["high"] = fvg_bottom_m2
    candles[991]["high"] = fvg_bottom_m2
    # Candle 496 displacement:
    candles[992]["open"] = round(fvg_bottom_m2 + volatility * 0.1, decimals)
    candles[992]["close"] = round(fvg_bottom_m2 + volatility * 1.6, decimals)
    candles[992]["high"] = candles[992]["close"]
    candles[992]["low"] = candles[992]["open"]
    candles[993]["open"] = candles[992]["close"]
    candles[993]["close"] = round(candles[992]["close"] + volatility * 1.2, decimals)
    candles[993]["high"] = candles[993]["close"]
    candles[993]["low"] = candles[993]["open"]
    # Candle 497:
    fvg_top_m2 = round(fvg_bottom_m2 + volatility * 1.4, decimals)
    candles[994]["low"] = max(candles[994]["low"], fvg_top_m2)
    candles[994]["open"] = max(candles[994]["open"], fvg_top_m2)
    candles[994]["close"] = max(candles[994]["close"], fvg_top_m2 + volatility * 0.4)
    candles[994]["high"] = max(candles[994]["high"], candles[994]["close"] + volatility * 0.2)
    candles[995]["low"] = max(candles[995]["low"], fvg_top_m2)
    candles[995]["open"] = candles[994]["close"]
    candles[995]["close"] = candles[995]["open"] + volatility * 0.2
    candles[995]["high"] = candles[995]["close"] + volatility * 0.1

    # 3. M1 Imbalance: In the latest wave M1 Sw3, M1 candles 1130, 1131, 1132
    fvg_bottom_m1 = round(candles[1129]["close"] + volatility * 0.4, decimals)
    candles[1130]["high"] = fvg_bottom_m1
    candles[1130]["close"] = round(fvg_bottom_m1 - volatility * 0.2, decimals)
    candles[1130]["open"] = round(fvg_bottom_m1 - volatility * 0.4, decimals)
    candles[1130]["low"] = candles[1130]["open"]

    fvg_top_m1 = round(fvg_bottom_m1 + volatility * 0.7, decimals)
    candles[1131]["open"] = round(fvg_bottom_m1 + volatility * 0.1, decimals)
    candles[1131]["close"] = round(fvg_top_m1 + volatility * 0.5, decimals)
    candles[1131]["high"] = candles[1131]["close"]
    candles[1131]["low"] = candles[1131]["open"]

    candles[1132]["low"] = fvg_top_m1
    candles[1132]["open"] = candles[1131]["close"]
    candles[1132]["close"] = round(candles[1132]["open"] + volatility * 0.2, decimals)
    candles[1132]["high"] = candles[1132]["close"]

    # =========================================================================
    # INJECT 2 CONSECUTIVE BEARISH MARUBOZU CANDLES AT KEY LEVEL BREAKOUT
    # (Solid red body, zero wicks: open == high, close == low)
    # =========================================================================
    # 1. M5 Breakout: M5 candles 149 & 150 (M1 candles 745..754)
    p_mb_start = candles[744]["close"]
    step_m5_mb = (volatility * 1.5)
    for i in range(745, 755):
        c_open = p_mb_start
        c_close = round(c_open - step_m5_mb, decimals)
        candles[i]["open"] = round(c_open, decimals)
        candles[i]["high"] = round(c_open, decimals)  # Zero upper wick
        candles[i]["low"] = round(c_close, decimals)   # Zero lower wick
        candles[i]["close"] = round(c_close, decimals)
        p_mb_start = c_close

    # 2. M2 Breakout: In latest pulse wave M2 Sw4, M2 candles 536 & 537 (M1 candles 1072..1075)
    p_mb2_start = candles[1071]["close"]
    step_m2_mb = (volatility * 1.8)
    for i in range(1072, 1076):
        c_open = p_mb2_start
        c_close = round(c_open - step_m2_mb, decimals)
        candles[i]["open"] = round(c_open, decimals)
        candles[i]["high"] = round(c_open, decimals)
        candles[i]["low"] = round(c_close, decimals)
        candles[i]["close"] = round(c_close, decimals)
        p_mb2_start = c_close

    # 3. M1 Breakout: In latest pulse wave M1 Sw4, M1 candles 1144 & 1145
    p_mb1_start = candles[1143]["close"]
    step_m1_mb = (volatility * 2.0)
    for i in range(1144, 1146):
        c_open = p_mb1_start
        c_close = round(c_open - step_m1_mb, decimals)
        candles[i]["open"] = round(c_open, decimals)
        candles[i]["high"] = round(c_open, decimals)
        candles[i]["low"] = round(c_close, decimals)
        candles[i]["close"] = round(c_close, decimals)
        p_mb1_start = c_close

    # Final sanitation: ensure all candles have valid OHLC
    for c in candles:
        c["high"] = max(c["high"], c["open"], c["close"])
        c["low"] = min(c["low"], c["open"], c["close"])

    return candles


def aggregate_candles(
    base_candles: List[Dict[str, Any]],
    group_size: int,
    decimals: int
) -> List[Dict[str, Any]]:
    """Aggregates base smaller candles into larger timeframe candles (M1 -> M2 -> M5)."""
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

        cand_data: Dict[str, Any] = {
            "time": c_time,
            "open": round(c_open, decimals),
            "high": round(c_high, decimals),
            "low": round(c_low, decimals),
            "close": round(c_close, decimals)
        }

        chunk_news = []
        for c in chunk:
            if "news" in c and c["news"]:
                chunk_news.extend(c["news"])
        if chunk_news:
            cand_data["news"] = chunk_news

        aggregated.append(cand_data)
    return aggregated


NEWS_TEMPLATES = [
    {
        "title": "US Non-Farm Payrolls (NFP)",
        "impact": "high",
        "description": "Actual: 254K vs Forecast: 147K - employment surged."
    },
    {
        "title": "Fed Interest Rate Decision",
        "impact": "high",
        "description": "Fed maintains policy trajectory with 25 bps shift."
    },
    {
        "title": "US Core CPI Inflation MoM",
        "impact": "high",
        "description": "Core consumer prices rise 0.3% MoM."
    },
    {
        "title": "ECB Monetary Policy Statement",
        "impact": "high",
        "description": "President notes balanced risks to economic growth."
    },
    {
        "title": "Retail Sales MoM",
        "impact": "medium",
        "description": "Consumer spending advanced 0.4% in latest report."
    },
    {
        "title": "Initial Jobless Claims",
        "impact": "medium",
        "description": "Weekly claims dropped to 218K beating expectations."
    },
    {
        "title": "Manufacturing PMI",
        "impact": "medium",
        "description": "Survey indicates expansion above the 50 neutral mark."
    },
    {
        "title": "Services PMI",
        "impact": "medium",
        "description": "Business activity in the services sector strengthened."
    },
    {
        "title": "Trade Balance",
        "impact": "low",
        "description": "Goods and services trade gap narrowed moderately."
    },
    {
        "title": "Wholesale Inventories",
        "impact": "low",
        "description": "Inventories increased slightly by 0.2%."
    }
]

LABEL_TEMPLATES = [
    {"text": "Bullish Order Block (OB)", "position": "below"},
    {"text": "Bearish Order Block (OB)", "position": "above"},
    {"text": "Break of Structure (BOS)", "position": "above"},
    {"text": "Change of Character (CHoCH)", "position": "below"},
    {"text": "Liquidity Sweep (BSL)", "position": "above"},
    {"text": "Liquidity Sweep (SSL)", "position": "below"},
    {"text": "Fair Value Gap (FVG)", "position": "above"},
    {"text": "Asian Session High", "position": "above"},
    {"text": "New York Open", "position": "below"},
]


def inject_random_news_and_labels(
    m1_candles: List[Dict[str, Any]],
    m2_candles: List[Dict[str, Any]],
    m5_candles: List[Dict[str, Any]],
    rng: random.Random
):
    """Randomly injects 0, 1, or multiple news items and callout labels with true/false visibility."""
    # 1. Random News on M1 candles (some with 1, some with 2 or 3 items)
    news_indices = sorted(rng.sample(range(20, len(m1_candles) - 20), k=18))
    for idx in news_indices:
        num_items = rng.choices([1, 2, 3], weights=[0.65, 0.25, 0.10])[0]
        items = rng.sample(NEWS_TEMPLATES, k=min(num_items, len(NEWS_TEMPLATES)))
        m1_candles[idx]["news"] = [
            {
                "id": f"news-{m1_candles[idx]['time']}-{k+1}",
                "title": item["title"],
                "impact": item["impact"],
                "description": item["description"],
                "time": m1_candles[idx]["time"] + k * 60
            }
            for k, item in enumerate(items)
        ]

    # Re-aggregate news into M2 and M5
    for i, m2_c in enumerate(m2_candles):
        c_chunk = m1_candles[i * 2 : (i + 1) * 2]
        c_news = [n for c in c_chunk if "news" in c for n in c["news"]]
        if c_news:
            m2_c["news"] = c_news

    for i, m5_c in enumerate(m5_candles):
        c_chunk = m1_candles[i * 5 : (i + 1) * 5]
        c_news = [n for c in c_chunk if "news" in c for n in c["news"]]
        if c_news:
            m5_c["news"] = c_news

    # 2. Random Callout Labels across timeframes (with random true/false visibility)
    def add_labels_to_candles(c_list: List[Dict[str, Any]], count: int):
        indices = sorted(rng.sample(range(10, len(c_list) - 10), k=min(count, len(c_list) - 20)))
        for k, idx in enumerate(indices):
            tmpl = LABEL_TEMPLATES[k % len(LABEL_TEMPLATES)]
            is_visible = (k % 3 != 0)  # 2/3 true, 1/3 false to test default true/false
            label_obj = {
                "id": f"label-{c_list[idx]['time']}-1",
                "text": tmpl["text"],
                "position": tmpl.get("position", "auto"),
                "visible": is_visible
            }
            c_list[idx]["labels"] = [label_obj]
            c_list[idx]["label"] = label_obj

    add_labels_to_candles(m5_candles, 8)
    add_labels_to_candles(m2_candles, 10)
    add_labels_to_candles(m1_candles, 12)


def create_forex_dataset(
    pair_name: str,
    base_price: float,
    volatility: float,
    title: Optional[str] = None,
    group: Optional[str] = None
) -> Dict[str, Any]:
    """Builds an aligned 3-timeframe (M5, M2, M1) dataset with clean SMC structure and 5 blocks per TF."""
    random.seed(hash(pair_name) % 100000)
    base_start_time = 1791158400
    decimals = 5 if base_price < 20 else 2

    # 1. Base 1200 M1 candles (20 hours of continuous price action)
    total_m1 = 1200
    m1_candles = generate_base_m1_candles(base_start_time, total_m1, base_price, volatility)

    # 2. Synchronized Aggregations: M1 -> M2 (2x M1) and M1 -> M5 (5x M1)
    m2_candles = aggregate_candles(m1_candles, 2, decimals)  # 600 M2 candles
    m5_candles = aggregate_candles(m1_candles, 5, decimals)  # 240 M5 candles

    rng = random.Random(hash(pair_name) % 100000 + 42)
    inject_random_news_and_labels(m1_candles, m2_candles, m5_candles, rng)

    pair_slug = pair_name.lower().replace('/', '_')

    # ==========================================
    # SWING POINTS IDENTIFICATION
    # ==========================================
    # --- M5 Macro Structure Swing Points (Full dataset) ---
    m5_l0 = m5_candles[5]
    m5_h1 = m5_candles[39]
    m5_hl2 = m5_candles[69]   # Key Level trough
    m5_hh3 = m5_candles[119]  # Macro Higher High peak
    m5_ll4 = m5_candles[169]  # Macro Lower Low trough
    m5_lh5 = m5_candles[204]  # Macro Lower High peak
    m5_ll6 = m5_candles[239]  # Continuation Lower Low

    # --- M2 Internal Structure Swing Points (Nested in M5 latest pullback & pulse wave: M2 425..599) ---
    m2_l0 = m2_candles[425]
    m2_h1 = m2_candles[449]
    m2_hl2 = m2_candles[469]  # M2 Key Level trough
    m2_hh3 = m2_candles[512]  # M2 Higher High (reached M5 LH5 Key Level!)
    m2_ll4 = m2_candles[554]  # M2 Lower Low
    m2_lh5 = m2_candles[579]  # M2 Lower High
    m2_ll6 = m2_candles[599]  # M2 Continuation Low

    # --- M1 Micro Structure Swing Points (Nested in M2 latest pullback & pulse wave: M1 1110..1199) ---
    m1_l0 = m1_candles[1110]
    m1_h1 = m1_candles[1117]
    m1_hl2 = m1_candles[1125]  # M1 Key Level trough
    m1_hh3 = m1_candles[1138]  # M1 Higher High (Peak 1)
    m1_ll4 = m1_candles[1145]  # M1 Lower Low (Trough from 2 Marubozu breakout candles)
    m1_lh5 = m1_candles[1160]  # M1 Lower High (Peak 2 of retracement rally)
    m1_ll6 = m1_candles[1199]  # M1 Continuation Low (Lowest Low of downtrend plunge)

    # ==========================================
    # TIMEFRAME DRAWINGS
    # Exactly 6 Market Structure lines + Exactly 5 blocks per TF
    # ==========================================
    timeframes_dict = {
        # --- M5: Macro Market Structure ---
        "M5": {
            "candles": m5_candles,
            "drawings": [
                # 6 Market Structure Zigzag Lines (Grouped into 2 complete market structures: Bullish & Bearish)
                {
                    "id": f"m5-{pair_slug}-ms-leg1",
                    "type": "line",
                    "direction": "up",
                    "color": "#10b981",
                    "element": "M5 Bullish Market Structure",
                    "group": "M5 Bullish Market Structure",
                    "displayName": "M5 Leg 1 (L0 -> H1)",
                    "fromTime": m5_l0["time"],
                    "toTime": m5_h1["time"],
                    "lineWidth": 2.5,
                    "stretch": True,
                    "timeframe": "M5",
                    "sourceTimeframe": "M5",
                    "description": "M5 Impulse Swing Low to High (L0 -> H1)"
                },
                {
                    "id": f"m5-{pair_slug}-ms-leg2",
                    "type": "line",
                    "direction": "down",
                    "color": "#10b981",
                    "element": "M5 Bullish Market Structure",
                    "group": "M5 Bullish Market Structure",
                    "displayName": "M5 Leg 2 (H1 -> HL2)",
                    "fromTime": m5_h1["time"],
                    "toTime": m5_hl2["time"],
                    "lineWidth": 2.5,
                    "stretch": True,
                    "timeframe": "M5",
                    "sourceTimeframe": "M5",
                    "description": "M5 Pullback High to Higher Low (H1 -> HL2)"
                },
                {
                    "id": f"m5-{pair_slug}-ms-leg3",
                    "type": "line",
                    "direction": "up",
                    "color": "#10b981",
                    "element": "M5 Bullish Market Structure",
                    "group": "M5 Bullish Market Structure",
                    "displayName": "M5 Leg 3 (HL2 -> HH3)",
                    "fromTime": m5_hl2["time"],
                    "toTime": m5_hh3["time"],
                    "lineWidth": 2.5,
                    "stretch": True,
                    "timeframe": "M5",
                    "sourceTimeframe": "M5",
                    "description": "M5 Continuation Higher Low to Higher High (HL2 -> HH3)"
                },
                {
                    "id": f"m5-{pair_slug}-ms-leg4",
                    "type": "line",
                    "direction": "down",
                    "color": "#ef4444",
                    "element": "M5 Bearish Market Structure",
                    "group": "M5 Bearish Market Structure",
                    "displayName": "M5 Leg 4 (HH3 -> LL4)",
                    "fromTime": m5_hh3["time"],
                    "toTime": m5_ll4["time"],
                    "lineWidth": 2.5,
                    "stretch": True,
                    "timeframe": "M5",
                    "sourceTimeframe": "M5",
                    "description": "M5 Breakout Drop Higher High to Lower Low (HH3 -> LL4)"
                },
                {
                    "id": f"m5-{pair_slug}-ms-leg5",
                    "type": "line",
                    "direction": "up",
                    "color": "#f97316",
                    "element": "M5 Bearish Market Structure",
                    "group": "M5 Bearish Market Structure",
                    "displayName": "M5 Leg 5 (LL4 -> LH5)",
                    "fromTime": m5_ll4["time"],
                    "toTime": m5_lh5["time"],
                    "lineWidth": 2.5,
                    "stretch": True,
                    "timeframe": "M5",
                    "sourceTimeframe": "M5",
                    "description": "M5 Retracement Lower Low to Lower High (LL4 -> LH5)"
                },
                {
                    "id": f"m5-{pair_slug}-ms-leg6",
                    "type": "line",
                    "direction": "down",
                    "color": "#ef4444",
                    "element": "M5 Bearish Market Structure",
                    "group": "M5 Bearish Market Structure",
                    "displayName": "M5 Leg 6 (LH5 -> LL6)",
                    "fromTime": m5_lh5["time"],
                    "toTime": m5_ll6["time"],
                    "lineWidth": 2.5,
                    "stretch": True,
                    "timeframe": "M5",
                    "sourceTimeframe": "M5",
                    "description": "M5 Continuation Lower High to Lower Low (LH5 -> LL6)"
                },
                {
                    "id": f"m5-{pair_slug}-demand-zone",
                    "type": "zone",
                    "color": "#06b6d4",
                    "element": "M5 Market Structure Demand Zone",
                    "displayName": "M5 Demand Zone",
                    "fromTime": m5_candles[0]["time"],
                    "toTime": m5_candles[4]["time"],
                    "paddingRatio": 0.05,
                    "stretch": False,
                    "timeframe": "M5",
                    "sourceTimeframe": "M5",
                    "description": "M5 Demand Zone"
                },
                # Block 1: Key Level Finite (Originates at HL2, broken by 2 Marubozu candles 149 & 150)
                {
                    "id": f"m5-{pair_slug}-kl-finite",
                    "type": "poi",
                    "color": "#8a264c",
                    "element": "M5 Market Structure Key Level (Finite)",
                    "displayName": "M5 - KL (Finite)",
                    "description": "M5 - KL (Finite)",
                    "timeframe": "M5",
                    "sourceTimeframe": "M5",
                    "fromTime": m5_hl2["time"],
                    "topPrice": round(m5_hl2["low"] * 1.0004, decimals),
                    "bottomPrice": round(m5_hl2["low"] * 0.9996, decimals),
                    "candleCount": 82  # Spans M5 69 to 150 (ending at 2nd Marubozu breakout candle)
                },
                # Block 2: Key Level Infinite (Originates at LH5 lower high resistance)
                {
                    "id": f"m5-{pair_slug}-kl-infinite",
                    "type": "poi",
                    "color": "#8a264c",
                    "element": "M5 Market Structure Key Level (Infinite)",
                    "displayName": "M5 - KL (Infinite)",
                    "description": "M5 - KL (Infinite)",
                    "timeframe": "M5",
                    "sourceTimeframe": "M5",
                    "fromTime": m5_lh5["time"],
                    "topPrice": round(m5_lh5["high"] * 1.0004, decimals),
                    "bottomPrice": round(m5_lh5["high"] * 0.9996, decimals),
                    "isInfinite": True
                },
                # Block 3: POI Finite (Originates on Leg 3 rally, extends until Leg 4 cuts through)
                {
                    "id": f"m5-{pair_slug}-poi-finite",
                    "type": "poi",
                    "color": "#0d9488",
                    "element": "M5 Market Structure POI (Finite)",
                    "displayName": "M5 - POI (Finite)",
                    "description": "M5 - POI (Finite)",
                    "timeframe": "M5",
                    "sourceTimeframe": "M5",
                    "fromTime": m5_candles[82]["time"],
                    "topPrice": round(m5_candles[82]["high"] * 1.0003, decimals),
                    "bottomPrice": round(m5_candles[82]["high"] * 0.9997, decimals),
                    "candleCount": 59  # Spans M5 82 to 140
                },
                # Block 4: POI Infinite (Originates at LL4 level on downward leg, extends infinitely right)
                {
                    "id": f"m5-{pair_slug}-poi-infinite",
                    "type": "poi",
                    "color": "#0d9488",
                    "element": "M5 Market Structure POI (Infinite)",
                    "displayName": "M5 - POI (Infinite)",
                    "description": "M5 - POI (Infinite)",
                    "timeframe": "M5",
                    "sourceTimeframe": "M5",
                    "fromTime": m5_candles[222]["time"],
                    "topPrice": round(m5_ll4["low"] * 1.0004, decimals),
                    "bottomPrice": round(m5_ll4["low"] * 0.9996, decimals),
                    "isInfinite": True
                },
                # Block 5: Imbalance (Textbook 3-candle Fair Value Gap [Candle 90 High < Candle 92 Low])
                {
                    "id": f"m5-{pair_slug}-imbalance",
                    "type": "poi",
                    "color": "#0284c7",
                    "element": "M5 Market Structure Imbalance",
                    "displayName": "M5 - Imbalance",
                    "description": "M5 - Imbalance",
                    "timeframe": "M5",
                    "sourceTimeframe": "M5",
                    "fromTime": m5_candles[91]["time"],
                    "topPrice": round(m5_candles[92]["low"], decimals),
                    "bottomPrice": round(m5_candles[90]["high"], decimals),
                    "candleCount": 5
                },
                # Pibonacci for POI Wave (Leg 3: HL2 -> HH3)
                {
                    "id": f"m5-{pair_slug}-pibo-leg3",
                    "type": "pibo",
                    "color": "#38bdf8",
                    "lineColor": "#38bdf8",
                    "zoneColor": "#ef4444",
                    "element": "M5 Market Structure Pibo Leg 3 (0.618-0.8)",
                    "displayName": "M5 Pibo Leg 3 (0.618 - 0.8)",
                    "description": "M5 Fibonacci Retracement on POI leg HL2 -> HH3",
                    "timeframe": "M5",
                    "sourceTimeframe": "M5",
                    "fromTime": m5_hl2["time"],
                    "toTime": m5_hh3["time"],
                    "fromPrice": round(m5_hl2["low"], decimals),
                    "toPrice": round(m5_hh3["high"], decimals),
                    "startLevel": 0,
                    "endLevel": 1,
                    "zones": [
                        {
                            "fromLevel": 0.618,
                            "toLevel": 0.8,
                            "color": "#ef4444"
                        }
                    ]
                },
                # Pibonacci for POI Wave (Leg 6: LH5 -> LL6)
                {
                    "id": f"m5-{pair_slug}-pibo-leg6",
                    "type": "pibo",
                    "color": "#fb7185",
                    "lineColor": "#fb7185",
                    "zoneColor": "#ef4444",
                    "element": "M5 Market Structure Pibo Leg 6 (0.618-0.8)",
                    "displayName": "M5 Pibo Leg 6 (0.618 - 0.8)",
                    "description": "M5 Fibonacci Retracement on POI leg LH5 -> LL6",
                    "timeframe": "M5",
                    "sourceTimeframe": "M5",
                    "fromTime": m5_lh5["time"],
                    "toTime": m5_ll6["time"],
                    "fromPrice": round(m5_lh5["high"], decimals),
                    "toPrice": round(m5_ll6["low"], decimals),
                    "startLevel": 0,
                    "endLevel": 1,
                    "zones": [
                        {
                            "fromLevel": 0.618,
                            "toLevel": 0.8,
                            "color": "#ef4444"
                        }
                    ]
                }
            ]
        },

        # --- M2: Internal Market Structure (STRICTLY in M5 LATEST Pullback & Pulse Wave: M2 425..599) ---
        "M2": {
            "candles": m2_candles,
            "drawings": [
                # 6 Market Structure Zigzag Lines (Grouped into 2 complete market structures: Bullish & Bearish)
                {
                    "id": f"m2-{pair_slug}-ms-leg1",
                    "type": "line",
                    "direction": "up",
                    "color": "#10b981",
                    "element": "M2 Bullish Market Structure",
                    "group": "M2 Bullish Market Structure",
                    "displayName": "M2 Leg 1 (L0 -> H1)",
                    "fromTime": m2_l0["time"],
                    "toTime": m2_h1["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "timeframe": "M2",
                    "sourceTimeframe": "M2",
                    "description": "M2 Impulse Low to High (L0 -> H1)"
                },
                {
                    "id": f"m2-{pair_slug}-ms-leg2",
                    "type": "line",
                    "direction": "down",
                    "color": "#10b981",
                    "element": "M2 Bullish Market Structure",
                    "group": "M2 Bullish Market Structure",
                    "displayName": "M2 Leg 2 (H1 -> HL2)",
                    "fromTime": m2_h1["time"],
                    "toTime": m2_hl2["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "timeframe": "M2",
                    "sourceTimeframe": "M2",
                    "description": "M2 Pullback High to Higher Low (H1 -> HL2)"
                },
                {
                    "id": f"m2-{pair_slug}-ms-leg3",
                    "type": "line",
                    "direction": "up",
                    "color": "#10b981",
                    "element": "M2 Bullish Market Structure",
                    "group": "M2 Bullish Market Structure",
                    "displayName": "M2 Leg 3 (HL2 -> HH3)",
                    "fromTime": m2_hl2["time"],
                    "toTime": m2_hh3["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "timeframe": "M2",
                    "sourceTimeframe": "M2",
                    "description": "M2 Continuation Higher Low to Higher High (HL2 -> HH3)"
                },
                {
                    "id": f"m2-{pair_slug}-ms-leg4",
                    "type": "line",
                    "direction": "down",
                    "color": "#ef4444",
                    "element": "M2 Bearish Market Structure",
                    "group": "M2 Bearish Market Structure",
                    "displayName": "M2 Leg 4 (HH3 -> LL4)",
                    "fromTime": m2_hh3["time"],
                    "toTime": m2_ll4["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "timeframe": "M2",
                    "sourceTimeframe": "M2",
                    "description": "M2 Breakout Drop Higher High to Lower Low (HH3 -> LL4)"
                },
                {
                    "id": f"m2-{pair_slug}-ms-leg5",
                    "type": "line",
                    "direction": "up",
                    "color": "#f97316",
                    "element": "M2 Bearish Market Structure",
                    "group": "M2 Bearish Market Structure",
                    "displayName": "M2 Leg 5 (LL4 -> LH5)",
                    "fromTime": m2_ll4["time"],
                    "toTime": m2_lh5["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "timeframe": "M2",
                    "sourceTimeframe": "M2",
                    "description": "M2 Retracement Lower Low to Lower High (LL4 -> LH5)"
                },
                {
                    "id": f"m2-{pair_slug}-ms-leg6",
                    "type": "line",
                    "direction": "down",
                    "color": "#ef4444",
                    "element": "M2 Bearish Market Structure",
                    "group": "M2 Bearish Market Structure",
                    "displayName": "M2 Leg 6 (LH5 -> LL6)",
                    "fromTime": m2_lh5["time"],
                    "toTime": m2_ll6["time"],
                    "lineWidth": 2,
                    "stretch": True,
                    "timeframe": "M2",
                    "sourceTimeframe": "M2",
                    "description": "M2 Continuation Lower High to Lower Low (LH5 -> LL6)"
                },
                {
                    "id": f"m2-{pair_slug}-scalp-box",
                    "type": "box",
                    "color": "#ec4899",
                    "element": "M2 Market Structure Scalp Box",
                    "displayName": "M2 Scalp Box",
                    "fromTime": m2_candles[425]["time"],
                    "toTime": m2_candles[428]["time"],
                    "paddingRatio": 0.05,
                    "stretch": False,
                    "timeframe": "M2",
                    "sourceTimeframe": "M2",
                    "description": "M2 Scalp Box"
                },
                # Block 1: Key Level Finite (Originates at M2 HL2, broken by 2 Marubozu candles 536 & 537)
                {
                    "id": f"m2-{pair_slug}-kl-finite",
                    "type": "poi",
                    "color": "#8a264c",
                    "element": "M2 Market Structure Key Level (Finite)",
                    "displayName": "M2 - KL (Finite)",
                    "description": "M2 - KL (Finite)",
                    "timeframe": "M2",
                    "sourceTimeframe": "M2",
                    "fromTime": m2_hl2["time"],
                    "topPrice": round(m2_hl2["low"] * 1.0003, decimals),
                    "bottomPrice": round(m2_hl2["low"] * 0.9997, decimals),
                    "candleCount": 69  # Spans M2 469 to 537
                },
                # Block 2: Key Level Infinite (Originates at M2 LH5 lower high)
                {
                    "id": f"m2-{pair_slug}-kl-infinite",
                    "type": "poi",
                    "color": "#8a264c",
                    "element": "M2 Market Structure Key Level (Infinite)",
                    "displayName": "M2 - KL (Infinite)",
                    "description": "M2 - KL (Infinite)",
                    "timeframe": "M2",
                    "sourceTimeframe": "M2",
                    "fromTime": m2_lh5["time"],
                    "topPrice": round(m2_lh5["high"] * 1.0003, decimals),
                    "bottomPrice": round(m2_lh5["high"] * 0.9997, decimals),
                    "isInfinite": True
                },
                # Block 3: POI Finite (Originates on Leg 3 rally, extends until Leg 4 cuts through)
                {
                    "id": f"m2-{pair_slug}-poi-finite",
                    "type": "poi",
                    "color": "#0d9488",
                    "element": "M2 Market Structure POI (Finite)",
                    "displayName": "M2 - POI (Finite)",
                    "description": "M2 - POI (Finite)",
                    "timeframe": "M2",
                    "sourceTimeframe": "M2",
                    "fromTime": m2_candles[485]["time"],
                    "topPrice": round(m2_candles[485]["high"] * 1.0003, decimals),
                    "bottomPrice": round(m2_candles[485]["high"] * 0.9997, decimals),
                    "candleCount": 46  # Spans M2 485 to 530
                },
                # Block 4: POI Infinite (Originates at M2 LL4 level, extends infinitely right)
                {
                    "id": f"m2-{pair_slug}-poi-infinite",
                    "type": "poi",
                    "color": "#0d9488",
                    "element": "M2 Market Structure POI (Infinite)",
                    "displayName": "M2 - POI (Infinite)",
                    "description": "M2 - POI (Infinite)",
                    "timeframe": "M2",
                    "sourceTimeframe": "M2",
                    "fromTime": m2_candles[588]["time"],
                    "topPrice": round(m2_ll4["low"] * 1.0003, decimals),
                    "bottomPrice": round(m2_ll4["low"] * 0.9997, decimals),
                    "isInfinite": True
                },
                # Block 5: Imbalance (Textbook 3-candle Fair Value Gap at M2 495..497)
                {
                    "id": f"m2-{pair_slug}-imbalance",
                    "type": "poi",
                    "color": "#0284c7",
                    "element": "M2 Market Structure Imbalance",
                    "displayName": "M2 - Imbalance",
                    "description": "M2 - Imbalance",
                    "timeframe": "M2",
                    "sourceTimeframe": "M2",
                    "fromTime": m2_candles[496]["time"],
                    "topPrice": round(m2_candles[497]["low"], decimals),
                    "bottomPrice": round(m2_candles[495]["high"], decimals),
                    "candleCount": 5
                },
                # Pibonacci for POI Wave (Leg 3: HL2 -> HH3)
                {
                    "id": f"m2-{pair_slug}-pibo-leg3",
                    "type": "pibo",
                    "color": "#38bdf8",
                    "lineColor": "#38bdf8",
                    "zoneColor": "#ef4444",
                    "element": "M2 Market Structure Pibo Leg 3 (0.618-0.8)",
                    "displayName": "M2 Pibo Leg 3 (0.618 - 0.8)",
                    "description": "M2 Fibonacci Retracement on POI leg HL2 -> HH3",
                    "timeframe": "M2",
                    "sourceTimeframe": "M2",
                    "fromTime": m2_hl2["time"],
                    "toTime": m2_hh3["time"],
                    "fromPrice": round(m2_hl2["low"], decimals),
                    "toPrice": round(m2_hh3["high"], decimals),
                    "startLevel": 0,
                    "endLevel": 1,
                    "zones": [
                        {
                            "fromLevel": 0.618,
                            "toLevel": 0.8,
                            "color": "#ef4444"
                        }
                    ]
                },
                # Pibonacci for POI Wave (Leg 6: LH5 -> LL6)
                {
                    "id": f"m2-{pair_slug}-pibo-leg6",
                    "type": "pibo",
                    "color": "#fb7185",
                    "lineColor": "#fb7185",
                    "zoneColor": "#ef4444",
                    "element": "M2 Market Structure Pibo Leg 6 (0.618-0.8)",
                    "displayName": "M2 Pibo Leg 6 (0.618 - 0.8)",
                    "description": "M2 Fibonacci Retracement on POI leg LH5 -> LL6",
                    "timeframe": "M2",
                    "sourceTimeframe": "M2",
                    "fromTime": m2_lh5["time"],
                    "toTime": m2_ll6["time"],
                    "fromPrice": round(m2_lh5["high"], decimals),
                    "toPrice": round(m2_ll6["low"], decimals),
                    "startLevel": 0,
                    "endLevel": 1,
                    "zones": [
                        {
                            "fromLevel": 0.618,
                            "toLevel": 0.8,
                            "color": "#ef4444"
                        }
                    ]
                }
            ]
        },

        # --- M1: Micro Market Structure (STRICTLY in M2 LATEST Pullback Wave: M1 1110..1159) ---
        "M1": {
            "candles": m1_candles,
            "drawings": [
                # 6 Market Structure Zigzag Lines (Grouped into 2 complete market structures: Bullish & Bearish)
                {
                    "id": f"m1-{pair_slug}-ms-leg1",
                    "type": "line",
                    "direction": "up",
                    "color": "#10b981",
                    "element": "M1 Bullish Market Structure",
                    "group": "M1 Bullish Market Structure",
                    "displayName": "M1 Leg 1 (L0 -> H1)",
                    "fromTime": m1_l0["time"],
                    "toTime": m1_h1["time"],
                    "lineWidth": 1.5,
                    "stretch": True,
                    "timeframe": "M1",
                    "sourceTimeframe": "M1",
                    "description": "M1 Impulse Low to High (L0 -> H1)"
                },
                {
                    "id": f"m1-{pair_slug}-ms-leg2",
                    "type": "line",
                    "direction": "down",
                    "color": "#10b981",
                    "element": "M1 Bullish Market Structure",
                    "group": "M1 Bullish Market Structure",
                    "displayName": "M1 Leg 2 (H1 -> HL2)",
                    "fromTime": m1_h1["time"],
                    "toTime": m1_hl2["time"],
                    "lineWidth": 1.5,
                    "stretch": True,
                    "timeframe": "M1",
                    "sourceTimeframe": "M1",
                    "description": "M1 Pullback High to Higher Low (H1 -> HL2)"
                },
                {
                    "id": f"m1-{pair_slug}-ms-leg3",
                    "type": "line",
                    "direction": "up",
                    "color": "#10b981",
                    "element": "M1 Bullish Market Structure",
                    "group": "M1 Bullish Market Structure",
                    "displayName": "M1 Leg 3 (HL2 -> HH3)",
                    "fromTime": m1_hl2["time"],
                    "toTime": m1_hh3["time"],
                    "lineWidth": 1.5,
                    "stretch": True,
                    "timeframe": "M1",
                    "sourceTimeframe": "M1",
                    "description": "M1 Continuation Higher Low to Higher High (HL2 -> HH3)"
                },
                {
                    "id": f"m1-{pair_slug}-ms-leg4",
                    "type": "line",
                    "direction": "down",
                    "color": "#ef4444",
                    "element": "M1 Bearish Market Structure",
                    "group": "M1 Bearish Market Structure",
                    "displayName": "M1 Leg 4 (HH3 -> LL4)",
                    "fromTime": m1_hh3["time"],
                    "toTime": m1_ll4["time"],
                    "lineWidth": 1.5,
                    "stretch": True,
                    "timeframe": "M1",
                    "sourceTimeframe": "M1",
                    "description": "M1 Breakout Drop Higher High to Lower Low (HH3 -> LL4)"
                },
                {
                    "id": f"m1-{pair_slug}-ms-leg5",
                    "type": "line",
                    "direction": "up",
                    "color": "#f97316",
                    "element": "M1 Bearish Market Structure",
                    "group": "M1 Bearish Market Structure",
                    "displayName": "M1 Leg 5 (LL4 -> LH5)",
                    "fromTime": m1_ll4["time"],
                    "toTime": m1_lh5["time"],
                    "lineWidth": 1.5,
                    "stretch": True,
                    "timeframe": "M1",
                    "sourceTimeframe": "M1",
                    "description": "M1 Retracement Lower Low to Lower High (LL4 -> LH5)"
                },
                {
                    "id": f"m1-{pair_slug}-ms-leg6",
                    "type": "line",
                    "direction": "down",
                    "color": "#ef4444",
                    "element": "M1 Bearish Market Structure",
                    "group": "M1 Bearish Market Structure",
                    "displayName": "M1 Leg 6 (LH5 -> LL6)",
                    "fromTime": m1_lh5["time"],
                    "toTime": m1_ll6["time"],
                    "lineWidth": 1.5,
                    "stretch": True,
                    "timeframe": "M1",
                    "sourceTimeframe": "M1",
                    "description": "M1 Continuation Lower High to Lower Low (LH5 -> LL6)"
                },
                # Block 1: Key Level Finite (Originates at M1 HL2, broken by 2 Marubozu candles 1144 & 1145)
                {
                    "id": f"m1-{pair_slug}-kl-finite",
                    "type": "poi",
                    "color": "#8a264c",
                    "element": "M1 Market Structure Key Level (Finite)",
                    "displayName": "M1 - KL (Finite)",
                    "description": "M1 - KL (Finite)",
                    "timeframe": "M1",
                    "sourceTimeframe": "M1",
                    "fromTime": m1_hl2["time"],
                    "topPrice": round(m1_hl2["low"] * 1.0002, decimals),
                    "bottomPrice": round(m1_hl2["low"] * 0.9998, decimals),
                    "candleCount": 21  # Spans M1 1125 to 1145
                },
                # Block 2: Key Level Infinite (Originates at M1 LH5 lower high)
                {
                    "id": f"m1-{pair_slug}-kl-infinite",
                    "type": "poi",
                    "color": "#8a264c",
                    "element": "M1 Market Structure Key Level (Infinite)",
                    "displayName": "M1 - KL (Infinite)",
                    "description": "M1 - KL (Infinite)",
                    "timeframe": "M1",
                    "sourceTimeframe": "M1",
                    "fromTime": m1_lh5["time"],
                    "topPrice": round(m1_lh5["high"] * 1.0002, decimals),
                    "bottomPrice": round(m1_lh5["high"] * 0.9998, decimals),
                    "isInfinite": True
                },
                # Block 3: POI Finite (Originates on Leg 3 rally, extends until Leg 4 cuts through)
                {
                    "id": f"m1-{pair_slug}-poi-finite",
                    "type": "poi",
                    "color": "#0d9488",
                    "element": "M1 Market Structure POI (Finite)",
                    "displayName": "M1 - POI (Finite)",
                    "description": "M1 - POI (Finite)",
                    "timeframe": "M1",
                    "sourceTimeframe": "M1",
                    "fromTime": m1_candles[1128]["time"],
                    "topPrice": round(m1_candles[1128]["high"] * 1.0002, decimals),
                    "bottomPrice": round(m1_candles[1128]["high"] * 0.9998, decimals),
                    "candleCount": 15  # Spans M1 1128 to 1142
                },
                # Block 4: POI Infinite (Originates at M1 LL4 level when downtrend continuation breaks through LL4 at candle 1179)
                {
                    "id": f"m1-{pair_slug}-poi-infinite",
                    "type": "poi",
                    "color": "#0d9488",
                    "element": "M1 Market Structure POI (Infinite)",
                    "displayName": "M1 - POI (Infinite)",
                    "description": "M1 - POI (Infinite)",
                    "timeframe": "M1",
                    "sourceTimeframe": "M1",
                    "fromTime": m1_candles[1179]["time"],
                    "topPrice": round(m1_ll4["low"] * 1.0002, decimals),
                    "bottomPrice": round(m1_ll4["low"] * 0.9998, decimals),
                    "isInfinite": True
                },
                # Block 5: Imbalance (Textbook 3-candle Fair Value Gap at M1 1130..1132)
                {
                    "id": f"m1-{pair_slug}-imbalance",
                    "type": "poi",
                    "color": "#0284c7",
                    "element": "M1 Market Structure Imbalance",
                    "displayName": "M1 - Imbalance",
                    "description": "M1 - Imbalance",
                    "timeframe": "M1",
                    "sourceTimeframe": "M1",
                    "fromTime": m1_candles[1131]["time"],
                    "topPrice": round(m1_candles[1132]["low"], decimals),
                    "bottomPrice": round(m1_candles[1130]["high"], decimals),
                    "candleCount": 4
                },
                # Pibonacci for POI Wave (Leg 3: HL2 -> HH3)
                {
                    "id": f"m1-{pair_slug}-pibo-leg3",
                    "type": "pibo",
                    "color": "#38bdf8",
                    "lineColor": "#38bdf8",
                    "zoneColor": "#ef4444",
                    "element": "M1 Market Structure Pibo Leg 3 (0.618-0.8)",
                    "displayName": "M1 Pibo Leg 3 (0.618 - 0.8)",
                    "description": "M1 Fibonacci Retracement on POI leg HL2 -> HH3",
                    "timeframe": "M1",
                    "sourceTimeframe": "M1",
                    "fromTime": m1_hl2["time"],
                    "toTime": m1_hh3["time"],
                    "fromPrice": round(m1_hl2["low"], decimals),
                    "toPrice": round(m1_hh3["high"], decimals),
                    "startLevel": 0,
                    "endLevel": 1,
                    "zones": [
                        {
                            "fromLevel": 0.618,
                            "toLevel": 0.8,
                            "color": "#ef4444"
                        }
                    ]
                },
                # Pibonacci for POI Wave (Leg 6: LH5 -> LL6)
                {
                    "id": f"m1-{pair_slug}-pibo-leg6",
                    "type": "pibo",
                    "color": "#fb7185",
                    "lineColor": "#fb7185",
                    "zoneColor": "#ef4444",
                    "element": "M1 Market Structure Pibo Leg 6 (0.618-0.8)",
                    "displayName": "M1 Pibo Leg 6 (0.618 - 0.8)",
                    "description": "M1 Fibonacci Retracement on POI leg LH5 -> LL6",
                    "timeframe": "M1",
                    "sourceTimeframe": "M1",
                    "fromTime": m1_lh5["time"],
                    "toTime": m1_ll6["time"],
                    "fromPrice": round(m1_lh5["high"], decimals),
                    "toPrice": round(m1_ll6["low"], decimals),
                    "startLevel": 0,
                    "endLevel": 1,
                    "zones": [
                        {
                            "fromLevel": 0.618,
                            "toLevel": 0.8,
                            "color": "#ef4444"
                        }
                    ]
                }
            ]
        }
    }

    timeframe_units = {
        "M5": 300,
        "M2": 120,
        "M1": 60
    }

    res = {
        "symbol": pair_name,
        "title": title or f"{pair_name} Multi-Timeframe Market Structure & POI / Key Levels",
        "description": "M5/M2/M1 Hierarchical Market Structure with POI, Key Level, and Imbalance blocks.",
        "timeframeUnits": timeframe_units,
        "timeframes": timeframes_dict
    }
    if group:
        res["group"] = group
    return res


def save_test_dataset(data: Dict[str, Any], output_dir: str):
    """Saves ONLY compressed .json.gz files (no raw .json files generated)."""
    os.makedirs(output_dir, exist_ok=True)
    symbol_slug = data["symbol"].replace("/", "_")

    json_filename = f"{symbol_slug}_test_data.json"
    gz_filename = f"{symbol_slug}_test_data.json.gz"

    json_path = os.path.join(output_dir, json_filename)
    gz_path = os.path.join(output_dir, gz_filename)

    # Clean up old raw uncompressed .json if present
    if os.path.exists(json_path):
        try:
            os.remove(json_path)
        except OSError:
            pass

    json_bytes = json.dumps(data, indent=2).encode("utf-8")
    with gzip.open(gz_path, "wb", compresslevel=9) as gz_f:
        gz_f.write(json_bytes)

    gz_size = os.path.getsize(gz_path) / 1024.0
    orig_size = len(json_bytes) / 1024.0
    ratio = (1.0 - (gz_size / orig_size)) * 100.0

    print(f"Generated: {data['symbol']}")
    print(f"   -> GZIP ONLY: {gz_filename} ({gz_size:.1f} KB, -{ratio:.1f}% compression)")


def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    cases_config = [
        {
            "pair": "EUR/USD",
            "price": 1.08200,
            "vol": 0.00030,
            "title": "Asian Liquidity Sweep & London Expansion",
            "group": "Forex Majors"
        },
        {
            "pair": "GBP/USD",
            "price": 1.26500,
            "vol": 0.00035,
            "title": "Marubozu Key Level Breakout & Retest",
            "group": "Forex Majors"
        },
        {
            "pair": "USD/JPY",
            "price": 154.20,
            "vol": 0.05,
            "title": "Order Block Mitigation & Trend Continuation",
            "group": None # Case with no group
        },
        {
            "pair": "XAU/USD",
            "price": 2650.00,
            "vol": 1.2,
            "title": "High Volatility FVG Imbalance Fill",
            "group": "Commodities & Metals"
        },
    ]

    print("=" * 70)
    print("Forex Multi-Timeframe M5 / M2 / M1 Hierarchical Market Structure")
    print("5 Blocks per Timeframe: KL (Finite/Infinite), POI (Finite/Infinite), Imbalance (FVG)")
    print("Breakout with 2 Consecutive Marubozu Candles at Key Levels")
    print("Smaller Timeframes strictly in LATEST Pulse Wave / Pullback")
    print("=" * 70)

    for item in cases_config:
        dataset = create_forex_dataset(
            item["pair"],
            item["price"],
            item["vol"],
            title=item["title"],
            group=item["group"]
        )
        save_test_dataset(dataset, root_dir)

    print("\n" + "=" * 70)
    print("All test dataset files successfully updated in test_data/!")
    print("=" * 70)


if __name__ == "__main__":
    main()
