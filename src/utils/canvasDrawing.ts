import {
  type ISeriesApi,
  type ITimeScaleApi,
  type Time,
} from 'lightweight-charts';
import {
  type Candle,
  type Drawing,
  type LineDrawing,
  type ZoneDrawing,
  type PoiDrawing,
  type PiboDrawing,
  type CandleNewsItem,
  type CandleLabelConfig,
} from '../types/chart.js';
import { type ThemeMode } from '../types/theme.js';
import { THEME_PALETTES, adaptColorForTheme } from './themeService.js';
import {
  resolveAnchorPoint,
  resolveZoneBounds,
  resolvePoiBounds,
  resolvePiboBounds,
  parseTimeframeDuration,
} from './timeframeService.js';

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

const CSS_NAMED_COLORS: Record<string, string> = {
  red: '239, 68, 68',
  green: '16, 185, 129',
  blue: '59, 130, 246',
  cyan: '6, 182, 212',
  orange: '249, 115, 22',
  yellow: '234, 179, 8',
  purple: '168, 85, 247',
  pink: '236, 72, 153',
  gray: '148, 163, 184',
  grey: '148, 163, 184',
  white: '255, 255, 255',
  black: '0, 0, 0',
  emerald: '16, 185, 129',
  rose: '244, 63, 94',
  amber: '245, 158, 11',
  indigo: '99, 102, 241',
  sky: '14, 165, 233',
  slate: '100, 116, 139',
};

