import {
  type ISeriesApi,
  type ITimeScaleApi,
  type Time,
} from 'lightweight-charts';
import {
  type Candle,
  type LineDrawing,
  type ZoneDrawing,
} from '../types/chart.js';
import { type ThemeMode } from '../types/theme.js';
import { THEME_PALETTES, adaptColorForTheme } from './themeService.js';
import { resolveAnchorPoint, resolveZoneBounds } from './timeframeService.js';

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
  theme: ThemeMode = 'dark',
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

  const strokeColor = adaptColorForTheme(drawing.color, theme);
  const hoverColor = THEME_PALETTES[theme].canvas.lineHoverColor;

  ctx.save();
  ctx.strokeStyle = isHovered ? hoverColor : strokeColor;
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

export function colorWithAlpha(colorStr: string, alpha: number): string {
  if (!colorStr) return `rgba(14, 165, 233, ${alpha})`;
  const trimmed = colorStr.trim();
  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  if (trimmed.startsWith('rgba')) {
    return trimmed.replace(/[\d.]+\)$/g, `${alpha})`);
  }
  if (trimmed.startsWith('rgb')) {
    return trimmed.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }
  return trimmed;
}

export function renderZone(
  ctx: CanvasRenderingContext2D,
  drawing: ZoneDrawing,
  candles: Candle[],
  timeScale: ITimeScaleApi<Time>,
  series: ISeriesApi<'Candlestick'>,
  isHovered: boolean,
  currentTimeframe?: string,
  timeframeUnits?: Record<string, number>,
  theme: ThemeMode = 'dark',
): void {
  if (candles.length === 0) return;

  const targetTf = currentTimeframe || 'H4';
  const srcTf = drawing.sourceTimeframe || targetTf;

  const bounds = resolveZoneBounds({
    fromTime: drawing.fromTime,
    toTime: drawing.toTime,
    fromCandleIndex: drawing.fromCandleIndex,
    toCandleIndex: drawing.toCandleIndex,
    topPrice: drawing.topPrice,
    bottomPrice: drawing.bottomPrice,
    paddingRatio: drawing.paddingRatio,
    paddingPrice: drawing.paddingPrice,
    sourceTimeframe: srcTf,
    targetTimeframe: targetTf,
    targetCandles: candles,
    customUnits: timeframeUnits,
  });

  if (!bounds) return;

  const xStart = timeScale.timeToCoordinate(bounds.startCandle.time as Time);
  const xEnd = timeScale.timeToCoordinate(bounds.endCandle.time as Time);
  if (xStart === null || xEnd === null) return;

  let halfBar = 5.5;
  const startIdx = candles.findIndex((c) => c.time === bounds.startCandle.time);
  if (startIdx >= 0) {
    if (startIdx + 1 < candles.length) {
      const xNext = timeScale.timeToCoordinate(
        candles[startIdx + 1]!.time as Time,
      );
      if (xNext !== null) {
        halfBar = Math.abs(xNext - xStart) / 2;
      }
    } else if (startIdx - 1 >= 0) {
      const xPrev = timeScale.timeToCoordinate(
        candles[startIdx - 1]!.time as Time,
      );
      if (xPrev !== null) {
        halfBar = Math.abs(xStart - xPrev) / 2;
      }
    }
  }

  const xLeft = Math.min(xStart, xEnd) - halfBar;
  const xRight = Math.max(xStart, xEnd) + halfBar;
  const boxWidth = Math.max(1, xRight - xLeft);

  const yTop = series.priceToCoordinate(bounds.boxTopPrice);
  const yBottom = series.priceToCoordinate(bounds.boxBottomPrice);
  if (yTop === null || yBottom === null) return;

  const yMin = Math.min(yTop, yBottom);
  const yMax = Math.max(yTop, yBottom);
  const boxHeight = Math.max(1, yMax - yMin);

  ctx.save();

  const fillAlpha = isHovered ? 0.32 : 0.18;
  const baseColor = adaptColorForTheme(drawing.color, theme);
  const fillColor = drawing.fillColor
    ? adaptColorForTheme(drawing.fillColor, theme)
    : colorWithAlpha(baseColor, fillAlpha);
  ctx.fillStyle = fillColor;
  ctx.fillRect(xLeft, yMin, boxWidth, boxHeight);

  const baseBorderColor = drawing.borderColor
    ? adaptColorForTheme(drawing.borderColor, theme)
    : baseColor;
  const borderColor = isHovered
    ? THEME_PALETTES[theme].canvas.zoneHoverBorderColor
    : baseBorderColor;
  const borderWidth = isHovered
    ? (drawing.borderWidth ?? 1.5) + 1
    : (drawing.borderWidth ?? 1.5);
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = borderColor;

  if (drawing.borderStyle === 'dashed') {
    ctx.setLineDash([4, 4]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.strokeRect(xLeft, yMin, boxWidth, boxHeight);

  const yCandleHigh = series.priceToCoordinate(bounds.highestPrice);

  if (drawing.showLabel !== false) {
    const labelText =
      drawing.label || drawing.displayName || drawing.element || '';
    if (labelText.trim() !== '') {
      const fontSize = drawing.labelFontSize ?? 10;
      ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;

      const layout = computeZoneLabelLayout({
        text: labelText.trim(),
        boxX: xLeft,
        boxWidth,
        boxY: yMin,
        boxHeight,
        candleHighY: yCandleHigh,
        measureTextWidth: (str: string) => ctx.measureText(str).width,
        fontSize,
      });

      if (layout.visible) {
        ctx.save();
        ctx.setLineDash([]);

        ctx.fillStyle = THEME_PALETTES[theme].canvas.zoneLabelBg;
        const r = 3;
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(layout.x, layout.y, layout.width, layout.height, r);
          ctx.fill();
          ctx.strokeStyle = colorWithAlpha(
            baseBorderColor,
            THEME_PALETTES[theme].canvas.zoneLabelBorderAlpha,
          );
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
          ctx.strokeStyle = colorWithAlpha(
            baseBorderColor,
            THEME_PALETTES[theme].canvas.zoneLabelBorderAlpha,
          );
          ctx.lineWidth = 1;
          ctx.strokeRect(layout.x, layout.y, layout.width, layout.height);
        }

        const labelTextCol = drawing.labelColor
          ? adaptColorForTheme(drawing.labelColor, theme)
          : isHovered
            ? THEME_PALETTES[theme].canvas.zoneLabelHoverTextColor
            : THEME_PALETTES[theme].canvas.zoneLabelTextColor;

        ctx.fillStyle = labelTextCol;
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
        ctx.fillText(
          layout.displayText,
          layout.x + 4,
          layout.y + layout.height / 2,
        );
        ctx.restore();
      }
    }
  }

  ctx.restore();
}

export interface ComputeLabelParams {
  text: string;
  boxX: number;
  boxWidth: number;
  boxY: number;
  boxHeight?: number;
  candleHighY: number | null;
  measureTextWidth: (str: string) => number;
  fontSize?: number;
  paddingX?: number;
  paddingY?: number;
  minBoxWidth?: number;
}

export interface ZoneLabelLayout {
  visible: boolean;
  displayText: string;
  isTruncated: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  clearsCandles: boolean;
}

export function computeZoneLabelLayout({
  text,
  boxX,
  boxWidth,
  boxY,
  candleHighY,
  measureTextWidth,
  fontSize = 10,
  paddingX = 4,
  paddingY = 2,
  minBoxWidth = 30,
}: ComputeLabelParams): ZoneLabelLayout {
  const hiddenResult: ZoneLabelLayout = {
    visible: false,
    displayText: '',
    isTruncated: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    clearsCandles: true,
  };

  if (!text || text.trim() === '') return hiddenResult;

  const badgeHeight = fontSize + paddingY * 2;
  const labelY = boxY + 2;
  const labelBottomY = labelY + badgeHeight;

  if (candleHighY !== null && labelBottomY > candleHighY) {
    return hiddenResult;
  }

  if (boxWidth < minBoxWidth) {
    return hiddenResult;
  }

  const maxBadgeWidth = boxWidth - 8;
  const maxTextWidth = maxBadgeWidth - paddingX * 2;

  const ellipsis = '...';
  const ellipsisWidth = measureTextWidth(ellipsis);
  if (ellipsisWidth > maxTextWidth) {
    return hiddenResult;
  }

  const trimmedText = text.trim();
  const fullTextWidth = measureTextWidth(trimmedText);

  let displayText = trimmedText;
  let isTruncated = false;

  if (fullTextWidth <= maxTextWidth) {
    displayText = trimmedText;
    isTruncated = false;
  } else {
    let bestLen = 0;
    for (let len = 1; len <= trimmedText.length; len++) {
      const candidate = trimmedText.slice(0, len) + ellipsis;
      if (measureTextWidth(candidate) <= maxTextWidth) {
        bestLen = len;
      } else {
        break;
      }
    }

    if (bestLen < 1) {
      return hiddenResult;
    }

    displayText = trimmedText.slice(0, bestLen) + ellipsis;
    isTruncated = true;
  }

  const finalBadgeWidth = measureTextWidth(displayText) + paddingX * 2;
  const labelX = boxX + 4;
  const clearsCandles = candleHighY === null || labelBottomY <= candleHighY;

  return {
    visible: true,
    displayText,
    isTruncated,
    x: labelX,
    y: labelY,
    width: finalBadgeWidth,
    height: badgeHeight,
    clearsCandles,
  };
}
