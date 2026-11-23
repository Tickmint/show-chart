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
  centerLineColor?: string;
  textColor?: string;
  subType?: string;
  description?: string;
  displayName?: string;
}

export type CandleKeyLevelConfig = CandlePoiConfig;

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
}

export type DrawingType = 'line' | 'box' | 'zone' | 'poi' | 'keyLevel';
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

export type Drawing = LineDrawing | ZoneDrawing | PoiDrawing;

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
