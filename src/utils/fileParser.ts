import pako from 'pako';
import {
  type ForexChartData,
  type Candle,
  type Drawing,
  type TimeframeData,
  type LineDirection,
  type PriceOption,
  type TimeframeConversion,
  type CandlePoiConfig,
  type PoiDrawing,
} from '../types/chart.js';
import { getTimeframeConversionRatio } from './timeframeService.js';

export function normalizeTimestamp(input: number | string | undefined): number {
  if (input === undefined || input === null) return 0;
  if (typeof input === 'number') {
    if (input > 1e11) {
      return Math.floor(input / 1000);
    }
    return Math.floor(input);
  }
  const parsed = Date.parse(input);
  if (!isNaN(parsed)) {
    return Math.floor(parsed / 1000);
  }
  const num = Number(input);
  return isNaN(num) ? 0 : num > 1e11 ? Math.floor(num / 1000) : Math.floor(num);
}

export function normalizeCandlePoi(raw: unknown): CandlePoiConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const topPriceRaw =
    r.topPrice ?? r.top ?? r.highPrice ?? r.high ?? r.priceTo ?? r.price2;
  const bottomPriceRaw =
    r.bottomPrice ?? r.bottom ?? r.lowPrice ?? r.low ?? r.priceFrom ?? r.price1;

  if (topPriceRaw === undefined && bottomPriceRaw === undefined) {
    return null;
  }

  const p1 = Number(topPriceRaw ?? bottomPriceRaw ?? 0);
  const p2 = Number(bottomPriceRaw ?? topPriceRaw ?? 0);
  const topPrice = Math.max(p1, p2);
  const bottomPrice = Math.min(p1, p2);

  const candleCount =
    typeof r.candleCount === 'number'
      ? r.candleCount
      : typeof r.targetCandleCount === 'number'
        ? r.targetCandleCount
        : typeof r.targetCandles === 'number'
          ? r.targetCandles
          : undefined;

  const isInfinite =
    typeof r.isInfinite === 'boolean'
      ? r.isInfinite
      : r.mode === 'infinite'
        ? true
        : r.mode === 'finite'
          ? false
          : candleCount === undefined;

  const mode =
    r.mode === 'finite' || r.mode === 'infinite'
      ? r.mode
      : isInfinite
        ? 'infinite'
        : 'finite';

  const text =
    typeof r.text === 'string' && r.text.trim() !== ''
      ? r.text.trim()
      : typeof r.label === 'string' && r.label.trim() !== ''
        ? r.label.trim()
        : typeof r.displayName === 'string' && r.displayName.trim() !== ''
          ? r.displayName.trim()
          : typeof r.description === 'string' && r.description.trim() !== ''
            ? r.description.trim()
            : undefined;

  const subType =
    r.subType === 'poi' ||
    r.type === 'poi' ||
    (typeof text === 'string' && text.toLowerCase().includes('poi'))
      ? 'poi'
      : 'keyLevel';

  return {
    topPrice,
    bottomPrice,
    candleCount,
    targetCandleCount: candleCount,
    isInfinite,
    mode,
    text: text || (subType === 'poi' ? 'N - POI' : 'D - KL'),
    label: text || (subType === 'poi' ? 'N - POI' : 'D - KL'),
    color: typeof r.color === 'string' ? r.color : undefined,
    fillColor: typeof r.fillColor === 'string' ? r.fillColor : undefined,
    borderColor: typeof r.borderColor === 'string' ? r.borderColor : undefined,
    borderWidth: typeof r.borderWidth === 'number' ? r.borderWidth : undefined,
    borderStyle: r.borderStyle === 'dashed' ? 'dashed' : 'solid',
    textColor: typeof r.textColor === 'string' ? r.textColor : undefined,
    subType,
    displayName: typeof r.displayName === 'string' ? r.displayName : undefined,
  };
}

export const normalizeCandleKeyLevel = normalizeCandlePoi;

