import { ForexChartData, Candle, LineDrawing } from '../types/chart';

/**
 * Generates realistic base M15 candles with continuous price trend & waves
 */
function generateBaseM15Candles(
  startTime: number,
  count: number,
  startPrice: number,
  volatility: number
): Candle[] {
  const candles: Candle[] = [];
  let currentClose = startPrice;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * 900;
    // Macro wave + micro fluctuation
    const macroCycle = Math.sin(i / 160) * 0.0003 * startPrice;
    const mediumCycle = Math.cos(i / 35) * 0.00015 * startPrice;
    const randomStep = (Math.random() - 0.495) * volatility;
    const drift = macroCycle + mediumCycle + randomStep;

    const open = Number(currentClose.toFixed(5));
    const close = Number(Math.max(0.1, open + drift).toFixed(5));
    const wickHigh = Math.abs(Math.random() * volatility * 1.2);
    const wickLow = Math.abs(Math.random() * volatility * 1.2);
    const high = Number((Math.max(open, close) + wickHigh).toFixed(5));
    const low = Number((Math.min(open, close) - wickLow).toFixed(5));

    candles.push({ time, open, high, low, close });
    currentClose = close;
  }

  return candles;
}

/**
 * Aggregates smaller timeframe candles into larger timeframe candles (M15 -> H1 -> H4 -> D1)
 * This guarantees 100% price consistency across all timeframes!
 */
function aggregateCandles(baseCandles: Candle[], groupSize: number): Candle[] {
  const aggregated: Candle[] = [];
  for (let i = 0; i < baseCandles.length; i += groupSize) {
    const chunk = baseCandles.slice(i, i + groupSize);
    if (chunk.length === 0) continue;

    const time = chunk[0].time;
    const open = chunk[0].open;
    let high = chunk[0].high;
    let low = chunk[0].low;
    const close = chunk[chunk.length - 1].close;

    for (let j = 1; j < chunk.length; j++) {
      if (chunk[j].high > high) high = chunk[j].high;
      if (chunk[j].low < low) low = chunk[j].low;
    }

    aggregated.push({
      time,
      open: Number(open.toFixed(5)),
      high: Number(high.toFixed(5)),
      low: Number(low.toFixed(5)),
      close: Number(close.toFixed(5)),
    });
  }
  return aggregated;
}

/**
 * Finds local swing lows (troughs) where candle low is lower than neighboring wicks
 */
function findSwingLows(candles: Candle[], windowSize = 4): number[] {
  const lows: number[] = [];
  for (let i = windowSize; i < candles.length - windowSize; i++) {
    let isMin = true;
    for (let w = 1; w <= windowSize; w++) {
      if (candles[i].low >= candles[i - w].low || candles[i].low >= candles[i + w].low) {
        isMin = false;
        break;
      }
    }
    if (isMin) lows.push(i);
  }
  return lows;
}

/**
 * Finds local swing highs (peaks) where candle high is higher than neighboring wicks
 */
function findSwingHighs(candles: Candle[], windowSize = 4): number[] {
  const highs: number[] = [];
  for (let i = windowSize; i < candles.length - windowSize; i++) {
    let isMax = true;
    for (let w = 1; w <= windowSize; w++) {
      if (candles[i].high <= candles[i - w].high || candles[i].high <= candles[i + w].high) {
        isMax = false;
        break;
      }
    }
    if (isMax) highs.push(i);
  }
  return highs;
}

