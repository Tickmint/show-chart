import { type Candle, type PriceOption } from '../types/chart.js';
import { normalizeTimestamp } from './fileParser.js';

export const DEFAULT_TIMEFRAME_UNITS: Record<string, number> = {
  MN1: 2592000,
  W1: 604800,
  D1: 86400,
  H12: 43200,
  H8: 28800,
  H6: 21600,
  H4: 14400,
  H2: 7200,
  H1: 3600,
  M30: 1800,
  M15: 900,
  M10: 600,
  M5: 300,
  M3: 180,
  M2: 120,
  M1: 60,
};

export function parseTimeframeDuration(
  tf: string | undefined,
  customUnits?: Record<string, number>,
): number {
  if (!tf) return 3600;
  const upper = tf.toUpperCase().trim();

  if (customUnits && typeof customUnits[upper] === 'number') {
    return customUnits[upper];
  }
  if (customUnits && typeof customUnits[tf] === 'number') {
    return customUnits[tf];
  }
  if (DEFAULT_TIMEFRAME_UNITS[upper]) {
    return DEFAULT_TIMEFRAME_UNITS[upper];
  }

  const match = upper.match(/^([A-Z]+)(\d+)$/);
  if (match && match[1] && match[2]) {
    const unit = match[1];
    const val = parseInt(match[2], 10);
    if (!isNaN(val)) {
      if (unit === 'M') return val * 60;
      if (unit === 'H') return val * 3600;
      if (unit === 'D') return val * 86400;
      if (unit === 'W') return val * 604800;
      if (unit === 'S') return val;
    }
  }

  return 3600;
}

export function getLargestTimeframe(
  timeframes: string[],
  customUnits?: Record<string, number>,
): string {
  if (timeframes.length === 0) return '';
  let largest = timeframes[0] || '';
  let maxDuration = -1;

  for (const tf of timeframes) {
    const duration = parseTimeframeDuration(tf, customUnits);
    if (duration > maxDuration) {
      maxDuration = duration;
      largest = tf;
    }
  }

  return largest;
}

export function canInheritTimeframe(
  sourceTf: string | undefined,
  targetTf: string,
  customUnits?: Record<string, number>,
): boolean {
  if (!sourceTf) return true;
  if (sourceTf === targetTf) return true;

  const sourceSec = parseTimeframeDuration(sourceTf, customUnits);
  const targetSec = parseTimeframeDuration(targetTf, customUnits);

  return sourceSec >= targetSec;
}

export function getTimeframeConversionRatio(
  fromTf: string,
  toTf: string,
  customUnits?: Record<string, number>,
): number | null {
  const fromSec = parseTimeframeDuration(fromTf, customUnits);
  const toSec = parseTimeframeDuration(toTf, customUnits);

  if (fromSec <= toSec) return null;
  return Number((fromSec / toSec).toFixed(4));
}

export interface ResolveAnchorParams {
  candleTime?: number | string;
  candleIndex?: number;
  sourceTimeframe?: string;
  targetTimeframe: string;
  priceType: PriceOption;
  targetCandles: Candle[];
  customUnits?: Record<string, number>;
}

function findFirstCandleIndexAtOrAfter(
  timeNum: number,
  candles: Candle[],
): number {
  let low = 0;
  let high = candles.length - 1;
  let ans = candles.length;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midC = candles[mid];
    if (midC && midC.time >= timeNum) {
      ans = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return ans;
}

export function resolveAnchorPoint({
  candleTime,
  candleIndex,
  sourceTimeframe,
  targetTimeframe,
  priceType,
  targetCandles,
  customUnits,
}: ResolveAnchorParams): { time: number; price: number } | null {
  if (targetCandles.length === 0) return null;

  const srcTf = sourceTimeframe || targetTimeframe;
  const isNative = srcTf === targetTimeframe;

  if (isNative && candleIndex !== undefined) {
    const targetCandle = targetCandles[candleIndex];
    if (targetCandle) {
      const price =
        priceType === 'high'
          ? targetCandle.high
          : priceType === 'low'
            ? targetCandle.low
            : typeof priceType === 'number'
              ? priceType
              : targetCandle.close;
      return { time: targetCandle.time, price };
    }
  }

  if (candleTime === undefined && candleIndex === undefined) {
    return null;
  }

  const timeNum =
    typeof candleTime === 'number'
      ? candleTime
      : candleTime !== undefined
        ? normalizeTimestamp(candleTime)
        : (targetCandles[0]?.time ?? 0);

  const srcDuration = parseTimeframeDuration(srcTf, customUnits);
  const targetDuration = parseTimeframeDuration(targetTimeframe, customUnits);

  if (srcDuration <= targetDuration) {
    const matched = findClosestCandle(timeNum, targetCandles);
    if (!matched) return null;
    const price =
      priceType === 'high'
        ? matched.high
        : priceType === 'low'
          ? matched.low
          : typeof priceType === 'number'
            ? priceType
            : matched.close;
    return { time: matched.time, price };
  }

  const windowStart = timeNum;
  const windowEnd = windowStart + srcDuration;

  const startIdx = Math.max(
    0,
    findFirstCandleIndexAtOrAfter(windowStart - targetDuration, targetCandles),
  );
  const overlappingCandles: Candle[] = [];

  for (let i = startIdx; i < targetCandles.length; i++) {
    const c = targetCandles[i];
    if (!c) continue;
    const cStart = c.time;
    const cEnd = cStart + targetDuration;

    if (cStart < windowEnd && cEnd > windowStart) {
      overlappingCandles.push(c);
    } else if (cStart >= windowEnd) {
      break;
    }
  }

  if (overlappingCandles.length === 0) {
    const matched = findClosestCandle(windowStart, targetCandles);
    if (!matched) return null;
    overlappingCandles.push(matched);
  }

  if (priceType === 'high') {
    let best = overlappingCandles[0];
    if (!best) return null;
    for (let i = 1; i < overlappingCandles.length; i++) {
      const curr = overlappingCandles[i];
      if (curr && curr.high > best.high) {
        best = curr;
      }
    }
    return { time: best.time, price: best.high };
  }

  if (priceType === 'low') {
    let best = overlappingCandles[0];
    if (!best) return null;
    for (let i = 1; i < overlappingCandles.length; i++) {
      const curr = overlappingCandles[i];
      if (curr && curr.low < best.low) {
        best = curr;
      }
    }
    return { time: best.time, price: best.low };
  }

  const targetPrice =
    typeof priceType === 'number'
      ? priceType
      : (overlappingCandles[0]?.close ?? 0);
  const firstCandle = overlappingCandles[0];
  if (!firstCandle) return null;

  return { time: firstCandle.time, price: targetPrice };
}

function findClosestCandle(timeNum: number, candles: Candle[]): Candle | null {
  if (candles.length === 0) return null;
  const first = candles[0];
  const last = candles[candles.length - 1];
  if (!first || !last) return null;

  if (timeNum <= first.time) return first;
  if (timeNum >= last.time) return last;

  let low = 0;
  let high = candles.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midCandle = candles[mid];
    if (midCandle && midCandle.time < timeNum) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const idx = Math.min(candles.length - 1, Math.max(0, low));
  const prevIdx = Math.max(0, idx - 1);
  const cPrev = candles[prevIdx];
  const cCurr = candles[idx];
  if (!cPrev || !cCurr) return cCurr ?? cPrev ?? null;

  const diff1 = Math.abs(cPrev.time - timeNum);
  const diff2 = Math.abs(cCurr.time - timeNum);
  return diff1 < diff2 ? cPrev : cCurr;
}