export function normalizeCandles(rawCandles: unknown[]): Candle[] {
  if (!Array.isArray(rawCandles)) return [];

  const candles: Candle[] = (rawCandles as Array<Record<string, unknown>>)
    .map((c) => {
      const time = normalizeTimestamp(
        (c.time ?? c.date ?? c.timestamp ?? c.t) as number | string | undefined,
      );
      const open = Number(c.open ?? c.o ?? 0);
      const high = Number(c.high ?? c.h ?? open);
      const low = Number(c.low ?? c.l ?? open);
      const close = Number(c.close ?? c.c ?? open);

      let pois: CandlePoiConfig[] | undefined;
      const rawPoiList =
        c.pois ??
        c.poi_blocks ??
        c.poiBlocks ??
        c.keyLevels ??
        c.key_levels ??
        (c.poi ? [c.poi] : undefined) ??
        (c.poiBlock ? [c.poiBlock] : undefined) ??
        (c.keyLevel ? [c.keyLevel] : undefined) ??
        (c.key_level ? [c.key_level] : undefined);
      if (Array.isArray(rawPoiList)) {
        pois = rawPoiList
          .map((k) => normalizeCandlePoi(k))
          .filter(Boolean) as CandlePoiConfig[];
      }

      const candleObj: Candle = { time, open, high, low, close };
      if (pois && pois.length > 0) {
        candleObj.pois = pois;
        candleObj.poi = pois[0];
        candleObj.keyLevels = pois;
        candleObj.keyLevel = pois[0];
      }
      return candleObj;
    })
    .filter((c) => c.time > 0 && !isNaN(c.open) && !isNaN(c.close));

  candles.sort((a, b) => a.time - b.time);

  const uniqueCandles: Candle[] = [];
  for (let i = 0; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    if (curr && (i === 0 || !prev || curr.time !== prev.time)) {
      uniqueCandles.push(curr);
    }
  }

  return uniqueCandles;
}

export function normalizeLineDirection(
  val: unknown,
  fromPrice?: unknown,
  _toPrice?: unknown,
): LineDirection {
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'down' || s === 'giam' || s === 'bearish' || s === 'fall')
      return 'down';
    if (s === 'up' || s === 'tang' || s === 'bullish' || s === 'rise')
      return 'up';
  }

  if (typeof fromPrice === 'string' && fromPrice.toLowerCase() === 'high') {
    return 'down';
  }
  return 'up';
}

