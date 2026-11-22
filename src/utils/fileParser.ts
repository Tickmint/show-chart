import pako from 'pako';
import {
  type ForexChartData,
  type Candle,
  type Drawing,
  type TimeframeData,
  type LineDirection,
  type PriceOption,
  type TimeframeConversion,
} from '../types/chart.js';

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
      return { time, open, high, low, close };
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
    const isZoneOrBox =
      rawType === 'box' ||
      rawType === 'zone' ||
      rawType === 'rectangle' ||
      rawType === 'range' ||
      d.topPrice !== undefined ||
      d.bottomPrice !== undefined;

    const stretch = d.stretch !== undefined ? Boolean(d.stretch) : true;
    const visible = d.visible !== undefined ? Boolean(d.visible) : true;

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
          : typeof d.group === 'string' && d.group.trim() !== ''
            ? d.group.trim()
            : typeof d.groupId === 'string' && d.groupId.trim() !== ''
              ? d.groupId.trim()
              : typeof d.groupName === 'string' && d.groupName.trim() !== ''
                ? d.groupName.trim()
                : defaultGroup ||
                  (sourceTimeframe
                    ? `Timeframe ${sourceTimeframe}`
                    : 'Common'));

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
        element: elementName,
        group: elementName,
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
      element: elementName,
      group: elementName,
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
      rawObj.commonZones ||
      rawObj.commonBoxes ||
      rawObj.globalDrawings ||
      rawObj.drawings ||
      rawObj.zones ||
      rawObj.boxes,
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
          timeframes[tfKey] = {
            candles: normalizeCandles(tfObj.candles),
            drawings: extractDrawingsWithGroups(
              tfObj.drawings || tfObj.lines || tfObj.zones || tfObj.boxes,
              tfObj.elements || tfObj.groups,
              tfKey,
            ),
          };
        }
      }
    }
  } else if (Array.isArray(rawObj.candles)) {
    timeframes['D1'] = {
      candles: normalizeCandles(rawObj.candles),
      drawings: extractDrawingsWithGroups(
        rawObj.drawings || rawObj.zones || rawObj.boxes,
        rawObj.elements || rawObj.groups,
        'D1',
      ),
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
