import { type Candle, type PriceOption, type Drawing } from '../types/chart.js';
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

export interface ResolveZoneParams {
  fromTime?: number | string;
  toTime?: number | string;
  fromCandleIndex?: number;
  toCandleIndex?: number;
  topPrice?: number;
  bottomPrice?: number;
  paddingRatio?: number;
  paddingPrice?: number;
  sourceTimeframe?: string;
  targetTimeframe: string;
  targetCandles: Candle[];
  customUnits?: Record<string, number>;
}

export interface ResolvedZoneBounds {
  startTime: number;
  endTime: number;
  startCandle: Candle;
  endCandle: Candle;
  highestPrice: number;
  lowestPrice: number;
  boxTopPrice: number;
  boxBottomPrice: number;
  padding: number;
  overlappingCandles: Candle[];
}

export function resolveZoneBounds({
  fromTime,
  toTime,
  fromCandleIndex,
  toCandleIndex,
  topPrice,
  bottomPrice,
  paddingRatio,
  paddingPrice,
  sourceTimeframe,
  targetTimeframe,
  targetCandles,
  customUnits,
}: ResolveZoneParams): ResolvedZoneBounds | null {
  if (targetCandles.length === 0) return null;

  const srcTf = sourceTimeframe || targetTimeframe;
  if (!canInheritTimeframe(srcTf, targetTimeframe, customUnits)) {
    return null;
  }

  const srcDuration = parseTimeframeDuration(srcTf, customUnits);
  const targetDuration = parseTimeframeDuration(targetTimeframe, customUnits);

  let rawStartTime: number | undefined;
  let rawEndTime: number | undefined;

  if (fromTime !== undefined) {
    rawStartTime =
      typeof fromTime === 'number' ? fromTime : normalizeTimestamp(fromTime);
  }
  if (toTime !== undefined) {
    rawEndTime =
      typeof toTime === 'number' ? toTime : normalizeTimestamp(toTime);
  }

  if (rawStartTime === undefined && fromCandleIndex !== undefined) {
    const c = targetCandles[fromCandleIndex];
    if (c) rawStartTime = c.time;
  }
  if (rawEndTime === undefined && toCandleIndex !== undefined) {
    const c = targetCandles[toCandleIndex];
    if (c) rawEndTime = c.time;
  }

  if (rawStartTime === undefined && rawEndTime === undefined) {
    return null;
  }

  if (rawStartTime === undefined) {
    rawStartTime = rawEndTime!;
  }
  if (rawEndTime === undefined) {
    rawEndTime = rawStartTime;
  }

  const minTime = Math.min(rawStartTime, rawEndTime);
  const maxTime = Math.max(rawStartTime, rawEndTime);

  const windowStart = minTime;
  const windowEnd = maxTime + srcDuration;

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

  let highestHigh = overlappingCandles[0]!.high;
  let lowestLow = overlappingCandles[0]!.low;

  for (let i = 1; i < overlappingCandles.length; i++) {
    const c = overlappingCandles[i]!;
    if (c.high > highestHigh) highestHigh = c.high;
    if (c.low < lowestLow) lowestLow = c.low;
  }

  if (topPrice !== undefined) {
    highestHigh = topPrice;
  }
  if (bottomPrice !== undefined) {
    lowestLow = bottomPrice;
  }

  const priceSpan = Math.max(0, highestHigh - lowestLow);
  const defaultPaddingRatio = 0.05;
  const effectiveRatio =
    paddingRatio !== undefined ? paddingRatio : defaultPaddingRatio;

  const pad =
    paddingPrice !== undefined
      ? paddingPrice
      : priceSpan > 0
        ? priceSpan * effectiveRatio
        : highestHigh > 0
          ? highestHigh * 0.001
          : 0.0001;

  const boxTopPrice = highestHigh + pad;
  const boxBottomPrice = lowestLow - pad;

  const startCandle = overlappingCandles[0]!;
  const endCandle = overlappingCandles[overlappingCandles.length - 1]!;

  return {
    startTime: startCandle.time,
    endTime: endCandle.time,
    startCandle,
    endCandle,
    highestPrice: highestHigh,
    lowestPrice: lowestLow,
    boxTopPrice,
    boxBottomPrice,
    padding: pad,
    overlappingCandles,
  };
}

export function canInheritDrawing(
  drawing: Drawing,
  targetTf: string,
  customUnits?: Record<string, number>,
): boolean {
  if (!drawing.sourceTimeframe) return true;
  return canInheritTimeframe(drawing.sourceTimeframe, targetTf, customUnits);
}

