export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type DrawingType = 'line' | 'box' | 'zone';
export type PriceOption = 'high' | 'low' | number;
export type LineDirection = 'up' | 'down';

export interface BaseDrawing {
  id: string;
  color: string;
  element?: string;
  group?: string;
  displayName?: string;
  fromTime?: number | string;
  toTime?: number | string;
  fromCandleIndex?: number;
  toCandleIndex?: number;
  stretch?: boolean;
  visible?: boolean;
  description?: string;
  sourceTimeframe?: string;
}

export interface LineDrawing extends BaseDrawing {
  type: 'line';
  direction: LineDirection;
  fromPrice?: PriceOption;
  toPrice?: PriceOption;
  lineWidth?: number;
}

export interface ZoneDrawing extends BaseDrawing {
  type: 'box' | 'zone';
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed';
  topPrice?: number;
  bottomPrice?: number;
  paddingRatio?: number;
  paddingPrice?: number;
  label?: string;
  showLabel?: boolean;
  labelColor?: string;
  labelFontSize?: number;
}

export type BoxDrawing = ZoneDrawing;

export type Drawing = LineDrawing | ZoneDrawing;

export function isLineDrawing(drawing: Drawing): drawing is LineDrawing {
  return drawing.type === 'line';
}

export function isZoneDrawing(drawing: Drawing): drawing is ZoneDrawing {
  return drawing.type === 'box' || drawing.type === 'zone';
}

export interface ChartElement {
  id: string;
  name: string;
  displayName?: string;
  color: string;
  sourceTimeframe?: string;
  drawings: Drawing[];
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
