import {
  type ForexChartData,
  type Candle,
  type LineDrawing,
} from '../types/chart.js';

function generateBaseM15Candles(
  startTime: number,
  count: number,
  startPrice: number,
  volatility: number,
): Candle[] {
  const candles: Candle[] = [];
  let currentClose = startPrice;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * 900;

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

function aggregateCandles(baseCandles: Candle[], groupSize: number): Candle[] {
  const aggregated: Candle[] = [];
  for (let i = 0; i < baseCandles.length; i += groupSize) {
    const chunk = baseCandles.slice(i, i + groupSize);
    if (chunk.length === 0) continue;

    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    if (!first || !last) continue;

    const time = first.time;
    const open = first.open;
    let high = first.high;
    let low = first.low;
    const close = last.close;

    for (let j = 1; j < chunk.length; j++) {
      const item = chunk[j];
      if (item && item.high > high) high = item.high;
      if (item && item.low < low) low = item.low;
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

function findSwingLows(candles: Candle[], windowSize = 4): number[] {
  const lows: number[] = [];
  for (let i = windowSize; i < candles.length - windowSize; i++) {
    const curr = candles[i];
    if (!curr) continue;
    let isMin = true;
    for (let w = 1; w <= windowSize; w++) {
      const prev = candles[i - w];
      const next = candles[i + w];
      if ((prev && curr.low >= prev.low) || (next && curr.low >= next.low)) {
        isMin = false;
        break;
      }
    }
    if (isMin) lows.push(i);
  }
  return lows;
}

function findSwingHighs(candles: Candle[], windowSize = 4): number[] {
  const highs: number[] = [];
  for (let i = windowSize; i < candles.length - windowSize; i++) {
    const curr = candles[i];
    if (!curr) continue;
    let isMax = true;
    for (let w = 1; w <= windowSize; w++) {
      const prev = candles[i - w];
      const next = candles[i + w];
      if (
        (prev && curr.high <= prev.high) ||
        (next && curr.high <= next.high)
      ) {
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
  const totalM15 = 1600;
  const startTime = now - totalM15 * 900;

  const m15Candles = generateBaseM15Candles(
    startTime,
    totalM15,
    1.082,
    0.00065,
  );

  const h1Candles = aggregateCandles(m15Candles, 4);
  const h4Candles = aggregateCandles(h1Candles, 4);
  const d1Candles = aggregateCandles(h4Candles, 6);

  const d1Lows = findSwingLows(d1Candles, 2);
  const d1Highs = findSwingHighs(d1Candles, 2);
  const d1Low1 = d1Candles[d1Lows[0] ?? 2] ?? d1Candles[0];
  const d1High1 = d1Candles[d1Highs[0] ?? 5] ?? d1Candles[0];
  const d1Low2 = d1Candles[d1Lows[1] ?? 8] ?? d1Candles[0];

  const h4Lows = findSwingLows(h4Candles, 3);
  const h4Highs = findSwingHighs(h4Candles, 3);
  const h4Low1 = h4Candles[h4Lows[1] ?? 12] ?? h4Candles[0];
  const h4High1 = h4Candles[h4Highs[1] ?? 24] ?? h4Candles[0];
  const h4Low2 = h4Candles[h4Lows[2] ?? 36] ?? h4Candles[0];
  const h4High2 = h4Candles[h4Highs[2] ?? 48] ?? h4Candles[0];

  const h1Lows = findSwingLows(h1Candles, 4);
  const h1Highs = findSwingHighs(h1Candles, 4);
  const h1High1 = h1Candles[h1Highs[1] ?? 30] ?? h1Candles[0];
  const h1Low1 = h1Candles[h1Lows[2] ?? 50] ?? h1Candles[0];
  const h1High2 = h1Candles[h1Highs[2] ?? 70] ?? h1Candles[0];
  const h1Low2 = h1Candles[h1Lows[3] ?? 90] ?? h1Candles[0];

  const m15Lows = findSwingLows(m15Candles, 6);
  const m15Highs = findSwingHighs(m15Candles, 6);
  const m15Low1 =
    m15Candles[m15Lows[m15Lows.length - 4] ?? 1400] ?? m15Candles[0];
  const m15High1 =
    m15Candles[m15Highs[m15Highs.length - 3] ?? 1450] ?? m15Candles[0];
  const m15Low2 =
    m15Candles[m15Lows[m15Lows.length - 2] ?? 1500] ?? m15Candles[0];
  const m15High2 =
    m15Candles[m15Highs[m15Highs.length - 1] ?? 1550] ?? m15Candles[0];

  const d1Drawings: LineDrawing[] =
    d1Low1 && d1High1 && d1Low2
      ? [
          {
            id: 'd1-ms-leg1',
            type: 'line',
            direction: 'up',
            color: '#10b981',
            element: 'D1 Bullish Market Structure (HH/HL)',
            fromTime: d1Low1.time,
            toTime: d1High1.time,
            lineWidth: 2.5,
            stretch: true,
            sourceTimeframe: 'D1',
            description: 'D1 Higher Low (HL) to Higher High (HH)',
          },
          {
            id: 'd1-ms-leg2',
            type: 'line',
            direction: 'down',
            color: '#f59e0b',
            element: 'D1 Bullish Market Structure (HH/HL)',
            fromTime: d1High1.time,
            toTime: d1Low2.time,
            lineWidth: 2.5,
            stretch: true,
            sourceTimeframe: 'D1',
            description: 'D1 Higher High (HH) pullback to Higher Low (HL)',
          },
        ]
      : [];

  const h4Drawings: LineDrawing[] =
    h4Low1 && h4High1 && h4Low2 && h4High2
      ? [
          {
            id: 'h4-ms-leg1',
            type: 'line',
            direction: 'up',
            color: '#38bdf8',
            element: 'H4 Bullish Market Structure (HH/HL)',
            fromTime: h4Low1.time,
            toTime: h4High1.time,
            lineWidth: 2,
            stretch: true,
            sourceTimeframe: 'H4',
            description: 'H4 Higher Low to Higher High (HL1 -> HH1)',
          },
          {
            id: 'h4-ms-leg2',
            type: 'line',
            direction: 'down',
            color: '#fb7185',
            element: 'H4 Bullish Market Structure (HH/HL)',
            fromTime: h4High1.time,
            toTime: h4Low2.time,
            lineWidth: 2,
            stretch: true,
            sourceTimeframe: 'H4',
            description: 'H4 Higher High pullback to Higher Low (HH1 -> HL2)',
          },
          {
            id: 'h4-ms-leg3',
            type: 'line',
            direction: 'up',
            color: '#38bdf8',
            element: 'H4 Bullish Market Structure (HH/HL)',
            fromTime: h4Low2.time,
            toTime: h4High2.time,
            lineWidth: 2,
            stretch: true,
            sourceTimeframe: 'H4',
            description:
              'H4 Continuation Higher Low to Higher High (HL2 -> HH2)',
          },
        ]
      : [];

  const h1Drawings: LineDrawing[] =
    h1High1 && h1Low1 && h1High2 && h1Low2
      ? [
          {
            id: 'h1-ms-leg1',
            type: 'line',
            direction: 'down',
            color: '#ef4444',
            element: 'H1 Bearish Market Structure (LH/LL)',
            fromTime: h1High1.time,
            toTime: h1Low1.time,
            lineWidth: 2,
            stretch: true,
            sourceTimeframe: 'H1',
            description: 'H1 Lower High to Lower Low (LH1 -> LL1)',
          },
          {
            id: 'h1-ms-leg2',
            type: 'line',
            direction: 'up',
            color: '#fbbf24',
            element: 'H1 Bearish Market Structure (LH/LL)',
            fromTime: h1Low1.time,
            toTime: h1High2.time,
            lineWidth: 2,
            stretch: true,
            sourceTimeframe: 'H1',
            description: 'H1 Lower Low correction to Lower High (LL1 -> LH2)',
          },
          {
            id: 'h1-ms-leg3',
            type: 'line',
            direction: 'down',
            color: '#ef4444',
            element: 'H1 Bearish Market Structure (LH/LL)',
            fromTime: h1High2.time,
            toTime: h1Low2.time,
            lineWidth: 2,
            stretch: true,
            sourceTimeframe: 'H1',
            description: 'H1 Lower High continuation to Lower Low (LH2 -> LL2)',
          },
        ]
      : [];

  const m15Drawings: LineDrawing[] =
    m15Low1 && m15High1 && m15Low2 && m15High2
      ? [
          {
            id: 'm15-ms-leg1',
            type: 'line',
            direction: 'up',
            color: '#a855f7',
            element: 'M15 Scalp Structure (HH/HL)',
            fromTime: m15Low1.time,
            toTime: m15High1.time,
            lineWidth: 2,
            stretch: true,
            sourceTimeframe: 'M15',
            description: 'M15 Scalp HL -> HH',
          },
          {
            id: 'm15-ms-leg2',
            type: 'line',
            direction: 'down',
            color: '#c084fc',
            element: 'M15 Scalp Structure (HH/HL)',
            fromTime: m15High1.time,
            toTime: m15Low2.time,
            lineWidth: 2,
            stretch: true,
            sourceTimeframe: 'M15',
            description: 'M15 Scalp HH -> HL',
          },
          {
            id: 'm15-ms-leg3',
            type: 'line',
            direction: 'up',
            color: '#a855f7',
            element: 'M15 Scalp Structure (HH/HL)',
            fromTime: m15Low2.time,
            toTime: m15High2.time,
            lineWidth: 2,
            stretch: true,
            sourceTimeframe: 'M15',
            description: 'M15 Scalp HL -> HH',
          },
        ]
      : [];

  return {
    symbol: 'EUR/USD',
    title: 'EUR/USD Multi-Timeframe Market Structure',
    description:
      'Market Structure with 1-way downward inheritance (D1 -> H4 -> H1 -> M15) and wick-perfect snapping.',
    timeframeUnits: {
      D1: 86400,
      H4: 14400,
      H1: 3600,
      M15: 900,
      M5: 300,
      M2: 120,
      M1: 60,
    },
    timeframeConversions: [
      { from: 'D1', to: 'H4', ratio: 6 },
      { from: 'H4', to: 'H1', ratio: 4 },
      { from: 'H1', to: 'M15', ratio: 4 },
      { from: 'M15', to: 'M5', ratio: 3 },
      { from: 'M5', to: 'M2', ratio: 2.5 },
      { from: 'M2', to: 'M1', ratio: 2 },
    ],
    timeframes: {
      D1: {
        candles: d1Candles,
        drawings: d1Drawings,
      },
      H4: {
        candles: h4Candles,
        drawings: h4Drawings,
      },
      H1: {
        candles: h1Candles,
        drawings: h1Drawings,
      },
      M15: {
        candles: m15Candles,
        drawings: m15Drawings,
      },
    },
    defaultTimeframe: 'H4',
  };
}
