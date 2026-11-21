import pako from 'pako';
import {
  type ForexChartData,
  type Candle,
  type LineDrawing,
  type TimeframeData,
  type LineDirection,
  type PriceOption,
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
): LineDrawing[] {
  if (!Array.isArray(rawDrawings)) return [];

  return (rawDrawings as Array<Record<string, unknown>>).map((d, index) => {
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
    const stretch = d.stretch !== undefined ? Boolean(d.stretch) : true;
    const visible = d.visible !== undefined ? Boolean(d.visible) : true;

    const fromPrice: PriceOption = direction === 'up' ? 'low' : 'high';
    const toPrice: PriceOption = direction === 'up' ? 'high' : 'low';

    return {
      id,
      type: 'line',
      direction,
      color,
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
  const commonDrawings = normalizeDrawings(
    (rawObj.commonDrawings || rawObj.globalDrawings || []) as unknown[],
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
            drawings: normalizeDrawings(
              (tfObj.drawings || []) as unknown[],
              tfKey,
            ),
          };
        }
      }
    }
  } else if (Array.isArray(rawObj.candles)) {
    timeframes['D1'] = {
      candles: normalizeCandles(rawObj.candles),
      drawings: normalizeDrawings((rawObj.drawings || []) as unknown[], 'D1'),
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

  return {
    symbol,
    title,
    description,
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
