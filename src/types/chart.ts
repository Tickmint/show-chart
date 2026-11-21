export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type DrawingType = 'line';
export type PriceOption = 'high' | 'low' | number;
export type LineDirection = 'up' | 'down';

export interface LineDrawing {
  id: string;
  type: 'line';
  direction: LineDirection;
  color: string;
  fromTime?: number | string;
  toTime?: number | string;
  fromPrice?: PriceOption;
  toPrice?: PriceOption;
  fromCandleIndex?: number;
  toCandleIndex?: number;
  lineWidth?: number;

  stretch?: boolean;
  visible?: boolean;
  description?: string;
  sourceTimeframe?: string;
}

export type Drawing = LineDrawing;

export interface TimeframeData {
  candles: Candle[];
  drawings?: Drawing[];
}

export interface ForexChartData {
  symbol?: string;
  title?: string;
  description?: string;
  commonDrawings?: Drawing[];
  timeframes: {
    [timeframeKey: string]: TimeframeData;
  };
  defaultTimeframe?: string;
}

export interface OHLCData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change?: number;
  changePercent?: number;
}
