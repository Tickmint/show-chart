import { ISeriesApi, ITimeScaleApi, Time } from 'lightweight-charts';
import { Candle, LineDrawing, PriceOption } from '../types/chart';
import { normalizeTimestamp } from './fileParser';

/**
 * Finds the candle that best matches the timestamp or candle index
 */
export function findMatchingCandle(
  timeVal: number | string | undefined,
  candleIndex: number | undefined,
  candles: Candle[]
): Candle | null {
  if (candles.length === 0) return null;

  // 1. By index
  if (candleIndex !== undefined && candleIndex >= 0 && candleIndex < candles.length) {
    return candles[candleIndex];
  }

  // 2. By timestamp
  if (timeVal !== undefined) {
    const timeNum = typeof timeVal === 'number' ? timeVal : normalizeTimestamp(timeVal);

    // Exact check / bounds
    if (timeNum <= candles[0].time) return candles[0];
    if (timeNum >= candles[candles.length - 1].time) return candles[candles.length - 1];

    // Binary search closest candle
    let low = 0;
    let high = candles.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (candles[mid].time < timeNum) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx = Math.min(candles.length - 1, Math.max(0, low));
    const prevIdx = Math.max(0, idx - 1);
    const diff1 = Math.abs(candles[prevIdx].time - timeNum);
    const diff2 = Math.abs(candles[idx].time - timeNum);

    return diff1 < diff2 ? candles[prevIdx] : candles[idx];
  }

  return null;
}

/**
 * Render Straight Line:
 * Đường thẳng chỉ có 2 chiều: Tăng hoặc Giảm.
 * - Chiều tăng ('up'): Nối từ đáy (Low) của cây nến đầu tiên đến đỉnh (High) của cây nến cuối cùng.
 * - Chiều giảm ('down'): Nối từ đỉnh (High) của cây nến đầu tiên đến đáy (Low) của cây nến cuối cùng.
 * Co giãn chính xác theo thứ tự nến khi sang các khung thời gian khác nhau (TradingView style).
 */
export function renderLine(
  ctx: CanvasRenderingContext2D,
  drawing: LineDrawing,
  candles: Candle[],
  timeScale: ITimeScaleApi<Time>,
  series: ISeriesApi<'Candlestick'>,
  isHovered: boolean
): void {
  const c1 = findMatchingCandle(drawing.fromTime, drawing.fromCandleIndex, candles);
  const c2 = findMatchingCandle(drawing.toTime, drawing.toCandleIndex, candles);

  if (!c1 || !c2) return;

  // Xác định thứ tự thời gian: cây nến đầu tiên và cây nến cuối cùng
  const isC1First = c1.time <= c2.time;
  const firstCandle = isC1First ? c1 : c2;
  const lastCandle = isC1First ? c2 : c1;

  // Xác định chiều tăng hay giảm:
  // - 'up': Chiều tăng -> Nối từ đáy (Low) nến đầu đến đỉnh (High) nến cuối
  // - 'down': Chiều giảm -> Nối từ đỉnh (High) nến đầu đến đáy (Low) nến cuối
  const isUp = drawing.direction === 'up' || (!drawing.direction && drawing.fromPrice === 'low');

  const firstPrice = isUp ? firstCandle.low : firstCandle.high;
  const lastPrice = isUp ? lastCandle.high : lastCandle.low;

  const x1 = timeScale.timeToCoordinate(firstCandle.time as Time);
  const y1 = series.priceToCoordinate(firstPrice);
  const x2 = timeScale.timeToCoordinate(lastCandle.time as Time);
  const y2 = series.priceToCoordinate(lastPrice);

  if (x1 === null || y1 === null || x2 === null || y2 === null) return;

  ctx.save();
  ctx.strokeStyle = isHovered ? '#ffffff' : drawing.color;
  ctx.lineWidth = isHovered ? (drawing.lineWidth ?? 2) + 1.5 : (drawing.lineWidth ?? 2);
  ctx.setLineDash([]); // Luôn là nét liền

  // Vẽ chính xác đoạn thẳng từ nến đầu đến nến cuối
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Điểm neo tròn ở 2 đầu nến
  ctx.fillStyle = isHovered ? '#ffffff' : drawing.color;
  ctx.beginPath();
  ctx.arc(x1, y1, 3.5, 0, Math.PI * 2);
  ctx.arc(x2, y2, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