export function colorWithAlpha(colorStr: string, alpha: number): string {
  if (!colorStr) return `rgba(14, 165, 233, ${alpha})`;
  const trimmed = colorStr.trim();
  const lower = trimmed.toLowerCase();
  if (CSS_NAMED_COLORS[lower]) {
    return `rgba(${CSS_NAMED_COLORS[lower]}, ${alpha})`;
  }
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

export interface PoiTextLayoutParams {
  text: string;
  boxLeft: number;
  boxRight: number;
  boxTop: number;
  boxBottom: number;
  midY: number;
  candles: Candle[];
  timeScale: ITimeScaleApi<Time>;
  series: ISeriesApi<'Candlestick'>;
  measureTextWidth: (str: string) => number;
  fontSize?: number;
  paddingRight?: number;
  halfBar?: number;
}

export type KeyLevelTextLayoutParams = PoiTextLayoutParams;

export interface PoiTextLayoutResult {
  visible: boolean;
  displayText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  clearsCandles: boolean;
  boxLeftLineEnd: number;
  boxRightLineStart: number;
}

export type KeyLevelTextLayoutResult = PoiTextLayoutResult;

export function computePoiTextLayout({
  text,
  boxLeft,
  boxRight,
  boxTop,
  boxBottom,
  midY,
  candles,
  timeScale,
  series,
  measureTextWidth,
  fontSize = 11,
  paddingRight = 14,
  halfBar = 5.5,
}: PoiTextLayoutParams): PoiTextLayoutResult {
  const hiddenResult: PoiTextLayoutResult = {
    visible: false,
    displayText: '',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    clearsCandles: true,
    boxLeftLineEnd: boxRight,
    boxRightLineStart: boxRight,
  };

  const boxWidth = Math.max(1, boxRight - boxLeft);
  if (boxWidth < 18 || !text || text.trim() === '') {
    return hiddenResult;
  }

  const trimmedText = text.trim();
  const textWidth = measureTextWidth(trimmedText);
  const textHeight = fontSize + 4;

  const checkCandleOverlap = (
    xL: number,
    xR: number,
    yT: number,
    yB: number,
  ): boolean => {
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]!;
      const cX = timeScale.timeToCoordinate(c.time as Time);
      if (cX === null) continue;
      if (cX + halfBar < xL || cX - halfBar > xR) continue;

      const cHighY = series.priceToCoordinate(c.high);
      const cLowY = series.priceToCoordinate(c.low);
      if (cHighY === null || cLowY === null) continue;

      const candleTop = Math.min(cHighY, cLowY);
      const candleBottom = Math.max(cHighY, cLowY);

      if (Math.max(candleTop, yT) <= Math.min(candleBottom, yB)) {
        return true;
      }
    }
    return false;
  };

  let maxCandleX = -Infinity;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    const cX = timeScale.timeToCoordinate(c.time as Time);
    if (cX !== null && cX > maxCandleX) {
      maxCandleX = cX;
    }
  }

  const standardRight = boxRight - paddingRight;
  const standardLeft = standardRight - textWidth;
  const standardY = midY;
  const standardYTop = standardY - textHeight / 2;
  const standardYBottom = standardY + textHeight / 2;

  if (standardLeft >= boxLeft + 4) {
    const overlaps = checkCandleOverlap(
      standardLeft - 2,
      standardRight + 2,
      standardYTop,
      standardYBottom,
    );

    if (!overlaps) {
      return {
        visible: true,
        displayText: trimmedText,
        x: standardLeft,
        y: standardY,
        width: textWidth,
        height: textHeight,
        clearsCandles: true,
        boxLeftLineEnd: Math.max(boxLeft, standardLeft - 6),
        boxRightLineStart: Math.min(boxRight, standardRight + 6),
      };
    }
  }

  if (
    maxCandleX !== -Infinity &&
    boxRight > maxCandleX + halfBar + textWidth + 8
  ) {
    const freeRight = Math.min(
      boxRight - paddingRight,
      maxCandleX + halfBar + textWidth + 24,
    );
    const freeLeft = freeRight - textWidth;
    if (freeLeft > maxCandleX + halfBar + 2) {
      return {
        visible: true,
        displayText: trimmedText,
        x: freeLeft,
        y: standardY,
        width: textWidth,
        height: textHeight,
        clearsCandles: true,
        boxLeftLineEnd: Math.max(boxLeft, freeLeft - 6),
        boxRightLineStart: Math.min(boxRight, freeRight + 6),
      };
    }
  }

  const step = Math.max(8, halfBar * 1.5);
  for (
    let candR = standardRight - step;
    candR >= boxLeft + textWidth + 6;
    candR -= step
  ) {
    const candL = candR - textWidth;
    const overlaps = checkCandleOverlap(
      candL - 2,
      candR + 2,
      standardYTop,
      standardYBottom,
    );
    if (!overlaps) {
      return {
        visible: true,
        displayText: trimmedText,
        x: candL,
        y: standardY,
        width: textWidth,
        height: textHeight,
        clearsCandles: true,
        boxLeftLineEnd: Math.max(boxLeft, candL - 6),
        boxRightLineStart: Math.min(boxRight, candR + 6),
      };
    }
  }

  const topY = boxTop + textHeight / 2 + 2;
  if (
    topY + textHeight / 2 <= midY &&
    standardLeft >= boxLeft + 4 &&
    !checkCandleOverlap(
      standardLeft - 2,
      standardRight + 2,
      topY - textHeight / 2,
      topY + textHeight / 2,
    )
  ) {
    return {
      visible: true,
      displayText: trimmedText,
      x: standardLeft,
      y: topY,
      width: textWidth,
      height: textHeight,
      clearsCandles: true,
      boxLeftLineEnd: Math.max(boxLeft, standardLeft - 6),
      boxRightLineStart: Math.min(boxRight, standardRight + 6),
    };
  }

  const botY = boxBottom - textHeight / 2 - 2;
  if (
    botY - textHeight / 2 >= midY &&
    standardLeft >= boxLeft + 4 &&
    !checkCandleOverlap(
      standardLeft - 2,
      standardRight + 2,
      botY - textHeight / 2,
      botY + textHeight / 2,
    )
  ) {
    return {
      visible: true,
      displayText: trimmedText,
      x: standardLeft,
      y: botY,
      width: textWidth,
      height: textHeight,
      clearsCandles: true,
      boxLeftLineEnd: Math.max(boxLeft, standardLeft - 6),
      boxRightLineStart: Math.min(boxRight, standardRight + 6),
    };
  }

  if (standardLeft < boxLeft + 4) {
    const availableWidth = boxWidth - 8;
    const ellipsis = '...';
    const ellipsisWidth = measureTextWidth(ellipsis);
    if (ellipsisWidth <= availableWidth) {
      let bestLen = 0;
      for (let len = 1; len <= trimmedText.length; len++) {
        const candidate = trimmedText.slice(0, len) + ellipsis;
        if (measureTextWidth(candidate) <= availableWidth) {
          bestLen = len;
        } else {
          break;
        }
      }
      if (bestLen > 0) {
        const truncText = trimmedText.slice(0, bestLen) + ellipsis;
        const truncWidth = measureTextWidth(truncText);
        const truncLeft = boxRight - paddingRight - truncWidth;
        return {
          visible: true,
          displayText: truncText,
          x: Math.max(boxLeft + 4, truncLeft),
          y: standardY,
          width: truncWidth,
          height: textHeight,
          clearsCandles: true,
          boxLeftLineEnd: Math.max(boxLeft, truncLeft - 6),
          boxRightLineStart: Math.min(boxRight, truncLeft + truncWidth + 6),
        };
      }
    }
    return hiddenResult;
  }

  return {
    visible: true,
    displayText: trimmedText,
    x: standardLeft,
    y: standardY,
    width: textWidth,
    height: textHeight,
    clearsCandles: true,
    boxLeftLineEnd: Math.max(boxLeft, standardLeft - 6),
    boxRightLineStart: Math.min(boxRight, standardRight + 6),
  };
}

export const computeKeyLevelTextLayout = computePoiTextLayout;