export function normalizeDrawings(
  rawDrawings: unknown[],
  sourceTimeframe?: string,
  defaultGroup?: string,
): Drawing[] {
  if (!Array.isArray(rawDrawings)) return [];

  return (rawDrawings as Array<Record<string, unknown>>).map((d, index) => {
    const rawType =
      typeof d.type === 'string' ? d.type.toLowerCase().trim() : '';
    const isKeyLevel =
      rawType === 'keylevel' ||
      rawType === 'key_level' ||
      rawType === 'key-level' ||
      rawType === 'poi' ||
      Boolean(d.isKeyLevel) ||
      Boolean(d.keyLevel);

    const isZoneOrBox =
      !isKeyLevel &&
      (rawType === 'box' ||
        rawType === 'zone' ||
        rawType === 'rectangle' ||
        rawType === 'range' ||
        d.topPrice !== undefined ||
        d.bottomPrice !== undefined);

    const stretch = d.stretch !== undefined ? Boolean(d.stretch) : true;
    const visible = d.visible !== undefined ? Boolean(d.visible) : true;

    const group =
      typeof d.group === 'string' && d.group.trim() !== ''
        ? d.group.trim()
        : typeof d.groupId === 'string' && d.groupId.trim() !== ''
          ? d.groupId.trim()
          : typeof d.groupName === 'string' && d.groupName.trim() !== ''
            ? d.groupName.trim()
            : defaultGroup;

    const displayName =
      typeof d.displayName === 'string' && d.displayName.trim() !== ''
        ? d.displayName.trim()
        : typeof d.title === 'string' && d.title.trim() !== ''
          ? d.title.trim()
          : typeof d.name === 'string' && d.name.trim() !== ''
            ? d.name.trim()
            : undefined;

    const elementName =
      displayName ||
      (typeof d.element === 'string' && d.element.trim() !== ''
        ? d.element.trim()
        : typeof d.elementId === 'string' && d.elementId.trim() !== ''
          ? d.elementId.trim()
          : group ||
            (sourceTimeframe ? `Timeframe ${sourceTimeframe}` : 'Common'));

    if (isKeyLevel) {
      const id =
        typeof d.id === 'string'
          ? d.id
          : `poi-${sourceTimeframe || 'common'}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`;

      const description =
        typeof d.description === 'string' && d.description.trim() !== ''
          ? d.description.trim()
          : undefined;

      const color =
        typeof d.color === 'string' && d.color.trim() !== ''
          ? d.color.trim()
          : '#8a264c';

      const defaultBorder = '#eab308';

      const p1 = Number(
        d.topPrice ??
          d.top ??
          d.highPrice ??
          d.high ??
          d.priceTo ??
          d.price2 ??
          0,
      );
      const p2 = Number(
        d.bottomPrice ??
          d.bottom ??
          d.lowPrice ??
          d.low ??
          d.priceFrom ??
          d.price1 ??
          0,
      );
      const topPrice = Math.max(p1, p2);
      const bottomPrice = Math.min(p1, p2);

      const candleCount =
        typeof d.candleCount === 'number'
          ? d.candleCount
          : typeof d.targetCandleCount === 'number'
            ? d.targetCandleCount
            : typeof d.targetCandles === 'number'
              ? d.targetCandles
              : undefined;

      const isInfinite =
        typeof d.isInfinite === 'boolean'
          ? d.isInfinite
          : d.mode === 'infinite'
            ? true
            : d.mode === 'finite'
              ? false
              : candleCount === undefined;

      const text =
        typeof d.text === 'string' && d.text.trim() !== ''
          ? d.text.trim()
          : description ||
            (typeof d.displayName === 'string' && d.displayName.trim() !== ''
              ? d.displayName.trim()
              : typeof d.label === 'string' && d.label.trim() !== ''
                ? d.label.trim()
                : '');

      const poiType: 'poi' | 'keyLevel' =
        rawType === 'keylevel' ||
        rawType === 'key_level' ||
        rawType === 'key-level'
          ? 'keyLevel'
          : 'poi';
      const klItem: PoiDrawing = {
        id,
        type: poiType,
        color,
        fillColor: typeof d.fillColor === 'string' ? d.fillColor : undefined,
        showBorder: d.showBorder === true,
        borderColor:
          typeof d.borderColor === 'string' ? d.borderColor : defaultBorder,
        borderWidth: typeof d.borderWidth === 'number' ? d.borderWidth : 1,
        borderStyle: d.borderStyle === 'dashed' ? 'dashed' : 'solid',
        centerLineStyle: 'dashed',
        centerLineColor:
          typeof d.centerLineColor === 'string'
            ? d.centerLineColor
            : typeof d.borderColor === 'string'
              ? d.borderColor
              : defaultBorder,
        centerLineWidth:
          typeof d.centerLineWidth === 'number' ? d.centerLineWidth : 1,
        element: group || elementName || description || text,
        group: group || elementName || description || text,
        displayName: displayName || description || text,
        fromTime:
          d.fromTime !== undefined
            ? normalizeTimestamp(d.fromTime as number | string)
            : undefined,
        fromCandleIndex:
          typeof d.fromCandleIndex === 'number' ? d.fromCandleIndex : undefined,
        topPrice,
        bottomPrice,
        candleCount,
        targetCandleCount: candleCount,
        isInfinite,
        mode:
          d.mode === 'finite' || d.mode === 'infinite'
            ? d.mode
            : isInfinite
              ? 'infinite'
              : 'finite',
        text,
        label: text,
        showText: d.showText !== false && d.showLabel !== false,
        textColor: typeof d.textColor === 'string' ? d.textColor : '#fef08a',
        textFontSize: typeof d.textFontSize === 'number' ? d.textFontSize : 11,
        textPosition:
          d.textPosition === 'left' || d.textPosition === 'center'
            ? d.textPosition
            : 'right',
        subType: typeof d.subType === 'string' ? d.subType : undefined,
        stretch,
        visible,
        description,
        sourceTimeframe,
      };
      return klItem;
    }

    if (isZoneOrBox) {
      const id =
        typeof d.id === 'string'
          ? d.id
          : `zone-${sourceTimeframe || 'common'}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`;
      const color = typeof d.color === 'string' ? d.color : '#0ea5e9';
      const borderStyle = d.borderStyle === 'dashed' ? 'dashed' : 'solid';

      return {
        id,
        type: rawType === 'box' ? 'box' : 'zone',
        color,
        fillColor: typeof d.fillColor === 'string' ? d.fillColor : undefined,
        borderColor:
          typeof d.borderColor === 'string' ? d.borderColor : undefined,
        borderWidth: typeof d.borderWidth === 'number' ? d.borderWidth : 1.5,
        borderStyle,
        element: group || elementName,
        group: group || elementName,
        displayName,
        fromTime:
          d.fromTime !== undefined
            ? normalizeTimestamp(d.fromTime as number | string)
            : undefined,
        toTime:
          d.toTime !== undefined
            ? normalizeTimestamp(d.toTime as number | string)
            : undefined,
        fromCandleIndex:
          typeof d.fromCandleIndex === 'number' ? d.fromCandleIndex : undefined,
        toCandleIndex:
          typeof d.toCandleIndex === 'number' ? d.toCandleIndex : undefined,
        topPrice: typeof d.topPrice === 'number' ? d.topPrice : undefined,
        bottomPrice:
          typeof d.bottomPrice === 'number' ? d.bottomPrice : undefined,
        paddingRatio:
          typeof d.paddingRatio === 'number' ? d.paddingRatio : undefined,
        paddingPrice:
          typeof d.paddingPrice === 'number' ? d.paddingPrice : undefined,
        label: typeof d.label === 'string' ? d.label.trim() : undefined,
        showLabel: d.showLabel !== undefined ? Boolean(d.showLabel) : true,
        labelColor: typeof d.labelColor === 'string' ? d.labelColor : undefined,
        labelFontSize:
          typeof d.labelFontSize === 'number' ? d.labelFontSize : undefined,
        stretch,
        visible,
        description:
          typeof d.description === 'string' ? d.description : undefined,
        sourceTimeframe,
      };
    }

    const id =
      typeof d.id === 'string'
        ? d.id
        : `line-${sourceTimeframe || 'common'}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`;
    const direction = normalizeLineDirection(
      d.direction,
      d.fromPrice ?? d.price1,
      d.toPrice ?? d.price2,
    );
    const color =
      typeof d.color === 'string'
        ? d.color
        : direction === 'up'
          ? '#10b981'
          : '#ef4444';

    const fromPrice: PriceOption = direction === 'up' ? 'low' : 'high';
    const toPrice: PriceOption = direction === 'up' ? 'high' : 'low';

    return {
      id,
      type: 'line',
      direction,
      color,
      element: group || elementName,
      group: group || elementName,
      displayName,
      fromTime:
        d.fromTime !== undefined
          ? normalizeTimestamp(d.fromTime as number | string)
          : undefined,
      toTime:
        d.toTime !== undefined
          ? normalizeTimestamp(d.toTime as number | string)
          : undefined,
      fromPrice,
      toPrice,
      fromCandleIndex:
        typeof d.fromCandleIndex === 'number' ? d.fromCandleIndex : undefined,
      toCandleIndex:
        typeof d.toCandleIndex === 'number' ? d.toCandleIndex : undefined,
      lineWidth: typeof d.lineWidth === 'number' ? d.lineWidth : 2,
      stretch,
      visible,
      description:
        typeof d.description === 'string' ? d.description : undefined,
      sourceTimeframe,
    };
  });
}

