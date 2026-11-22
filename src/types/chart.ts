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
  element?: string;
  group?: string;
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

export interface ChartElement {
  id: string;
  name: string;
  color: string;
  sourceTimeframe?: string;
  drawings: LineDrawing[];
  colors: string[];
}

export type DrawingGroup = ChartElement;

export interface TimeframeConversion {
  from: string;
  to: string;
  ratio: number;
}

export interface TimeframeData {
  candles: Candle[];
  drawings?: Drawing[];
}

export interface ForexChartData {
  symbol?: string;
  title?: string;
  description?: string;
  timeframeUnits?: Record<string, number>;
  timeframeConversions?: TimeframeConversion[];
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
