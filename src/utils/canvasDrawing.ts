import {
  type ISeriesApi,
  type ITimeScaleApi,
  type Time,
} from 'lightweight-charts';
import { type Candle, type LineDrawing } from '../types/chart.js';
import { resolveAnchorPoint } from './timeframeService.js';

interface AnchorPoint {
  time: number;
  price: number;
}

interface AnchorPair {
  pt1: AnchorPoint;
  pt2: AnchorPoint;
}

const anchorCache = new Map<string, AnchorPair>();

export function clearAnchorCache(): void {
  anchorCache.clear();
}

export function renderLine(
  ctx: CanvasRenderingContext2D,
  drawing: LineDrawing,
  candles: Candle[],
  timeScale: ITimeScaleApi<Time>,
  series: ISeriesApi<'Candlestick'>,
  isHovered: boolean,
  currentTimeframe?: string,
  timeframeUnits?: Record<string, number>,
): void {
  if (candles.length === 0) return;

  const srcTf = drawing.sourceTimeframe || currentTimeframe || 'H4';
  const targetTf = currentTimeframe || 'H4';

  const isUp =
    drawing.direction === 'up' ||
    (!drawing.direction && drawing.fromPrice === 'low');

  const firstPriceType = isUp
    ? (drawing.fromPrice ?? 'low')
    : (drawing.fromPrice ?? 'high');
  const lastPriceType = isUp
    ? (drawing.toPrice ?? 'high')
    : (drawing.toPrice ?? 'low');

  const cacheKey = `${drawing.id}_${srcTf}_${targetTf}_${candles.length}_${candles[0]?.time ?? 0}`;
  let anchors = anchorCache.get(cacheKey);

  if (!anchors) {
    const pt1 = resolveAnchorPoint({
      candleTime: drawing.fromTime,
      candleIndex: drawing.fromCandleIndex,
      sourceTimeframe: srcTf,
      targetTimeframe: targetTf,
      priceType: firstPriceType,
      targetCandles: candles,
      customUnits: timeframeUnits,
    });

    const pt2 = resolveAnchorPoint({
      candleTime: drawing.toTime,
      candleIndex: drawing.toCandleIndex,
      sourceTimeframe: srcTf,
      targetTimeframe: targetTf,
      priceType: lastPriceType,
      targetCandles: candles,
      customUnits: timeframeUnits,
    });

    if (!pt1 || !pt2) return;
    anchors = { pt1, pt2 };
    anchorCache.set(cacheKey, anchors);
  }

  const { pt1, pt2 } = anchors;

  const isPt1First = pt1.time <= pt2.time;
  const pStart = isPt1First ? pt1 : pt2;
  const pEnd = isPt1First ? pt2 : pt1;

  const x1 = timeScale.timeToCoordinate(pStart.time as Time);
  const y1 = series.priceToCoordinate(pStart.price);
  const x2 = timeScale.timeToCoordinate(pEnd.time as Time);
  const y2 = series.priceToCoordinate(pEnd.price);

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

  ctx.restore();
}