export function renderPoi(
  ctx: CanvasRenderingContext2D,
  drawing: PoiDrawing,
  candles: Candle[],
  timeScale: ITimeScaleApi<Time>,
  series: ISeriesApi<'Candlestick'>,
  paneWidth: number,
  isHovered: boolean,
  currentTimeframe?: string,
  timeframeUnits?: Record<string, number>,
  theme: ThemeMode = 'dark',
): void {
  if (candles.length === 0) return;

  const targetTf = currentTimeframe || 'H4';
  const srcTf = drawing.sourceTimeframe || targetTf;

  const bounds = resolvePoiBounds({
    fromTime: drawing.fromTime,
    fromCandleIndex: drawing.fromCandleIndex,
    topPrice: drawing.topPrice,
    bottomPrice: drawing.bottomPrice,
    isInfinite: drawing.isInfinite,
    mode: drawing.mode,
    candleCount: drawing.candleCount,
    targetCandleCount: drawing.targetCandleCount,
    sourceTimeframe: srcTf,
    targetTimeframe: targetTf,
    targetCandles: candles,
    customUnits: timeframeUnits,
  });

  if (!bounds) return;

  const xStartCoord = timeScale.timeToCoordinate(
    bounds.startCandle.time as Time,
  );
  if (xStartCoord === null) return;

  let halfBar = 5.5;
  const startIdx = candles.findIndex((c) => c.time === bounds.startCandle.time);
  if (startIdx >= 0) {
    if (startIdx + 1 < candles.length) {
      const xNext = timeScale.timeToCoordinate(
        candles[startIdx + 1]!.time as Time,
      );
      if (xNext !== null) {
        halfBar = Math.abs(xNext - xStartCoord) / 2;
      }
    } else if (startIdx - 1 >= 0) {
      const xPrev = timeScale.timeToCoordinate(
        candles[startIdx - 1]!.time as Time,
      );
      if (xPrev !== null) {
        halfBar = Math.abs(xStartCoord - xPrev) / 2;
      }
    }
  }

  const boxLeft = xStartCoord - halfBar;

  let boxRight: number;
  if (bounds.isInfinite) {
    boxRight = paneWidth;
  } else if (bounds.endCandle) {
    const xEndCoord = timeScale.timeToCoordinate(bounds.endCandle.time as Time);
    if (xEndCoord !== null) {
      boxRight = xEndCoord + halfBar;
    } else {
      const lastC = candles[candles.length - 1]!;
      const lastX =
        timeScale.timeToCoordinate(lastC.time as Time) ?? paneWidth - 20;
      const tgtDur = parseTimeframeDuration(targetTf, timeframeUnits);
      const deltaBars = Math.max(0, (bounds.endTime! - lastC.time) / tgtDur);
      boxRight = lastX + deltaBars * (halfBar * 2) + halfBar;
    }
  } else if (bounds.endTime) {
    const lastC = candles[candles.length - 1]!;
    const lastX =
      timeScale.timeToCoordinate(lastC.time as Time) ?? paneWidth - 20;
    const tgtDur = parseTimeframeDuration(targetTf, timeframeUnits);
    const deltaBars = Math.max(0, (bounds.endTime - lastC.time) / tgtDur);
    boxRight = lastX + deltaBars * (halfBar * 2) + halfBar;
  } else {
    boxRight = paneWidth;
  }

  const boxWidth = Math.max(1, boxRight - boxLeft);

  const yTopCoord = series.priceToCoordinate(bounds.topPrice);
  const yBottomCoord = series.priceToCoordinate(bounds.bottomPrice);
  if (yTopCoord === null || yBottomCoord === null) return;

  const yMin = Math.min(yTopCoord, yBottomCoord);
  const yMax = Math.max(yTopCoord, yBottomCoord);
  const boxHeight = Math.max(1, yMax - yMin);
  const midY = (yMin + yMax) / 2;

  ctx.save();

  const baseColor = adaptColorForTheme(drawing.color || '#8a264c', theme);
  const defaultFillColor = colorWithAlpha(
    baseColor,
    theme === 'dark' ? 0.48 : 0.25,
  );

  const defaultCenterLineColor = theme === 'dark' ? '#eab308' : '#ca8a04';
  const defaultTextColor = theme === 'dark' ? '#fef08a' : '#831843';

  const fillColor = drawing.fillColor
    ? adaptColorForTheme(drawing.fillColor, theme)
    : defaultFillColor;

  ctx.fillStyle = isHovered ? colorWithAlpha(fillColor, 0.65) : fillColor;
  ctx.fillRect(boxLeft, yMin, boxWidth, boxHeight);

  if (drawing.showBorder) {
    const borderColor = drawing.borderColor
      ? adaptColorForTheme(drawing.borderColor, theme)
      : defaultCenterLineColor;

    ctx.strokeStyle = isHovered ? '#ffffff' : borderColor;
    ctx.lineWidth = isHovered
      ? (drawing.borderWidth ?? 1) + 1
      : (drawing.borderWidth ?? 1);
    if (drawing.borderStyle === 'dashed') {
      ctx.setLineDash([4, 4]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.strokeRect(boxLeft, yMin, boxWidth, boxHeight);
  }

  const shouldDrawCenterLine =
    drawing.showCenterLine === true ||
    (drawing.centerLineStyle !== undefined &&
      drawing.centerLineStyle !== 'none' &&
      drawing.showCenterLine !== false);

  if (drawing.showText !== false) {
    const rawText =
      drawing.text ||
      drawing.description ||
      drawing.displayName ||
      drawing.label ||
      drawing.element ||
      '';

    const fontSize = drawing.textFontSize ?? 11;
    const fontStr = `italic bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.font = fontStr;

    const layout = computeKeyLevelTextLayout({
      text: rawText,
      boxLeft,
      boxRight,
      boxTop: yMin,
      boxBottom: yMax,
      midY,
      candles,
      timeScale,
      series,
      measureTextWidth: (str: string) => {
        ctx.font = fontStr;
        return ctx.measureText(str).width;
      },
      fontSize,
      halfBar,
      paddingRight: 14,
    });

    if (shouldDrawCenterLine) {
      const centerLineColor = drawing.centerLineColor
        ? adaptColorForTheme(drawing.centerLineColor, theme)
        : drawing.borderColor
          ? adaptColorForTheme(drawing.borderColor, theme)
          : defaultCenterLineColor;

      ctx.save();
      ctx.strokeStyle = colorWithAlpha(centerLineColor, 0.75);
      ctx.lineWidth = drawing.centerLineWidth ?? 1;
      if (drawing.centerLineStyle === 'solid') {
        ctx.setLineDash([]);
      } else {
        ctx.setLineDash([4, 4]);
      }

      if (layout.visible) {
        if (layout.boxLeftLineEnd > boxLeft) {
          ctx.beginPath();
          ctx.moveTo(boxLeft, midY);
          ctx.lineTo(layout.boxLeftLineEnd, midY);
          ctx.stroke();
        }
        if (layout.boxRightLineStart < boxRight) {
          ctx.beginPath();
          ctx.moveTo(layout.boxRightLineStart, midY);
          ctx.lineTo(boxRight, midY);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(boxLeft, midY);
        ctx.lineTo(boxRight, midY);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (layout.visible) {
      const textColor = drawing.textColor
        ? adaptColorForTheme(drawing.textColor, theme)
        : defaultTextColor;

      ctx.fillStyle = isHovered ? '#ffffff' : textColor;
      ctx.textBaseline = 'middle';
      ctx.font = fontStr;
      ctx.fillText(layout.displayText, layout.x, layout.y);
    }
  } else if (shouldDrawCenterLine) {
    const centerLineColor = drawing.centerLineColor
      ? adaptColorForTheme(drawing.centerLineColor, theme)
      : drawing.borderColor
        ? adaptColorForTheme(drawing.borderColor, theme)
        : defaultCenterLineColor;

    ctx.save();
    ctx.strokeStyle = colorWithAlpha(centerLineColor, 0.75);
    ctx.lineWidth = drawing.centerLineWidth ?? 1;
    if (drawing.centerLineStyle === 'solid') {
      ctx.setLineDash([]);
    } else {
      ctx.setLineDash([4, 4]);
    }
    ctx.beginPath();
    ctx.moveTo(boxLeft, midY);
    ctx.lineTo(boxRight, midY);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

export const renderKeyLevel = renderPoi;

export function renderPibo(
  ctx: CanvasRenderingContext2D,
  drawing: PiboDrawing,
  candles: Candle[],
  timeScale: ITimeScaleApi<Time>,
  series: ISeriesApi<'Candlestick'>,
  paneWidth: number,
  isHovered: boolean,
  currentTimeframe?: string,
  timeframeUnits?: Record<string, number>,
  theme: ThemeMode = 'dark',
): void {
  if (candles.length === 0) return;

  const targetTf = currentTimeframe || 'H4';
  const bounds = resolvePiboBounds({
    fromTime: drawing.fromTime,
    toTime: drawing.toTime,
    fromCandleIndex: drawing.fromCandleIndex,
    toCandleIndex: drawing.toCandleIndex,
    fromPrice: drawing.fromPrice,
    toPrice: drawing.toPrice,
    startLevel: drawing.startLevel,
    endLevel: drawing.endLevel,
    levels: drawing.levels,
    zones: drawing.zones,
    sourceTimeframe: drawing.sourceTimeframe,
    targetTimeframe: targetTf,
    targetCandles: candles,
    customUnits: timeframeUnits,
  });

  if (!bounds) return;

  const xStart = timeScale.timeToCoordinate(bounds.startTime as Time);
  const xEnd = timeScale.timeToCoordinate(bounds.endTime as Time);
  const yStart = series.priceToCoordinate(bounds.startPrice);
  const yEnd = series.priceToCoordinate(bounds.endPrice);

  if (xStart === null || xEnd === null || yStart === null || yEnd === null) {
    return;
  }

  const xMin = Math.min(xStart, xEnd);
  const xMax = Math.max(xStart, xEnd);

  const xLeft = drawing.extendLeft ? 0 : Math.max(0, xMin - 6);
  const xRight = drawing.extendRight
    ? paneWidth
    : Math.min(paneWidth, xMax + 14);

  ctx.save();

  for (const zone of bounds.zones) {
    const yFrom = series.priceToCoordinate(zone.fromPrice);
    const yTo = series.priceToCoordinate(zone.toPrice);
    if (yFrom === null || yTo === null) continue;

    const yTop = Math.min(yFrom, yTo);
    const yBottom = Math.max(yFrom, yTo);
    const h = Math.max(1, yBottom - yTop);
    const w = Math.max(1, xRight - xLeft);

    const baseColor = adaptColorForTheme(
      zone.fillColor || zone.color || drawing.zoneColor || '#ef4444',
      theme,
    );
    const zoneAlpha = isHovered
      ? (zone.opacity ?? 0.16) + 0.06
      : (zone.opacity ?? 0.1);

    ctx.save();
    ctx.fillStyle = colorWithAlpha(baseColor, zoneAlpha);
    ctx.fillRect(xLeft, yTop, w, h);

    ctx.strokeStyle = colorWithAlpha(baseColor, isHovered ? 0.45 : 0.22);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(xLeft, yTop, w, h);

    if (zone.showLabel && zone.label) {
      const fontSize = 10;
      ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
      ctx.fillStyle = adaptColorForTheme(zone.color || baseColor, theme);
      ctx.textBaseline = 'top';
      ctx.fillText(zone.label, xLeft + 6, yTop + 3);
    }
    ctx.restore();
  }

  if (drawing.showTrendLine !== false) {
    ctx.save();
    const trendColor = adaptColorForTheme(
      drawing.trendLineColor || drawing.lineColor || drawing.color || '#94a3b8',
      theme,
    );
    ctx.strokeStyle = isHovered
      ? THEME_PALETTES[theme].canvas.lineHoverColor
      : colorWithAlpha(trendColor, 0.7);
    ctx.lineWidth = isHovered ? 1.5 : 1;
    ctx.setLineDash(drawing.trendLineStyle === 'solid' ? [] : [4, 4]);

    ctx.beginPath();
    ctx.moveTo(xStart, yStart);
    ctx.lineTo(xEnd, yEnd);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = isHovered
      ? THEME_PALETTES[theme].canvas.lineHoverColor
      : trendColor;
    ctx.beginPath();
    ctx.arc(xStart, yStart, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(xEnd, yEnd, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const showLabels = drawing.showLabels !== false;
  const labelPos = drawing.labelPosition || 'right';
  const fontSize = 10;
  const fontStr = `500 ${fontSize}px "JetBrains Mono", monospace`;
  const piboBarColor = drawing.lineColor || drawing.color || '#3b82f6';

  for (const lvl of bounds.levels) {
    const y = series.priceToCoordinate(lvl.price);
    if (y === null) continue;

    const lineColor = lvl.color
      ? adaptColorForTheme(lvl.color, theme)
      : adaptColorForTheme(piboBarColor, theme);

    ctx.save();
    ctx.strokeStyle = isHovered
      ? THEME_PALETTES[theme].canvas.lineHoverColor
      : lineColor;
    ctx.lineWidth = isHovered
      ? (lvl.lineWidth ?? drawing.lineWidth ?? 1) + 1
      : (lvl.lineWidth ?? drawing.lineWidth ?? 1);

    if (lvl.lineStyle === 'dashed') {
      ctx.setLineDash([4, 4]);
    } else if (lvl.lineStyle === 'dotted') {
      ctx.setLineDash([2, 2]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(xLeft, y);
    ctx.lineTo(xRight, y);
    ctx.stroke();

    if (showLabels) {
      const labelText = lvl.label || `${lvl.level} (${lvl.price.toFixed(5)})`;
      ctx.font = fontStr;
      const textWidth = ctx.measureText(labelText).width;
      const pillHeight = fontSize + 4;
      const pillY = y - pillHeight / 2;

      let pillX: number;
      if (labelPos === 'left') {
        pillX = xLeft + 6;
      } else if (labelPos === 'center') {
        pillX = (xLeft + xRight) / 2 - textWidth / 2;
      } else {
        pillX = xRight - textWidth - 6;
      }

      ctx.setLineDash([]);
      ctx.fillStyle = THEME_PALETTES[theme].chart.background;
      ctx.fillRect(pillX - 2, pillY, textWidth + 4, pillHeight);

      ctx.fillStyle = isHovered
        ? THEME_PALETTES[theme].canvas.lineHoverColor
        : lineColor;
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, pillX, y);
    }

    ctx.restore();
  }

  ctx.restore();
}

export const renderFibonacci = renderPibo;

export interface NewsAnchor {
  x: number;
  y: number;
  radius: number;
  candle: Candle;
  news: CandleNewsItem[];
}

export function renderCandleNews(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  timeScale: ITimeScaleApi<Time>,
  series: ISeriesApi<'Candlestick'>,
  paneWidth: number,
  paneHeight: number,
  theme: ThemeMode = 'dark',
  hoveredTime?: number | null,
): NewsAnchor[] {
  if (candles.length === 0) return [];
  const anchors: NewsAnchor[] = [];
  const radius = 9;
  const bottomY = Math.max(radius + 4, paneHeight - radius - 5);

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    if (!c.news || c.news.length === 0) continue;

    const x = timeScale.timeToCoordinate(c.time as Time);
    if (x === null || x < -20 || x > paneWidth + 20) continue;

    const y = bottomY;
    const isHovered = hoveredTime === c.time;
    anchors.push({ x, y, radius, candle: c, news: c.news });

    ctx.save();

    if (isHovered) {
      ctx.shadowColor = theme === 'dark' ? '#38bdf8' : '#0284c7';
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isHovered
      ? '#0284c7'
      : theme === 'dark'
        ? '#0f172a'
        : '#ffffff';
    ctx.fill();

    ctx.lineWidth = isHovered ? 2 : 1.5;
    ctx.strokeStyle = isHovered
      ? '#ffffff'
      : theme === 'dark'
        ? '#38bdf8'
        : '#0284c7';
    ctx.stroke();

    ctx.font = 'bold 10px "JetBrains Mono", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isHovered
      ? '#ffffff'
      : theme === 'dark'
        ? '#38bdf8'
        : '#0284c7';
    ctx.fillText('N', x, y + 0.5);

    if (c.news.length > 1) {
      const badgeR = 5;
      const bx = x + radius - 2;
      const by = y - radius + 2;

      ctx.beginPath();
      ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = 'bold 8px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(c.news.length), bx, by);
    }

    ctx.restore();
  }

  return anchors;
}

export interface CalloutLayoutResult {
  visible: boolean;
  boxLeft: number;
  boxTop: number;
  boxWidth: number;
  boxHeight: number;
  tipX: number;
  tipY: number;
  tailBaseLeft: number;
  tailBaseRight: number;
  tailBaseY: number;
  position: 'above' | 'below';
  text: string;
}

export interface ObstacleRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function extractDrawingObstacles(
  drawings: Drawing[] | undefined,
  candles: Candle[],
  timeScale: ITimeScaleApi<Time>,
  series: ISeriesApi<'Candlestick'>,
  paneWidth: number,
  currentTimeframe?: string,
  timeframeUnits?: Record<string, number>,
): ObstacleRect[] {
  if (!drawings || drawings.length === 0 || candles.length === 0) return [];
  const obstacles: ObstacleRect[] = [];
  const targetTf = currentTimeframe || 'H4';

  let halfBar = 5.5;
  if (candles.length > 1) {
    const x0 = timeScale.timeToCoordinate(candles[0]!.time as Time);
    const x1 = timeScale.timeToCoordinate(candles[1]!.time as Time);
    if (x0 !== null && x1 !== null) {
      halfBar = Math.abs(x1 - x0) / 2;
    }
  }

  for (const d of drawings) {
    if (d.visible === false) continue;

    if (d.type === 'poi' || d.type === 'keyLevel') {
      const poi = d as PoiDrawing;
      const bounds = resolvePoiBounds({
        fromTime: poi.fromTime,
        fromCandleIndex: poi.fromCandleIndex,
        topPrice: poi.topPrice,
        bottomPrice: poi.bottomPrice,
        isInfinite: poi.isInfinite,
        mode: poi.mode,
        candleCount: poi.candleCount,
        targetCandleCount: poi.targetCandleCount,
        sourceTimeframe: poi.sourceTimeframe || targetTf,
        targetTimeframe: targetTf,
        targetCandles: candles,
        customUnits: timeframeUnits,
      });
      if (bounds) {
        const xStart = timeScale.timeToCoordinate(
          bounds.startCandle.time as Time,
        );
        if (xStart !== null) {
          const xLeft = xStart - halfBar;
          let xRight = paneWidth;
          if (!bounds.isInfinite && bounds.endCandle) {
            const xEnd = timeScale.timeToCoordinate(
              bounds.endCandle.time as Time,
            );
            if (xEnd !== null) xRight = xEnd + halfBar;
          }
          const yTop = series.priceToCoordinate(bounds.topPrice);
          const yBottom = series.priceToCoordinate(bounds.bottomPrice);
          if (yTop !== null && yBottom !== null) {
            obstacles.push({
              left: Math.min(xLeft, xRight),
              right: Math.max(xLeft, xRight),
              top: Math.min(yTop, yBottom),
              bottom: Math.max(yTop, yBottom),
            });
          }
        }
      }
    } else if (d.type === 'box' || d.type === 'zone') {
      const zone = d as ZoneDrawing;
      const bounds = resolveZoneBounds({
        fromTime: zone.fromTime,
        toTime: zone.toTime,
        fromCandleIndex: zone.fromCandleIndex,
        toCandleIndex: zone.toCandleIndex,
        topPrice: zone.topPrice,
        bottomPrice: zone.bottomPrice,
        paddingRatio: zone.paddingRatio,
        paddingPrice: zone.paddingPrice,
        sourceTimeframe: zone.sourceTimeframe || targetTf,
        targetTimeframe: targetTf,
        targetCandles: candles,
        customUnits: timeframeUnits,
      });
      if (bounds) {
        const xStart = timeScale.timeToCoordinate(
          bounds.startCandle.time as Time,
        );
        const xEnd = timeScale.timeToCoordinate(bounds.endCandle.time as Time);
        if (xStart !== null && xEnd !== null) {
          const xLeft = Math.min(xStart, xEnd) - halfBar;
          const xRight = Math.max(xStart, xEnd) + halfBar;
          const yTop = series.priceToCoordinate(bounds.boxTopPrice);
          const yBottom = series.priceToCoordinate(bounds.boxBottomPrice);
          if (yTop !== null && yBottom !== null) {
            obstacles.push({
              left: Math.min(xLeft, xRight),
              right: Math.max(xLeft, xRight),
              top: Math.min(yTop, yBottom),
              bottom: Math.max(yTop, yBottom),
            });
          }
        }
      }
    }
  }

  return obstacles;
}

function checkRectOverlap(r1: ObstacleRect, r2: ObstacleRect): boolean {
  return (
    Math.max(r1.left, r2.left) < Math.min(r1.right, r2.right) &&
    Math.max(r1.top, r2.top) < Math.min(r1.bottom, r2.bottom)
  );
}

function lineIntersectsSegment(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  q1x: number,
  q1y: number,
  q2x: number,
  q2y: number,
): boolean {
  function ccw(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
  ) {
    return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
  }
  return (
    ccw(p1x, p1y, q1x, q1y, q2x, q2y) !== ccw(p2x, p2y, q1x, q1y, q2x, q2y) &&
    ccw(p1x, p1y, p2x, p2y, q1x, q1y) !== ccw(p1x, p1y, p2x, p2y, q2x, q2y)
  );
}

function lineIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: ObstacleRect,
): boolean {
  if (x1 > rect.left && x1 < rect.right && y1 > rect.top && y1 < rect.bottom) {
    return true;
  }
  if (x2 > rect.left && x2 < rect.right && y2 > rect.top && y2 < rect.bottom) {
    return true;
  }

  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  if (
    maxX < rect.left ||
    minX > rect.right ||
    maxY < rect.top ||
    minY > rect.bottom
  ) {
    return false;
  }

  if (
    lineIntersectsSegment(
      x1,
      y1,
      x2,
      y2,
      rect.left,
      rect.top,
      rect.right,
      rect.top,
    )
  )
    return true;
  if (
    lineIntersectsSegment(
      x1,
      y1,
      x2,
      y2,
      rect.left,
      rect.bottom,
      rect.right,
      rect.bottom,
    )
  )
    return true;
  if (
    lineIntersectsSegment(
      x1,
      y1,
      x2,
      y2,
      rect.left,
      rect.top,
      rect.left,
      rect.bottom,
    )
  )
    return true;
  if (
    lineIntersectsSegment(
      x1,
      y1,
      x2,
      y2,
      rect.right,
      rect.top,
      rect.right,
      rect.bottom,
    )
  )
    return true;

  return false;
}

export interface ComputeCalloutParams {
  candle: Candle;
  label: CandleLabelConfig;
  candles: Candle[];
  timeScale: ITimeScaleApi<Time>;
  series: ISeriesApi<'Candlestick'>;
  paneWidth: number;
  paneHeight: number;
  measureTextWidth: (str: string) => number;
  drawings?: Drawing[];
  currentTimeframe?: string;
  timeframeUnits?: Record<string, number>;
  obstacles?: ObstacleRect[];
}

export function computeCalloutLayout({
  candle,
  label,
  candles,
  timeScale,
  series,
  paneWidth,
  paneHeight,
  measureTextWidth,
  drawings,
  currentTimeframe,
  timeframeUnits,
  obstacles,
}: ComputeCalloutParams): CalloutLayoutResult | null {
  const candleX = timeScale.timeToCoordinate(candle.time as Time);
  if (candleX === null) return null;

  const yHigh = series.priceToCoordinate(candle.high);
  const yLow = series.priceToCoordinate(candle.low);
  if (yHigh === null || yLow === null) return null;

  const text = label.text || label.title || '';
  if (!text.trim()) return null;

  const textWidth = measureTextWidth(text);
  const boxWidth = Math.max(70, textWidth + 24);
  const boxHeight = 26;
  const tailH = 14;

  const obsList =
    obstacles ||
    extractDrawingObstacles(
      drawings,
      candles,
      timeScale,
      series,
      paneWidth,
      currentTimeframe,
      timeframeUnits,
    );

  const preferredPos: 'above' | 'below' =
    label.position === 'below'
      ? 'below'
      : label.position === 'above'
        ? 'above'
        : yHigh < 60 && paneHeight - yLow > yHigh
          ? 'below'
          : 'above';

  const positions: Array<'above' | 'below'> =
    preferredPos === 'above' ? ['above', 'below'] : ['below', 'above'];

  const offsets = [0, 45, -45, 90, -90, 140, -140];

  let bestResult: CalloutLayoutResult | null = null;
  let minPenalty = Infinity;

  for (const pos of positions) {
    const tipX = candleX;
    const tipY = pos === 'above' ? yHigh : yLow;

    for (const dx of offsets) {
      const boxLeft = Math.max(
        6,
        Math.min(paneWidth - boxWidth - 6, candleX + dx - boxWidth / 2),
      );
      const boxRight = boxLeft + boxWidth;

      let minCandleY = Infinity;
      let maxCandleY = -Infinity;

      for (let i = 0; i < candles.length; i++) {
        const c = candles[i]!;
        const cX = timeScale.timeToCoordinate(c.time as Time);
        if (cX === null) continue;
        if (cX + 12 < boxLeft || cX - 12 > boxRight) continue;

        const cH = series.priceToCoordinate(c.high);
        const cL = series.priceToCoordinate(c.low);
        if (cH !== null && cH < minCandleY) minCandleY = cH;
        if (cL !== null && cL > maxCandleY) maxCandleY = cL;
      }

      if (minCandleY === Infinity) minCandleY = yHigh;
      if (maxCandleY === -Infinity) maxCandleY = yLow;

      let boxTop: number;
      let tailBaseY: number;

      if (pos === 'above') {
        const safeBottom = Math.min(yHigh - tailH, minCandleY - tailH - 4);
        boxTop = safeBottom - boxHeight;
        tailBaseY = boxTop + boxHeight;
      } else {
        const safeTop = Math.max(yLow + tailH, maxCandleY + tailH + 4);
        boxTop = safeTop;
        tailBaseY = boxTop;
      }

      let penalty = Math.abs(dx);
      if (pos !== preferredPos) penalty += 200;

      if (pos === 'above' && boxTop < 48) {
        penalty += 1000;
      }
      if (pos === 'below' && boxTop + boxHeight > paneHeight - 6) {
        penalty += 1000;
      }

      const tailCenterX = Math.max(
        boxLeft + 12,
        Math.min(boxRight - 12, candleX),
      );
      const tailBaseLeft = tailCenterX - 8;
      const tailBaseRight = tailCenterX + 8;

      const boxRect: ObstacleRect = {
        left: boxLeft,
        right: boxRight,
        top: boxTop,
        bottom: boxTop + boxHeight,
      };

      let overlapsObstacle = false;
      for (const obs of obsList) {
        if (checkRectOverlap(boxRect, obs)) {
          overlapsObstacle = true;
          break;
        }
        if (lineIntersectsRect(tailCenterX, tailBaseY, tipX, tipY, obs)) {
          overlapsObstacle = true;
          break;
        }
      }

      if (overlapsObstacle) {
        penalty += 5000;
      }

      const candidate: CalloutLayoutResult = {
        visible: true,
        boxLeft,
        boxTop: Math.max(48, Math.min(paneHeight - boxHeight - 6, boxTop)),
        boxWidth,
        boxHeight,
        tipX,
        tipY,
        tailBaseLeft,
        tailBaseRight,
        tailBaseY,
        position: pos,
        text,
      };

      if (!overlapsObstacle && penalty < 1000) {
        return candidate;
      }

      if (penalty < minPenalty) {
        minPenalty = penalty;
        bestResult = candidate;
      }
    }
  }

  return bestResult;
}

export function renderCandleLabels(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  timeScale: ITimeScaleApi<Time>,
  series: ISeriesApi<'Candlestick'>,
  paneWidth: number,
  paneHeight: number,
  isLabelsVisible: boolean = true,
  theme: ThemeMode = 'dark',
  drawings?: Drawing[],
  currentTimeframe?: string,
  timeframeUnits?: Record<string, number>,
  elementVisibility?: { [id: string]: boolean },
  hoveredElementId?: string | null,
): void {
  if (!isLabelsVisible || candles.length === 0) return;

  const fontStr = 'bold 11px "JetBrains Mono", sans-serif';
  ctx.font = fontStr;

  const obstacles = extractDrawingObstacles(
    drawings,
    candles,
    timeScale,
    series,
    paneWidth,
    currentTimeframe,
    timeframeUnits,
  );

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    const labelList = c.labels || (c.label ? [c.label] : []);
    if (labelList.length === 0) continue;

    for (let lIdx = 0; lIdx < labelList.length; lIdx++) {
      const label = labelList[lIdx]!;
      const elId =
        label.element ||
        label.id ||
        `callout-${c.time}-${lIdx}-${label.text || 'Callout'}`;

      let isVisible: boolean;
      if (elementVisibility) {
        if (elementVisibility[elId] !== undefined) {
          isVisible = elementVisibility[elId]!;
        } else if (label.id && elementVisibility[label.id] !== undefined) {
          isVisible = elementVisibility[label.id]!;
        } else if (
          label.element &&
          elementVisibility[label.element] !== undefined
        ) {
          isVisible = elementVisibility[label.element]!;
        } else if (
          label.group &&
          elementVisibility[label.group] !== undefined
        ) {
          isVisible = elementVisibility[label.group]!;
        } else if (label.text && elementVisibility[label.text] !== undefined) {
          isVisible = elementVisibility[label.text]!;
        } else if (elementVisibility['Callouts'] !== undefined) {
          isVisible = elementVisibility['Callouts']!;
        } else if (elementVisibility['callouts'] !== undefined) {
          isVisible = elementVisibility['callouts']!;
        } else {
          isVisible = label.visible !== false;
        }
      } else {
        isVisible = label.visible !== false;
      }

      if (!isVisible) continue;

      const layout = computeCalloutLayout({
        candle: c,
        label,
        candles,
        timeScale,
        series,
        paneWidth,
        paneHeight,
        measureTextWidth: (str: string) => {
          ctx.font = fontStr;
          return ctx.measureText(str).width;
        },
        obstacles,
      });

      if (!layout || !layout.visible) continue;

      ctx.save();

      const isHovered =
        hoveredElementId !== null &&
        hoveredElementId !== undefined &&
        (hoveredElementId === elId ||
          hoveredElementId === label.id ||
          hoveredElementId === label.element);

      const bgFill = label.color || (theme === 'dark' ? '#164e63' : '#0e7490');
      const borderColor = isHovered
        ? '#38bdf8'
        : label.borderColor || (theme === 'dark' ? '#38bdf8' : '#0284c7');
      const textColor = label.textColor || '#ffffff';
      const calloutLineWidth = isHovered ? 2.5 : 1.5;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(
          layout.boxLeft,
          layout.boxTop,
          layout.boxWidth,
          layout.boxHeight,
          4,
        );
      } else {
        ctx.rect(
          layout.boxLeft,
          layout.boxTop,
          layout.boxWidth,
          layout.boxHeight,
        );
      }
      ctx.fillStyle = bgFill;
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = calloutLineWidth;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(layout.tailBaseLeft, layout.tailBaseY);
      ctx.lineTo(layout.tipX, layout.tipY);
      ctx.lineTo(layout.tailBaseRight, layout.tailBaseY);
      ctx.closePath();
      ctx.fillStyle = bgFill;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(layout.tailBaseLeft, layout.tailBaseY);
      ctx.lineTo(layout.tipX, layout.tipY);
      ctx.lineTo(layout.tailBaseRight, layout.tailBaseY);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = calloutLineWidth;
      ctx.stroke();

      ctx.fillStyle = bgFill;
      ctx.fillRect(
        layout.tailBaseLeft + 0.5,
        layout.position === 'above' ? layout.tailBaseY - 2 : layout.tailBaseY,
        layout.tailBaseRight - layout.tailBaseLeft - 1,
        2,
      );

      ctx.font = fontStr;
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        layout.text,
        layout.boxLeft + layout.boxWidth / 2,
        Math.round(layout.boxTop + layout.boxHeight / 2),
      );

      ctx.restore();
    }
  }
}
