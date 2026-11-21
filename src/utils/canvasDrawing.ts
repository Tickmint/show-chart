import {
  type ISeriesApi,
  type ITimeScaleApi,
  type Time,
} from 'lightweight-charts';
import { type Candle, type LineDrawing } from '../types/chart.js';
import { normalizeTimestamp } from './fileParser.js';

export function findMatchingCandle(
  timeVal: number | string | undefined,
  candleIndex: number | undefined,
  candles: Candle[],
): Candle | null {
  if (candles.length === 0) return null;

  const firstCandle = candles[0];
  const lastCandle = candles[candles.length - 1];
  if (!firstCandle || !lastCandle) return null;

  if (
    candleIndex !== undefined &&
    candleIndex >= 0 &&
    candleIndex < candles.length
  ) {
    return candles[candleIndex] ?? null;
  }

  if (timeVal !== undefined) {
    const timeNum =
      typeof timeVal === 'number' ? timeVal : normalizeTimestamp(timeVal);

    if (timeNum <= firstCandle.time) return firstCandle;
    if (timeNum >= lastCandle.time) return lastCandle;

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

  return null;
}

export function renderLine(
  ctx: CanvasRenderingContext2D,
  drawing: LineDrawing,
  candles: Candle[],
  timeScale: ITimeScaleApi<Time>,
  series: ISeriesApi<'Candlestick'>,
  isHovered: boolean,
): void {
  const c1 = findMatchingCandle(
    drawing.fromTime,
    drawing.fromCandleIndex,
    candles,
  );
  const c2 = findMatchingCandle(drawing.toTime, drawing.toCandleIndex, candles);

  if (!c1 || !c2) return;

  const isC1First = c1.time <= c2.time;
  const firstCandle = isC1First ? c1 : c2;
  const lastCandle = isC1First ? c2 : c1;

  const isUp =
    drawing.direction === 'up' ||
    (!drawing.direction && drawing.fromPrice === 'low');

  const firstPrice = isUp ? firstCandle.low : firstCandle.high;
  const lastPrice = isUp ? lastCandle.high : lastCandle.low;

  const x1 = timeScale.timeToCoordinate(firstCandle.time as Time);
  const y1 = series.priceToCoordinate(firstPrice);
  const x2 = timeScale.timeToCoordinate(lastCandle.time as Time);
  const y2 = series.priceToCoordinate(lastPrice);

  if (x1 === null || y1 === null || x2 === null || y2 === null) return;

  ctx.save();
  ctx.strokeStyle = isHovered ? '#ffffff' : drawing.color;
  ctx.lineWidth = isHovered
    ? (drawing.lineWidth ?? 2) + 1.5
    : (drawing.lineWidth ?? 2);
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.fillStyle = isHovered ? '#ffffff' : drawing.color;
  ctx.beginPath();
  ctx.arc(x1, y1, 3.5, 0, Math.PI * 2);
  ctx.arc(x2, y2, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