function extractDrawingsWithGroups(
  drawingsArray: unknown,
  groupsArray: unknown,
  sourceTimeframe?: string,
): Drawing[] {
  const result: Drawing[] = [];

  if (Array.isArray(drawingsArray)) {
    result.push(...normalizeDrawings(drawingsArray, sourceTimeframe));
  }

  if (Array.isArray(groupsArray)) {
    for (const g of groupsArray as Array<Record<string, unknown>>) {
      if (g && typeof g === 'object') {
        const groupName =
          typeof g.name === 'string' && g.name.trim() !== ''
            ? g.name.trim()
            : typeof g.id === 'string' && g.id.trim() !== ''
              ? g.id.trim()
              : undefined;
        const gDrawings = g.drawings || g.lines || g.zones || g.boxes;
        if (Array.isArray(gDrawings)) {
          result.push(
            ...normalizeDrawings(gDrawings, sourceTimeframe, groupName),
          );
        }
      }
    }
  }

  return result;
}

function extractCandlePois(
  candles: Candle[],
  timeframeKey?: string,
): PoiDrawing[] {
  const result: PoiDrawing[] = [];
  for (let ci = 0; ci < candles.length; ci++) {
    const c = candles[ci]!;
    const poiList = c.pois || c.keyLevels;
    if (poiList && Array.isArray(poiList)) {
      for (let ki = 0; ki < poiList.length; ki++) {
        const kl = poiList[ki]!;
        const color = kl.color || '#8a264c';
        const textVal =
          kl.text || kl.description || kl.displayName || kl.label || '';
        const descVal = kl.description || textVal;
        const elName = kl.displayName || descVal || textVal;

        result.push({
          id: `poi-${timeframeKey || 'c'}-${c.time}-${ki + 1}`,
          type: 'poi',
          color,
          fillColor: kl.fillColor,
          showBorder: kl.showBorder === true,
          borderColor: kl.borderColor || '#eab308',
          borderWidth: kl.borderWidth ?? 1,
          borderStyle: kl.borderStyle ?? 'solid',
          centerLineStyle: 'dashed',
          centerLineColor: kl.centerLineColor || kl.borderColor || '#eab308',
          centerLineWidth: 1,
          element: elName,
          group: elName,
          displayName: elName,
          description: descVal,
          fromTime: c.time,
          topPrice: kl.topPrice,
          bottomPrice: kl.bottomPrice,
          candleCount: kl.candleCount,
          targetCandleCount: kl.candleCount,
          isInfinite: kl.isInfinite ?? kl.candleCount === undefined,
          mode: kl.mode,
          text: textVal,
          label: textVal,
          showText: true,
          textColor: kl.textColor || '#fef08a',
          textFontSize: 11,
          textPosition: 'right',
          subType: kl.subType,
          sourceTimeframe: timeframeKey,
          visible: true,
          stretch: true,
        });
      }
    }
  }
  return result;
}

