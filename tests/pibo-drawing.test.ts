import { describe, it, expect } from 'vitest';
import {
  canDisplayPiboOnTimeframe,
  resolvePiboLevels,
  resolvePiboBounds,
} from '../src/utils/timeframeService.js';
import {
  normalizeDrawings,
  standardizeChartData,
} from '../src/utils/fileParser.js';
import {
  isPiboDrawing,
  isFibonacciDrawing,
  type Candle,
  type PiboDrawing,
} from '../src/types/chart.js';
import { colorWithAlpha } from '../src/utils/canvasDrawing.js';

describe('Pibonacci (Fibonacci Retracement & Extension) Feature', () => {
  const sampleCandles: Candle[] = [
    { time: 1000, open: 1.07, high: 1.075, low: 1.068, close: 1.072 },
    { time: 1060, open: 1.072, high: 1.082, low: 1.071, close: 1.08 },
    { time: 1120, open: 1.08, high: 1.09, low: 1.079, close: 1.088 },
    { time: 1180, open: 1.088, high: 1.095, low: 1.085, close: 1.092 },
  ];

  describe('Test 1: JSON Parsing & Normalization', () => {
    it('should correctly parse Pibo drawing with start/end points, prices, levels and colored zones', () => {
      const raw = [
        {
          id: 'pibo-h4-1',
          type: 'pibo',
          fromTime: 1000,
          toTime: 1180,
          fromPrice: 1.07,
          toPrice: 1.09,
          startLevel: 0,
          endLevel: 1.618,
          zones: [
            {
              fromLevel: 0.618,
              toLevel: 0.8,
              color: 'red',
            },
          ],
          sourceTimeframe: 'H4',
        },
      ];

      const drawings = normalizeDrawings(raw, 'H4');
      expect(drawings).toHaveLength(1);
      const pibo = drawings[0] as PiboDrawing;

      expect(isPiboDrawing(pibo)).toBe(true);
      expect(isFibonacciDrawing(pibo)).toBe(true);
      expect(pibo.fromTime).toBe(1000);
      expect(pibo.toTime).toBe(1180);
      expect(pibo.fromPrice).toBe(1.07);
      expect(pibo.toPrice).toBe(1.09);
      expect(pibo.startLevel).toBe(0);
      expect(pibo.endLevel).toBe(1.618);
      expect(pibo.sourceTimeframe).toBe('H4');
      expect(pibo.exactTimeframeOnly).toBe(true);
      expect(pibo.visible).toBe(false);

      expect(pibo.zones).toHaveLength(1);
      expect(pibo.zones![0]!.fromLevel).toBe(0.618);
      expect(pibo.zones![0]!.toLevel).toBe(0.8);
      expect(pibo.zones![0]!.color).toBe('red');
    });

    it('should support alternative aliases (fibonacci, startTime, endTime, startPrice, endPrice, coloredZones)', () => {
      const raw = [
        {
          id: 'fib-1',
          type: 'fibonacci',
          startTime: 1000,
          endTime: 1180,
          startPrice: 'low',
          endPrice: 'high',
          minLevel: 0,
          maxLevel: 1,
          coloredZones: [
            {
              from: 0.618,
              to: 0.8,
              fillColor: '#ef4444',
              label: 'Golden Zone',
            },
          ],
        },
      ];

      const drawings = normalizeDrawings(raw, 'H1');
      expect(drawings).toHaveLength(1);
      const fib = drawings[0] as PiboDrawing;

      expect(fib.type).toBe('fibonacci');
      expect(fib.fromTime).toBe(1000);
      expect(fib.toTime).toBe(1180);
      expect(fib.fromPrice).toBe('low');
      expect(fib.toPrice).toBe('high');
      expect(fib.startLevel).toBe(0);
      expect(fib.endLevel).toBe(1);
      expect(fib.zones).toHaveLength(1);
      expect(fib.zones![0]!.fromLevel).toBe(0.618);
      expect(fib.zones![0]!.toLevel).toBe(0.8);
      expect(fib.zones![0]!.color).toBe('#ef4444');
      expect(fib.zones![0]!.label).toBe('Golden Zone');
    });
  });

  describe('Test 2: Exact Timeframe Rule ("ở đúng khung thời gian đã đặt cái Pibo đó")', () => {
    it('should allow display on the exact source timeframe and reject on other timeframes', () => {
      const piboH4: PiboDrawing = {
        id: 'pibo-h4',
        type: 'pibo',
        color: '#3b82f6',
        sourceTimeframe: 'H4',
        exactTimeframeOnly: true,
        fromPrice: 1.07,
        toPrice: 1.09,
      };

      expect(canDisplayPiboOnTimeframe(piboH4, 'H4')).toBe(true);

      expect(canDisplayPiboOnTimeframe(piboH4, 'H1')).toBe(false);
      expect(canDisplayPiboOnTimeframe(piboH4, 'M15')).toBe(false);
      expect(canDisplayPiboOnTimeframe(piboH4, 'M5')).toBe(false);

      expect(canDisplayPiboOnTimeframe(piboH4, 'D1')).toBe(false);
    });

    it('should allow common Pibo without sourceTimeframe on any timeframe', () => {
      const commonPibo: PiboDrawing = {
        id: 'common-pibo',
        type: 'pibo',
        color: '#3b82f6',
        fromPrice: 1.07,
        toPrice: 1.09,
      };

      expect(canDisplayPiboOnTimeframe(commonPibo, 'H4')).toBe(true);
      expect(canDisplayPiboOnTimeframe(commonPibo, 'H1')).toBe(true);
    });
  });

  describe('Test 3: Level & Price Calculations (0 -> 1 and 0 -> 1.618)', () => {
    it('should resolve standard Fibonacci levels for range 0 -> 1', () => {
      const levels = resolvePiboLevels(undefined, 0, 1);
      const ratioValues = levels.map((l) => l.level);

      expect(ratioValues).toContain(0);
      expect(ratioValues).toContain(0.236);
      expect(ratioValues).toContain(0.382);
      expect(ratioValues).toContain(0.5);
      expect(ratioValues).toContain(0.618);
      expect(ratioValues).toContain(0.786);
      expect(ratioValues).toContain(1);
      expect(ratioValues).not.toContain(1.618);
    });

    it('should resolve extension levels when endLevel is 1.618', () => {
      const levels = resolvePiboLevels(undefined, 0, 1.618);
      const ratioValues = levels.map((l) => l.level);

      expect(ratioValues).toContain(0);
      expect(ratioValues).toContain(0.618);
      expect(ratioValues).toContain(1);
      expect(ratioValues).toContain(1.272);
      expect(ratioValues).toContain(1.414);
      expect(ratioValues).toContain(1.618);
    });

    it('should compute exact price at each level in bullish trend', () => {
      const bounds = resolvePiboBounds({
        fromTime: 1000,
        toTime: 1180,
        fromPrice: 100,
        toPrice: 200,
        startLevel: 0,
        endLevel: 1.618,
        targetTimeframe: 'M1',
        targetCandles: sampleCandles,
      });

      expect(bounds).not.toBeNull();
      expect(bounds?.startPrice).toBe(100);
      expect(bounds?.endPrice).toBe(200);
      expect(bounds?.priceDiff).toBe(100);

      const levelMap = new Map(bounds?.levels.map((l) => [l.level, l.price]));
      expect(levelMap.get(0)).toBe(100);
      expect(levelMap.get(0.5)).toBe(150);
      expect(levelMap.get(0.618)).toBe(161.8);
      expect(levelMap.get(1)).toBe(200);
      expect(levelMap.get(1.618)).toBe(261.8);
    });

    it('should compute exact price at each level in bearish trend', () => {
      const bounds = resolvePiboBounds({
        fromTime: 1000,
        toTime: 1180,
        fromPrice: 200,
        toPrice: 100,
        startLevel: 0,
        endLevel: 1,
        targetTimeframe: 'M1',
        targetCandles: sampleCandles,
      });

      expect(bounds).not.toBeNull();
      expect(bounds?.startPrice).toBe(200);
      expect(bounds?.endPrice).toBe(100);
      expect(bounds?.priceDiff).toBe(-100);

      const levelMap = new Map(bounds?.levels.map((l) => [l.level, l.price]));
      expect(levelMap.get(0)).toBe(200);
      expect(levelMap.get(0.5)).toBe(150);
      expect(levelMap.get(0.618)).toBe(138.2);
      expect(levelMap.get(1)).toBe(100);
    });
  });

  describe('Test 4: Highlight Zones Calculation (e.g. 0.618 -> 0.8 tô màu đỏ)', () => {
    it('should compute bounds and prices for highlighted zones', () => {
      const bounds = resolvePiboBounds({
        fromTime: 1000,
        toTime: 1180,
        fromPrice: 1.0,
        toPrice: 2.0,
        zones: [
          {
            fromLevel: 0.618,
            toLevel: 0.8,
            color: 'red',
          },
        ],
        targetTimeframe: 'M1',
        targetCandles: sampleCandles,
      });

      expect(bounds).not.toBeNull();
      expect(bounds?.zones).toHaveLength(1);

      const zone = bounds!.zones[0]!;
      expect(zone.fromLevel).toBe(0.618);
      expect(zone.toLevel).toBe(0.8);
      expect(zone.fromPrice).toBe(1.618);
      expect(zone.toPrice).toBe(1.8);
      expect(zone.topPrice).toBe(1.8);
      expect(zone.bottomPrice).toBe(1.618);
      expect(zone.color).toBe('red');
    });

    it('should only include start level, end level, and marked zone levels when zones are specified', () => {
      const bounds = resolvePiboBounds({
        fromTime: 1000,
        toTime: 1180,
        fromPrice: 1.0,
        toPrice: 2.0,
        startLevel: 0,
        endLevel: 1,
        zones: [
          {
            fromLevel: 0.618,
            toLevel: 0.8,
            color: 'red',
          },
        ],
        targetTimeframe: 'M1',
        targetCandles: sampleCandles,
      });

      const levelRatios = bounds?.levels.map((l) => l.level);
      expect(levelRatios).toEqual([0, 0.618, 0.8, 1]);
      expect(levelRatios).not.toContain(0.236);
      expect(levelRatios).not.toContain(0.382);
      expect(levelRatios).not.toContain(0.5);
      expect(levelRatios).not.toContain(0.786);
    });

    it('should handle bearish zones where fromPrice is higher than toPrice', () => {
      const bounds = resolvePiboBounds({
        fromTime: 1000,
        toTime: 1180,
        fromPrice: 2.0,
        toPrice: 1.0,
        zones: [
          {
            fromLevel: 0.618,
            toLevel: 0.8,
            color: '#ef4444',
          },
        ],
        targetTimeframe: 'M1',
        targetCandles: sampleCandles,
      });

      expect(bounds).not.toBeNull();
      const zone = bounds!.zones[0]!;

      expect(zone.fromPrice).toBe(1.382);
      expect(zone.toPrice).toBe(1.2);
      expect(zone.topPrice).toBe(1.382);
      expect(zone.bottomPrice).toBe(1.2);
      expect(zone.color).toBe('#ef4444');
    });

    it('should correctly format named CSS colors like red to soft transparent rgba', () => {
      expect(colorWithAlpha('red', 0.1)).toBe('rgba(239, 68, 68, 0.1)');
      expect(colorWithAlpha('green', 0.12)).toBe('rgba(16, 185, 129, 0.12)');
      expect(colorWithAlpha('blue', 0.2)).toBe('rgba(59, 130, 246, 0.2)');
    });
  });

  describe('Test 5: Full Chart Data File Integration', () => {
    it('should parse chart file containing Pibo in timeframe drawings', () => {
      const rawChartJson = {
        symbol: 'EUR/USD',
        timeframes: {
          H4: {
            candles: [
              { time: 1000, open: 1.07, high: 1.075, low: 1.068, close: 1.072 },
              { time: 2000, open: 1.072, high: 1.082, low: 1.071, close: 1.08 },
            ],
            drawings: [
              {
                id: 'h4-pibo',
                type: 'pibo',
                fromTime: 1000,
                toTime: 2000,
                fromPrice: 1.07,
                toPrice: 1.08,
                startLevel: 0,
                endLevel: 1.618,
                zones: [
                  {
                    fromLevel: 0.618,
                    toLevel: 0.8,
                    color: 'red',
                  },
                ],
              },
            ],
          },
        },
      };

      const chartData = standardizeChartData(rawChartJson);
      const h4Drawings = chartData.timeframes['H4']?.drawings || [];

      expect(h4Drawings).toHaveLength(1);
      const pibo = h4Drawings[0] as PiboDrawing;

      expect(isPiboDrawing(pibo)).toBe(true);
      expect(pibo.sourceTimeframe).toBe('H4');
      expect(pibo.exactTimeframeOnly).toBe(true);
      expect(pibo.visible).toBe(false);
      expect(pibo.zones).toHaveLength(1);
      expect(pibo.zones![0]!.color).toBe('red');
    });
  });

  describe('Test 6: Distinct Bar Color and Zone Color Support', () => {
    it('should support distinct lineColor (bar color) and zoneColor (marked zone)', () => {
      const raw = [
        {
          id: 'pibo-custom-colors',
          type: 'pibo',
          fromTime: 1000,
          toTime: 1180,
          fromPrice: 1.07,
          toPrice: 1.09,
          startLevel: 0,
          endLevel: 1,
          lineColor: '#38bdf8',
          zoneColor: '#ef4444',
          zones: [
            {
              fromLevel: 0.618,
              toLevel: 0.8,
            },
          ],
          sourceTimeframe: 'M5',
        },
      ];

      const drawings = normalizeDrawings(raw, 'M5');
      expect(drawings).toHaveLength(1);
      const pibo = drawings[0] as PiboDrawing;

      expect(pibo.lineColor).toBe('#38bdf8');
      expect(pibo.color).toBe('#38bdf8');
      expect(pibo.barColor).toBe('#38bdf8');
      expect(pibo.zoneColor).toBe('#ef4444');
      expect(pibo.zones).toHaveLength(1);
      expect(pibo.zones![0]!.color).toBe('#ef4444');
      expect(pibo.zones![0]!.showLabel).toBe(false);
    });

    it('should auto-create default zone if only zoneColor is given without raw zones array', () => {
      const raw = [
        {
          id: 'pibo-auto-zone',
          type: 'pibo',
          fromTime: 1000,
          toTime: 1180,
          fromPrice: 1.07,
          toPrice: 1.09,
          lineColor: '#fb7185',
          zoneColor: '#ef4444',
          sourceTimeframe: 'M1',
        },
      ];

      const drawings = normalizeDrawings(raw, 'M1');
      expect(drawings).toHaveLength(1);
      const pibo = drawings[0] as PiboDrawing;

      expect(pibo.lineColor).toBe('#fb7185');
      expect(pibo.zoneColor).toBe('#ef4444');
      expect(pibo.zones).toHaveLength(1);
      expect(pibo.zones![0]!.fromLevel).toBe(0.618);
      expect(pibo.zones![0]!.toLevel).toBe(0.8);
      expect(pibo.zones![0]!.color).toBe('#ef4444');
    });
  });
});
