export interface CandlePoiConfig {
  topPrice: number;
  bottomPrice: number;
  candleCount?: number;
  targetCandleCount?: number;
  isInfinite?: boolean;
  mode?: 'infinite' | 'finite';
  text?: string;
  label?: string;
  color?: string;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed';
  showBorder?: boolean;
  showCenterLine?: boolean;
  centerLineStyle?: 'dashed' | 'solid' | 'none';
  centerLineColor?: string;
  textColor?: string;
  subType?: string;
  description?: string;
  displayName?: string;
}

export type CandleKeyLevelConfig = CandlePoiConfig;

export interface CandleNewsItem {
  id?: string;
  title: string;
  description?: string;
  time?: number;
  impact?: 'high' | 'medium' | 'low' | string;
  source?: string;
}

export interface CandleLabelConfig {
  id?: string;
  text: string;
  title?: string;
  color?: string;
  textColor?: string;
  borderColor?: string;
  visible?: boolean;
  pointPrice?: 'high' | 'low' | number;
  position?: 'above' | 'below' | 'auto';
  fontSize?: number;
  element?: string;
  group?: string;
  timeframe?: string;
  sourceTimeframe?: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  pois?: CandlePoiConfig[];
  poi?: CandlePoiConfig;
  keyLevels?: CandlePoiConfig[];
  keyLevel?: CandlePoiConfig;
  news?: CandleNewsItem[];
  labels?: CandleLabelConfig[];
  label?: CandleLabelConfig;
  timeframe?: string;
  sourceTimeframe?: string;
}

export type DrawingType =
  'line' | 'box' | 'zone' | 'poi' | 'keyLevel' | 'pibo' | 'fibonacci';
export type PriceOption = 'high' | 'low' | 'open' | 'close' | number;
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

export interface PoiDrawing extends BaseDrawing {
  type: 'poi' | 'keyLevel';
  mode?: 'infinite' | 'finite';
  isInfinite?: boolean;
  candleCount?: number;
  targetCandleCount?: number;
  topPrice: number;
  bottomPrice: number;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed';
  showBorder?: boolean;
  showCenterLine?: boolean;
  centerLineStyle?: 'dashed' | 'solid' | 'none';
  centerLineColor?: string;
  centerLineWidth?: number;
  text?: string;
  label?: string;
  showText?: boolean;
  textColor?: string;
  textFontSize?: number;
  textPosition?: 'right' | 'left' | 'center';
  subType?: string;
}

export type KeyLevelDrawing = PoiDrawing;

export interface PiboLevelConfig {
  level: number;
  color?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  lineWidth?: number;
  label?: string;
}

export interface PiboZone {
  fromLevel: number;
  toLevel: number;
  color?: string;
  fillColor?: string;
  opacity?: number;
  label?: string;
  showLabel?: boolean;
}

export type FibonacciZone = PiboZone;

export interface PiboDrawing extends BaseDrawing {
  type: 'pibo' | 'fibonacci';
  lineColor?: string;
  barColor?: string;
  zoneColor?: string;
  fromPrice?: PriceOption;
  toPrice?: PriceOption;
  startLevel?: number;
  endLevel?: number;
  levels?: (number | PiboLevelConfig)[];
  zones?: PiboZone[];
  showTrendLine?: boolean;
  trendLineColor?: string;
  trendLineStyle?: 'solid' | 'dashed';
  lineWidth?: number;
  extendRight?: boolean;
  extendLeft?: boolean;
  showLabels?: boolean;
  labelPosition?: 'left' | 'right' | 'center';
  exactTimeframeOnly?: boolean;
}

export type FibonacciDrawing = PiboDrawing;

export type Drawing = LineDrawing | ZoneDrawing | PoiDrawing | PiboDrawing;

export function isLineDrawing(drawing: Drawing): drawing is LineDrawing {
  return drawing.type === 'line';
}

export function isZoneDrawing(drawing: Drawing): drawing is ZoneDrawing {
  return drawing.type === 'box' || drawing.type === 'zone';
}

export function isPoiDrawing(drawing: Drawing): drawing is PoiDrawing {
  return drawing.type === 'poi' || drawing.type === 'keyLevel';
}

export function isKeyLevelDrawing(
  drawing: Drawing,
): drawing is KeyLevelDrawing {
  return isPoiDrawing(drawing);
}

export function isPiboDrawing(drawing: Drawing): drawing is PiboDrawing {
  return drawing.type === 'pibo' || drawing.type === 'fibonacci';
}

export const isFibonacciDrawing = isPiboDrawing;

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
  group?: string;
  category?: string;
  description?: string;
  timeframeUnits?: Record<string, number>;
  timeframeConversions?: TimeframeConversion[];
  commonDrawings?: Drawing[];
  timeframes: {
    [timeframeKey: string]: TimeframeData;
  };
  defaultTimeframe?: string;
}

export interface ChartCase {
  id: string;
  name: string;
  title?: string;
  group?: string;
  filename: string;
  data: ForexChartData;
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
