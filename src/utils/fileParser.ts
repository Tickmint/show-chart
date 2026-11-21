import pako from 'pako';
import { ForexChartData, Candle, LineDrawing, TimeframeData, LineDirection, PriceOption } from '../types/chart';

/**
 * Normalizes any timestamp to Unix epoch seconds
 */
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

/**
 * Normalizes candle array: ensures valid numeric OHLC values and sorted by time ascending
 */
export function normalizeCandles(rawCandles: any[]): Candle[] {
  if (!Array.isArray(rawCandles)) return [];

  const candles: Candle[] = rawCandles
    .map((c) => {
      const time = normalizeTimestamp(c.time ?? c.date ?? c.timestamp ?? c.t);
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
    if (i === 0 || candles[i].time !== candles[i - 1].time) {
      uniqueCandles.push(candles[i]);
    }
  }

  return uniqueCandles;
}

/**
 * Normalizes line direction: only 'up' or 'down' are allowed
 * - 'up' (Chiều tăng): Nối từ đáy (Low) nến đầu đến đỉnh (High) nến cuối
 * - 'down' (Chiều giảm): Nối từ đỉnh (High) nến đầu đến đáy (Low) nến cuối
 */
export function normalizeLineDirection(val: any, fromPrice?: any, toPrice?: any): LineDirection {
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'down' || s === 'giam' || s === 'bearish' || s === 'fall') return 'down';
    if (s === 'up' || s === 'tang' || s === 'bullish' || s === 'rise') return 'up';
  }

  // Deduce from fromPrice / toPrice if direction is not explicitly set
  if (typeof fromPrice === 'string' && fromPrice.toLowerCase() === 'high') {
    return 'down';
  }
  return 'up';
}

/**
 * Normalizes line drawings: ensures IDs, direction ('up' | 'down'), valid colors, and normalized timestamps
 */
export function normalizeDrawings(rawDrawings: any[], sourceTimeframe?: string): LineDrawing[] {
  if (!Array.isArray(rawDrawings)) return [];

  return rawDrawings.map((d, index) => {
    const id = d.id || `line-${sourceTimeframe || 'common'}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`;
    const direction = normalizeLineDirection(d.direction, d.fromPrice ?? d.price1, d.toPrice ?? d.price2);
    const color = d.color || (direction === 'up' ? '#10b981' : '#ef4444');
    const stretch = d.stretch !== undefined ? Boolean(d.stretch) : true;
    const visible = d.visible !== undefined ? Boolean(d.visible) : true;

    // Chiều tăng: đáy nến đầu (low) -> đỉnh nến cuối (high)
    // Chiều giảm: đỉnh nến đầu (high) -> đáy nến cuối (low)
    const fromPrice: PriceOption = direction === 'up' ? 'low' : 'high';
    const toPrice: PriceOption = direction === 'up' ? 'high' : 'low';

    return {
      id,
      type: 'line',
      direction,
      color,
      fromTime: d.fromTime !== undefined ? normalizeTimestamp(d.fromTime) : undefined,
      toTime: d.toTime !== undefined ? normalizeTimestamp(d.toTime) : undefined,
      fromPrice,
      toPrice,
      fromCandleIndex: d.fromCandleIndex,
      toCandleIndex: d.toCandleIndex,
      lineWidth: d.lineWidth ?? 2,
      stretch,
      visible,
      description: d.description,
      sourceTimeframe,
    };
  });
}

/**
 * Standardizes parsed JSON data into full ForexChartData
 */
export function standardizeChartData(raw: any): ForexChartData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid JSON structure: expected an object.');
  }

  const symbol = raw.symbol || raw.pair || 'EUR/USD';
  const title = raw.title || `${symbol} Multi-Timeframe Chart`;
  const description = raw.description || '';
  const commonDrawings = normalizeDrawings(raw.commonDrawings || raw.globalDrawings || []);

  const timeframes: { [tf: string]: TimeframeData } = {};

  if (raw.timeframes && typeof raw.timeframes === 'object') {
    for (const [tfKey, tfVal] of Object.entries(raw.timeframes as Record<string, any>)) {
      if (tfVal && Array.isArray(tfVal.candles)) {
        timeframes[tfKey] = {
          candles: normalizeCandles(tfVal.candles),
          drawings: normalizeDrawings(tfVal.drawings || [], tfKey),
        };
      }
    }
  } else if (Array.isArray(raw.candles)) {
    timeframes['D1'] = {
      candles: normalizeCandles(raw.candles),
      drawings: normalizeDrawings(raw.drawings || [], 'D1'),
    };
  }

  const tfKeys = Object.keys(timeframes);
  if (tfKeys.length === 0) {
    throw new Error('No valid candlestick data found in the file.');
  }

  const defaultTimeframe = raw.defaultTimeframe && timeframes[raw.defaultTimeframe]
    ? raw.defaultTimeframe
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

/**
 * Decompresses GZIP binary buffer or string using pako with fallback
 */
export async function decompressGzip(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  try {
    return pako.ungzip(uint8, { to: 'string' });
  } catch (pakoErr) {
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const stream = new Response(new Blob([uint8 as any])).body?.pipeThrough(new DecompressionStream('gzip'));
        if (stream) {
          const decompressedBuffer = await new Response(stream).arrayBuffer();
          return new TextDecoder().decode(decompressedBuffer);
        }
      } catch (streamErr) {
        throw new Error(`Gzip decompression failed: ${(pakoErr as Error).message}`);
      }
    }
    throw pakoErr;
  }
}

/**
 * Parses uploaded File (.json, .gz, .json.gz) into ForexChartData
 */
export async function parseChartFile(file: File): Promise<{
  data: ForexChartData;
  fileInfo: { name: string; size: number; isGzip: boolean; originalSize?: number };
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

  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error(`JSON Syntax Error: ${(e as Error).message}`);
  }

  const chartData = standardizeChartData(parsed);

  return {
    data: chartData,
    fileInfo: {
      name: file.name,
      size: file.size,
      isGzip,
      originalSize,
    },
  };
}

/**
 * Exports ForexChartData to downloadable .json or .json.gz file
 */
export function exportChartData(data: ForexChartData, asGzip = false, filename = 'forex_data'): void {
  const jsonString = JSON.stringify(data, null, 2);

  if (asGzip) {
    const compressed = pako.gzip(jsonString);
    const blob = new Blob([compressed], { type: 'application/gzip' });
    downloadBlob(blob, `${filename}.json.gz`);
  } else {
    const blob = new Blob([jsonString], { type: 'application/json' });
    downloadBlob(blob, `${filename}.json`);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
