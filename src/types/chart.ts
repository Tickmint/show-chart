export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export type DrawingType = 'line';
export type PriceOption = 'high' | 'low' | number;
export type LineDirection = 'up' | 'down';

/**
 * Đường thẳng (Line) chỉ có 2 chiều: Tăng hoặc Giảm.
 * - 'up' (Chiều tăng): Nối từ đáy (Low) của cây nến đầu tiên đến đỉnh (High) của cây nến cuối cùng.
 * - 'down' (Chiều giảm): Nối từ đỉnh (High) của cây nến đầu tiên đến đáy (Low) của cây nến cuối cùng.
 * Co giãn chính xác theo thứ tự nến khi sang các khung thời gian khác nhau (TradingView style).
 */
export interface LineDrawing {
  id: string;
  type: 'line';
  direction: LineDirection; // 'up' | 'down'
  color: string; // Stroke color of the line
  fromTime?: number | string;
  toTime?: number | string;
  fromPrice?: PriceOption; // 'low' | 'high' (tự động suy ra từ direction)
  toPrice?: PriceOption;   // 'high' | 'low' (tự động suy ra từ direction)
  fromCandleIndex?: number;
  toCandleIndex?: number;
  lineWidth?: number;
  /**
   * If true, this line stretches and adapts dynamically across different timeframes
   * (e.g. from H4 to H1 to M15, following the exact candle sequence like TradingView).
   * If false, it only displays on its native timeframe.
   */
  stretch?: boolean;
  visible?: boolean;
  description?: string;
  sourceTimeframe?: string;
}

export type Drawing = LineDrawing;

export interface TimeframeData {
  candles: Candle[];
  drawings?: Drawing[]; // Hình vẽ riêng (đặt bên trong từng khung thời gian)
}

export interface ForexChartData {
  symbol?: string;
  title?: string;
  description?: string;
  commonDrawings?: Drawing[]; // Hình vẽ chung (đặt bên ngoài)
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