export interface ResolvePoiParams {
  fromTime?: number | string;
  fromCandleIndex?: number;
  topPrice: number;
  bottomPrice: number;
  isInfinite?: boolean;
  mode?: 'infinite' | 'finite';
  candleCount?: number;
  targetCandleCount?: number;
  sourceTimeframe?: string;
  targetTimeframe: string;
  targetCandles: Candle[];
  customUnits?: Record<string, number>;
}

export type ResolveKeyLevelParams = ResolvePoiParams;

export interface ResolvedPoiBounds {
  startTime: number;
  endTime?: number;
  startCandle: Candle;
  endCandle?: Candle;
  isInfinite: boolean;
  candleCount?: number;
  effectiveCandleCount?: number;
  topPrice: number;
  bottomPrice: number;
  midPrice: number;
  sourceTimeframe: string;
  targetTimeframe: string;
}

export type ResolvedKeyLevelBounds = ResolvedPoiBounds;

export function resolvePoiBounds({
  fromTime,
  fromCandleIndex,
  topPrice,
  bottomPrice,
  isInfinite,
  mode,
  candleCount,
  targetCandleCount,
  sourceTimeframe,
  targetTimeframe,
  targetCandles,
  customUnits,
}: ResolvePoiParams): ResolvedPoiBounds | null {
  if (targetCandles.length === 0) return null;

  const srcTf = sourceTimeframe || targetTimeframe;
  if (!canInheritTimeframe(srcTf, targetTimeframe, customUnits)) {
    return null;
  }

  const srcDuration = parseTimeframeDuration(srcTf, customUnits);
  const targetDuration = parseTimeframeDuration(targetTimeframe, customUnits);

  let rawStartTime: number | undefined;
  if (fromTime !== undefined) {
    rawStartTime =
      typeof fromTime === 'number' ? fromTime : normalizeTimestamp(fromTime);
  }
  if (rawStartTime === undefined && fromCandleIndex !== undefined) {
    const c = targetCandles[fromCandleIndex];
    if (c) rawStartTime = c.time;
  }
  if (rawStartTime === undefined) {
    rawStartTime = targetCandles[0]?.time;
  }
  if (rawStartTime === undefined) return null;

  let startCandle: Candle | null = null;
  if (rawStartTime <= targetCandles[0]!.time) {
    startCandle = targetCandles[0]!;
  } else if (rawStartTime >= targetCandles[targetCandles.length - 1]!.time) {
    startCandle = targetCandles[targetCandles.length - 1]!;
  } else {
    for (let i = 0; i < targetCandles.length; i++) {
      const c = targetCandles[i]!;
      if (rawStartTime >= c.time && rawStartTime < c.time + targetDuration) {
        startCandle = c;
        break;
      }
    }
    if (!startCandle) {
      startCandle = findClosestCandle(rawStartTime, targetCandles);
    }
  }

  if (!startCandle) return null;

  const resolvedTop = Math.max(topPrice, bottomPrice);
  const resolvedBottom = Math.min(topPrice, bottomPrice);
  const midPrice = (resolvedTop + resolvedBottom) / 2;

  const count = candleCount ?? targetCandleCount;
  const resolvedIsInfinite =
    mode === 'infinite' ||
    isInfinite === true ||
    (mode !== 'finite' && isInfinite !== false && count === undefined);

  if (resolvedIsInfinite) {
    return {
      startTime: startCandle.time,
      startCandle,
      isInfinite: true,
      topPrice: resolvedTop,
      bottomPrice: resolvedBottom,
      midPrice,
      sourceTimeframe: srcTf,
      targetTimeframe,
    };
  }

  const effectiveCount = count && count > 0 ? count : 1;
  const totalDuration = effectiveCount * srcDuration;
  const effectiveCandleCount = totalDuration / targetDuration;
  const endTime = startCandle.time + totalDuration;

  let endCandle: Candle | undefined;
  if (endTime >= targetCandles[targetCandles.length - 1]!.time) {
    endCandle = targetCandles[targetCandles.length - 1]!;
  } else {
    for (let i = targetCandles.length - 1; i >= 0; i--) {
      const c = targetCandles[i]!;
      if (c.time <= endTime) {
        endCandle = c;
        break;
      }
    }
    if (!endCandle) {
      endCandle = findClosestCandle(endTime, targetCandles) ?? undefined;
    }
  }

  return {
    startTime: startCandle.time,
    endTime,
    startCandle,
    endCandle,
    isInfinite: false,
    candleCount: effectiveCount,
    effectiveCandleCount,
    topPrice: resolvedTop,
    bottomPrice: resolvedBottom,
    midPrice,
    sourceTimeframe: srcTf,
    targetTimeframe,
  };
}

export const resolveKeyLevelBounds = resolvePoiBounds;