export function standardizeChartData(raw: unknown): ForexChartData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid JSON structure: expected an object.');
  }

  const rawObj = raw as Record<string, unknown>;
  const symbol =
    typeof rawObj.symbol === 'string'
      ? rawObj.symbol
      : typeof rawObj.pair === 'string'
        ? rawObj.pair
        : 'EUR/USD';
  const title =
    typeof rawObj.title === 'string'
      ? rawObj.title
      : `${symbol} Multi-Timeframe Chart`;
  const description =
    typeof rawObj.description === 'string' ? rawObj.description : '';
  const commonDrawings = extractDrawingsWithGroups(
    rawObj.commonDrawings ||
      rawObj.commonPois ||
      rawObj.commonZones ||
      rawObj.commonBoxes ||
      rawObj.commonKeyLevels ||
      rawObj.globalDrawings ||
      rawObj.drawings ||
      rawObj.pois ||
      rawObj.zones ||
      rawObj.boxes ||
      rawObj.keyLevels,
    rawObj.commonElements ||
      rawObj.elements ||
      rawObj.commonGroups ||
      rawObj.groups,
  );

  const timeframes: { [tf: string]: TimeframeData } = {};

  if (rawObj.timeframes && typeof rawObj.timeframes === 'object') {
    for (const [tfKey, tfVal] of Object.entries(
      rawObj.timeframes as Record<string, unknown>,
    )) {
      if (tfVal && typeof tfVal === 'object') {
        const tfObj = tfVal as Record<string, unknown>;
        if (Array.isArray(tfObj.candles)) {
          const normCandles = normalizeCandles(tfObj.candles);
          const rawDrawings = extractDrawingsWithGroups(
            tfObj.drawings ||
              tfObj.pois ||
              tfObj.lines ||
              tfObj.zones ||
              tfObj.boxes ||
              tfObj.keyLevels ||
              tfObj.key_levels,
            tfObj.elements || tfObj.groups,
            tfKey,
          );
          const embeddedDrawings = extractCandlePois(normCandles, tfKey);
          const deduplicatedEmbedded = embeddedDrawings.filter((emb) => {
            return !rawDrawings.some((raw) => {
              if (raw.type !== 'poi' && raw.type !== 'keyLevel') return false;
              const rawPoi = raw as PoiDrawing;
              const sameTime =
                rawPoi.fromTime !== undefined &&
                rawPoi.fromTime === emb.fromTime;
              const samePrice =
                Math.abs(rawPoi.topPrice - emb.topPrice) < 0.0001 &&
                Math.abs(rawPoi.bottomPrice - emb.bottomPrice) < 0.0001;
              return sameTime && samePrice;
            });
          });

          timeframes[tfKey] = {
            candles: normCandles,
            drawings: [...rawDrawings, ...deduplicatedEmbedded],
          };
        }
      }
    }
  } else if (Array.isArray(rawObj.candles)) {
    const normCandles = normalizeCandles(rawObj.candles);
    const rawDrawings = extractDrawingsWithGroups(
      rawObj.drawings ||
        rawObj.pois ||
        rawObj.zones ||
        rawObj.boxes ||
        rawObj.keyLevels ||
        rawObj.key_levels,
      rawObj.elements || rawObj.groups,
      'D1',
    );
    const embeddedDrawings = extractCandlePois(normCandles, 'D1');
    const deduplicatedEmbedded = embeddedDrawings.filter((emb) => {
      return !rawDrawings.some((raw) => {
        if (raw.type !== 'poi' && raw.type !== 'keyLevel') return false;
        const rawPoi = raw as PoiDrawing;
        const sameTime =
          rawPoi.fromTime !== undefined && rawPoi.fromTime === emb.fromTime;
        const samePrice =
          Math.abs(rawPoi.topPrice - emb.topPrice) < 0.0001 &&
          Math.abs(rawPoi.bottomPrice - emb.bottomPrice) < 0.0001;
        return sameTime && samePrice;
      });
    });

    timeframes['D1'] = {
      candles: normCandles,
      drawings: [...rawDrawings, ...deduplicatedEmbedded],
    };
  }

  const tfKeys = Object.keys(timeframes);
  if (tfKeys.length === 0) {
    throw new Error('No valid candlestick data found in the file.');
  }

  const defaultTimeframe =
    typeof rawObj.defaultTimeframe === 'string' &&
    timeframes[rawObj.defaultTimeframe]
      ? rawObj.defaultTimeframe
      : tfKeys[0];

  let timeframeUnits: Record<string, number> | undefined = undefined;
  if (rawObj.timeframeUnits && typeof rawObj.timeframeUnits === 'object') {
    timeframeUnits = {};
    for (const [k, v] of Object.entries(
      rawObj.timeframeUnits as Record<string, unknown>,
    )) {
      if (typeof v === 'number' && v > 0) {
        timeframeUnits[k] = v;
      }
    }
  }

  let timeframeConversions: TimeframeConversion[] | undefined = undefined;
  if (Array.isArray(rawObj.timeframeConversions)) {
    timeframeConversions = (
      rawObj.timeframeConversions as Array<Record<string, unknown>>
    )
      .filter(
        (c) =>
          typeof c.from === 'string' &&
          typeof c.to === 'string' &&
          typeof c.ratio === 'number',
      )
      .map((c) => ({
        from: c.from as string,
        to: c.to as string,
        ratio: Number(c.ratio),
      }));
  } else if (timeframeUnits) {
    const tfs = Object.keys(timeframeUnits);
    const derivedConversions: TimeframeConversion[] = [];
    for (let i = 0; i < tfs.length; i++) {
      for (let j = 0; j < tfs.length; j++) {
        if (i !== j) {
          const from = tfs[i]!;
          const to = tfs[j]!;
          const ratio = getTimeframeConversionRatio(from, to, timeframeUnits);
          if (ratio !== null) {
            derivedConversions.push({ from, to, ratio });
          }
        }
      }
    }
    if (derivedConversions.length > 0) {
      timeframeConversions = derivedConversions;
    }
  }

  const highestTf = tfKeys[0] || 'D1';
  for (const d of commonDrawings) {
    if (!d.sourceTimeframe) {
      d.sourceTimeframe = highestTf;
    }
  }

  return {
    symbol,
    title,
    description,
    timeframeUnits,
    timeframeConversions,
    commonDrawings,
    timeframes,
    defaultTimeframe,
  };
}