export function getSampleForexData(): ForexChartData {
  const now = Math.floor(Date.now() / 1000);
  const totalM15 = 1600; // 1600 * 15m = 400 hours (~16.6 days)
  const startTime = now - totalM15 * 900;

  // 1. Generate base M15 candles
  const m15Candles = generateBaseM15Candles(startTime, totalM15, 1.0820, 0.00065);

  // 2. Aggregate to H1 (every 4 M15 candles)
  const h1Candles = aggregateCandles(m15Candles, 4); // 400 candles

  // 3. Aggregate to H4 (every 4 H1 candles = 16 M15 candles)
  const h4Candles = aggregateCandles(h1Candles, 4); // 100 candles

  // 4. Aggregate to D1 (every 6 H4 candles = 24 hours)
  const d1Candles = aggregateCandles(h4Candles, 6); // ~16 candles

  // 5. Detect real swing points on H4
  const h4Lows = findSwingLows(h4Candles, 3);
  const h4Highs = findSwingHighs(h4Candles, 3);

  // Pick actual swing low points that touch candle wicks
  const lowIdx1 = h4Lows.length > 1 ? h4Lows[1] : 15;
  const lowIdx2 = h4Lows.length > 3 ? h4Lows[h4Lows.length - 2] : 65;

  const highIdx1 = h4Highs.length > 1 ? h4Highs[1] : 25;
  const highIdx2 = h4Highs.length > 3 ? h4Highs[h4Highs.length - 2] : 75;

  const cLow1 = h4Candles[lowIdx1];
  const cLow2 = h4Candles[lowIdx2];
  const cHigh1 = h4Candles[highIdx1];
  const cHigh2 = h4Candles[highIdx2];

  // 6. Detect real swing points on H1
  const h1Lows = findSwingLows(h1Candles, 4);
  const h1Highs = findSwingHighs(h1Candles, 4);
  const h1LowIdx1 = h1Lows.length > 2 ? h1Lows[2] : 40;
  const h1HighIdx1 = h1Highs.length > 2 ? h1Highs[2] : 60;
  const h1LowIdx2 = h1Lows.length > 5 ? h1Lows[5] : 120;
  const h1CLow1 = h1Candles[h1LowIdx1];
  const h1CHigh1 = h1Candles[h1HighIdx1];
  const h1CLow2 = h1Candles[h1LowIdx2];

  // 7. Detect real swing points on M15
  const m15Lows = findSwingLows(m15Candles, 6);
  const m15Highs = findSwingHighs(m15Candles, 6);
  const m15LowIdx1 = m15Lows.length > 3 ? m15Lows[m15Lows.length - 4] : 1100;
  const m15HighIdx2 = m15Highs.length > 1 ? m15Highs[m15Highs.length - 2] : 1450;
  const m15CLow1 = m15Candles[m15LowIdx1];
  const m15CHigh2 = m15Candles[m15HighIdx2];

  // =========================================================================
  // COMMON DRAWINGS (Hình vẽ chung - đặt bên ngoài timeframes)
  // Chỉ có 2 chiều: Tăng ('up') hoặc Giảm ('down')
  // - Chiều tăng: đáy nến đầu (Low) -> đỉnh nến cuối (High)
  // - Chiều giảm: đỉnh nến đầu (High) -> đáy nến cuối (Low)
  // =========================================================================
  const commonDrawings: LineDrawing[] = [
    {
      id: "common-swing-up",
      type: "line",
      direction: "up", // Chiều tăng: Đáy nến 1 -> Đỉnh nến 2
      color: "#10b981",
      fromTime: cLow1.time,
      toTime: cHigh1.time,
      lineWidth: 2,
      stretch: true,
      description: "Bullish line from candle 1 Low to candle 2 High."
    },
    {
      id: "common-swing-down",
      type: "line",
      direction: "down", // Chiều giảm: Đỉnh nến 1 -> Đáy nến 2
      color: "#ef4444",
      fromTime: cHigh1.time,
      toTime: cLow2.time,
      lineWidth: 2,
      stretch: true,
      description: "Bearish line from candle 1 High to candle 2 Low."
    }
  ];

  return {
    symbol: "EUR/USD",
    title: "EUR/USD Multi-Timeframe Line Structure",
    description: "Directional lines (Up: Low->High, Down: High->Low) stretching cleanly across H4, H1, M15 like TradingView.",
    commonDrawings,
    timeframes: {
      "H4": {
        candles: h4Candles,
        drawings: [
          {
            id: "h4-swing-up",
            type: "line",
            direction: "up",
            color: "#38bdf8",
            fromTime: cLow1.time,
            toTime: cHigh2.time,
            lineWidth: 2,
            stretch: true,
            description: "H4 Bullish line (candle 1 Low -> candle 2 High), stretches across H1 & M15."
          }
        ]
      },

      "H1": {
        candles: h1Candles,
        drawings: [
          {
            id: "h1-intraday-down",
            type: "line",
            direction: "down",
            color: "#eab308",
            fromTime: h1CHigh1.time,
            toTime: h1CLow2.time,
            lineWidth: 2,
            stretch: true,
            description: "H1 Bearish line (candle 1 High -> candle 2 Low)."
          }
        ]
      },

      "M15": {
        candles: m15Candles,
        drawings: [
          {
            id: "m15-scalp-up",
            type: "line",
            direction: "up",
            color: "#a855f7",
            fromTime: m15CLow1.time,
            toTime: m15CHigh2.time,
            lineWidth: 2,
            stretch: false,
            description: "M15 Scalp Bullish line (candle 1 Low -> candle 2 High)."
          }
        ]
      },

      "D1": {
        candles: d1Candles,
        drawings: []
      }
    },
    defaultTimeframe: "H4"
  };
}