export async function decompressGzip(
  buffer: ArrayBuffer | Uint8Array,
): Promise<string> {
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  try {
    return pako.ungzip(uint8, { to: 'string' });
  } catch (pakoErr) {
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const stream = new Response(
          new Blob([uint8.buffer as ArrayBuffer]),
        ).body?.pipeThrough(new DecompressionStream('gzip'));
        if (stream) {
          const decompressedBuffer = await new Response(stream).arrayBuffer();
          return new TextDecoder().decode(decompressedBuffer);
        }
      } catch {
        throw new Error(
          `Gzip decompression failed: ${(pakoErr as Error).message}`,
        );
      }
    }
    throw pakoErr;
  }
}

export async function parseChartFile(file: File): Promise<{
  data: ForexChartData;
  fileInfo: {
    name: string;
    size: number;
    isGzip: boolean;
    originalSize?: number;
  };
}> {
  const isGzip = file.name.endsWith('.gz') || file.name.endsWith('.gzip');
  let jsonString = '';
  let originalSize = file.size;

  if (isGzip) {
    const arrayBuffer = await file.arrayBuffer();
    jsonString = await decompressGzip(arrayBuffer);
    originalSize = new Blob([jsonString]).size;
  } else {
    jsonString = await file.text();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error(`JSON Syntax Error: ${(e as Error).message}`);
  }

  return {
    data: standardizeChartData(parsed),
    fileInfo: {
      name: file.name,
      size: file.size,
      isGzip,
      originalSize,
    },
  };
}
