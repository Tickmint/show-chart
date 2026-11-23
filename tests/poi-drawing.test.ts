import { describe, it, expect, vi } from 'vitest';
import {
  canInheritDrawing,
  resolveKeyLevelBounds,
  resolvePoiBounds,
} from '../src/utils/timeframeService.js';
import {
  normalizeCandles,
  normalizeDrawings,
  standardizeChartData,
} from '../src/utils/fileParser.js';
import {
  computeKeyLevelTextLayout,
  renderPoi,
} from '../src/utils/canvasDrawing.js';
import type {
  Candle,
  KeyLevelDrawing,
  PoiDrawing,
} from '../src/types/chart.js';
import { isPoiDrawing, isKeyLevelDrawing } from '../src/types/chart.js';

describe('POI Block Drawing Feature (Key Level, Imbalance, POI - Infinite, Finite, Multi-Timeframe Expansion/Contraction & Candle Clearance)', () => {
  const m2Candles: Candle[] = [
    { time: 0, open: 1.082, high: 1.085, low: 1.081, close: 1.084 },
    { time: 120, open: 1.084, high: 1.092, low: 1.083, close: 1.087 },
    { time: 240, open: 1.087, high: 1.086, low: 1.078, close: 1.081 },
    { time: 360, open: 1.081, high: 1.084, low: 1.08, close: 1.083 },
    { time: 480, open: 1.083, high: 1.088, low: 1.082, close: 1.085 },
    { time: 600, open: 1.085, high: 1.089, low: 1.084, close: 1.086 },
    { time: 720, open: 1.086, high: 1.09, low: 1.085, close: 1.088 },
    { time: 840, open: 1.088, high: 1.091, low: 1.087, close: 1.09 },
    { time: 960, open: 1.09, high: 1.093, low: 1.089, close: 1.091 },
    { time: 1080, open: 1.091, high: 1.094, low: 1.09, close: 1.093 },
    { time: 1200, open: 1.093, high: 1.095, low: 1.092, close: 1.094 },
  ];

  const m5Candles: Candle[] = [
    { time: 0, open: 1.082, high: 1.092, low: 1.078, close: 1.083 },
    { time: 300, open: 1.083, high: 1.088, low: 1.08, close: 1.085 },
    { time: 600, open: 1.085, high: 1.09, low: 1.084, close: 1.088 },
    { time: 900, open: 1.088, high: 1.094, low: 1.087, close: 1.093 },
    { time: 1200, open: 1.093, high: 1.095, low: 1.092, close: 1.094 },
  ];

  describe('Test 1: Form 1 - Vô hạn (Infinite Key Level)', () => {
    it('should correctly resolve infinite Key Level with start candle and price bounds', () => {
      const bounds = resolveKeyLevelBounds({
        fromTime: 120,
        topPrice: 1.092,
        bottomPrice: 1.089,
        isInfinite: true,
        sourceTimeframe: 'M2',
        targetTimeframe: 'M2',
        targetCandles: m2Candles,
      });

      expect(bounds).not.toBeNull();
      expect(bounds?.isInfinite).toBe(true);
      expect(bounds?.startTime).toBe(120);
      expect(bounds?.startCandle.time).toBe(120);
      expect(bounds?.topPrice).toBe(1.092);
      expect(bounds?.bottomPrice).toBe(1.089);
      expect(bounds?.midPrice).toBeCloseTo(1.0905, 5);
      expect(bounds?.endTime).toBeUndefined();
      expect(bounds?.effectiveCandleCount).toBeUndefined();
    });

    it('should default to infinite when candleCount is omitted and mode is not finite', () => {
      const bounds = resolvePoiBounds({
        fromTime: 0,
        topPrice: 1.095,
        bottomPrice: 1.091,
        sourceTimeframe: 'M5',
        targetTimeframe: 'M5',
        targetCandles: m5Candles,
      });

      expect(bounds).not.toBeNull();
      expect(bounds?.isInfinite).toBe(true);
    });
  });

  describe('Test 2: Form 2 - Có hạn (Finite Key Level with Target Candle Count)', () => {
    it('should correctly resolve finite Key Level with candleCount', () => {
      const bounds = resolveKeyLevelBounds({
        fromTime: 0,
        topPrice: 1.092,
        bottomPrice: 1.088,
        candleCount: 5,
        sourceTimeframe: 'M2',
        targetTimeframe: 'M2',
        targetCandles: m2Candles,
      });

      expect(bounds).not.toBeNull();
      expect(bounds?.isInfinite).toBe(false);
      expect(bounds?.candleCount).toBe(5);
      expect(bounds?.effectiveCandleCount).toBe(5);
      expect(bounds?.startTime).toBe(0);
      expect(bounds?.endTime).toBe(600);
      expect(bounds?.endCandle?.time).toBe(600);
    });
  });

  describe('Test 3: Multi-Timeframe Expansion ("Nở ra") & Contraction ("Co lại")', () => {
    it('should DISALLOW ("không hiện") when moving from lower timeframe to higher timeframe (M2 -> M5)', () => {
      const boundsM5 = resolveKeyLevelBounds({
        fromTime: 0,
        topPrice: 1.092,
        bottomPrice: 1.088,
        candleCount: 10,
        sourceTimeframe: 'M2',
        targetTimeframe: 'M5',
        targetCandles: m5Candles,
      });

      expect(boundsM5).toBeNull();
    });

    it('should EXPAND ("nở ra") when moving from higher timeframe to lower timeframe (M5 -> M2)', () => {
      const boundsM5 = resolveKeyLevelBounds({
        fromTime: 0,
        topPrice: 1.092,
        bottomPrice: 1.088,
        candleCount: 4,
        sourceTimeframe: 'M5',
        targetTimeframe: 'M5',
        targetCandles: m5Candles,
      });
      expect(boundsM5?.effectiveCandleCount).toBe(4);

      const boundsM2 = resolveKeyLevelBounds({
        fromTime: 0,
        topPrice: 1.092,
        bottomPrice: 1.088,
        candleCount: 4,
        sourceTimeframe: 'M5',
        targetTimeframe: 'M2',
        targetCandles: m2Candles,
      });

      expect(boundsM2).not.toBeNull();
      expect(boundsM2?.effectiveCandleCount).toBe(10);
      expect(boundsM2!.effectiveCandleCount!).toBeGreaterThan(
        boundsM5!.effectiveCandleCount!,
      );
      expect(boundsM2?.startTime).toBe(0);
      expect(boundsM2?.endTime).toBe(1200);
    });

    it('should handle non-divisible timeframes (M5 to M2 with ratio 2.5)', () => {
      const bounds = resolveKeyLevelBounds({
        fromTime: 0,
        topPrice: 1.09,
        bottomPrice: 1.085,
        candleCount: 5,
        sourceTimeframe: 'M5',
        targetTimeframe: 'M2',
        targetCandles: m2Candles,
      });

      expect(bounds).not.toBeNull();
      expect(bounds?.effectiveCandleCount).toBe(12.5);
    });

    it('should strictly enforce 1-way downward inheritance for Key Levels / POIs (lower timeframe does not appear on higher timeframe)', () => {
      const klDrawing: KeyLevelDrawing = {
        id: 'kl-1',
        type: 'keyLevel',
        color: '#e11d48',
        topPrice: 1.092,
        bottomPrice: 1.089,
        sourceTimeframe: 'M2',
      };

      expect(canInheritDrawing(klDrawing, 'M1')).toBe(true);
      expect(canInheritDrawing(klDrawing, 'M5')).toBe(false);
      expect(canInheritDrawing(klDrawing, 'H1')).toBe(false);
    });
  });

  describe('Test 4: Candle-Embedded Key Levels ("Nhúng luôn vào data cây nến đó")', () => {
    it('should normalize candle with embedded keyLevels array and extract into drawings', () => {
      const rawCandles = [
        {
          time: 1700000000,
          open: 1.085,
          high: 1.09,
          low: 1.084,
          close: 1.088,
          keyLevels: [
            {
              topPrice: 1.095,
              bottomPrice: 1.092,
              text: 'D - KL',
              candleCount: 15,
            },
            {
              topPrice: 1.088,
              bottomPrice: 1.086,
              text: 'N - POI',
              mode: 'infinite',
            },
          ],
        },
      ];

      const candles = normalizeCandles(rawCandles);
      expect(candles.length).toBe(1);
      expect(candles[0]?.keyLevels?.length).toBe(2);
      expect(candles[0]?.keyLevels?.[0]?.text).toBe('D - KL');
      expect(candles[0]?.keyLevels?.[0]?.candleCount).toBe(15);
      expect(candles[0]?.keyLevels?.[1]?.text).toBe('N - POI');
      expect(candles[0]?.keyLevels?.[1]?.isInfinite).toBe(true);
    });

    it('should normalize candle with single keyLevel object', () => {
      const rawCandles = [
        {
          time: 1700000000,
          open: 1.085,
          high: 1.09,
          low: 1.084,
          close: 1.088,
          keyLevel: {
            topPrice: 1.095,
            bottomPrice: 1.092,
            text: 'D - KL',
          },
        },
      ];

      const candles = normalizeCandles(rawCandles);
      expect(candles[0]?.keyLevel).toBeDefined();
      expect(candles[0]?.keyLevel?.topPrice).toBe(1.095);
      expect(candles[0]?.keyLevel?.bottomPrice).toBe(1.092);
      expect(candles[0]?.keyLevel?.isInfinite).toBe(true);
    });

    it('should extract embedded candle key levels into timeframe drawings during standardizeChartData', () => {
      const rawData = {
        symbol: 'EUR/USD',
        timeframes: {
          M2: {
            candles: [
              {
                time: 1700000000,
                open: 1.085,
                high: 1.09,
                low: 1.084,
                close: 1.088,
                keyLevels: [
                  {
                    topPrice: 1.095,
                    bottomPrice: 1.092,
                    text: 'D - KL',
                  },
                ],
              },
            ],
          },
        },
      };

      const standardized = standardizeChartData(rawData);
      const m2Drawings = standardized.timeframes?.M2?.drawings || [];
      const kl = m2Drawings.find((d) => isPoiDrawing(d));

      expect(kl).toBeDefined();
      expect(isKeyLevelDrawing(kl!)).toBe(true);
      expect(kl?.fromTime).toBe(1700000000);
      expect(kl?.sourceTimeframe).toBe('M2');
      expect((kl as PoiDrawing).topPrice).toBe(1.095);
      expect((kl as PoiDrawing).bottomPrice).toBe(1.092);
      expect((kl as PoiDrawing).text).toBe('D - KL');
      expect((kl as PoiDrawing).isInfinite).toBe(true);
    });
  });

  describe('Test 5: Visual Styling & Minimal Configuration (Only ID, Color, Description)', () => {
    it('should assign accurate styling and text from ID, color, and description without needing subType', () => {
      const rawDrawings = [
        {
          id: 'kl-1',
          type: 'poi',
          color: '#8a264c',
          description: 'D - KL',
          topPrice: 1.092,
          bottomPrice: 1.089,
        },
        {
          id: 'poi-2',
          type: 'poi',
          color: '#918732',
          description: 'N - POI',
          topPrice: 1.086,
          bottomPrice: 1.084,
        },
        {
          id: 'imb-3',
          type: 'poi',
          color: '#0284c7',
          description: 'Imbalance',
          topPrice: 1.083,
          bottomPrice: 1.081,
          candleCount: 12,
        },
      ];

      const normalized = normalizeDrawings(rawDrawings, 'M5');
      const kl = normalized[0] as PoiDrawing;
      expect(kl.type).toBe('poi');
      expect(kl.color).toBe('#8a264c');
      expect(kl.text).toBe('D - KL');
      expect(kl.description).toBe('D - KL');
      expect(kl.showBorder).toBe(false);
      expect(kl.centerLineStyle).toBe('dashed');

      const poi = normalized[1] as PoiDrawing;
      expect(poi.type).toBe('poi');
      expect(poi.color).toBe('#918732');
      expect(poi.text).toBe('N - POI');
      expect(poi.description).toBe('N - POI');
      expect(poi.showBorder).toBe(false);

      const imb = normalized[2] as PoiDrawing;
      expect(imb.type).toBe('poi');
      expect(imb.color).toBe('#0284c7');
      expect(imb.text).toBe('Imbalance');
      expect(imb.description).toBe('Imbalance');
      expect(imb.candleCount).toBe(12);
      expect(imb.showBorder).toBe(false);
    });
  });

  describe('Test 6: Text Layout & Guaranteed Candle Clearance ("Đảm bảo không đè lên nến")', () => {
    const mockTimeScale = {
      timeToCoordinate: (t: unknown) => {
        const timeNum = Number(t);
        if (timeNum === 0) return 50;
        if (timeNum === 120) return 100;
        if (timeNum === 240) return 150;
        if (timeNum === 360) return 200;
        if (timeNum === 480) return 250;
        return null;
      },
    } as unknown as Parameters<
      typeof computeKeyLevelTextLayout
    >[0]['timeScale'];

    const mockSeries = {
      priceToCoordinate: (p: number) => {
        return 500 - (p - 1.08) * 10000;
      },
    } as unknown as Parameters<typeof computeKeyLevelTextLayout>[0]['series'];

    const measureWidth = (str: string) => str.length * 7;

    it('should place text right-aligned along midline when clear of candles', () => {
      const layout = computeKeyLevelTextLayout({
        text: 'D - KL',
        boxLeft: 50,
        boxRight: 400,
        boxTop: 100,
        boxBottom: 160,
        midY: 130,
        candles: m2Candles.slice(0, 5),
        timeScale: mockTimeScale,
        series: mockSeries,
        measureTextWidth: measureWidth,
        fontSize: 11,
        paddingRight: 14,
        halfBar: 5.5,
      });

      expect(layout.visible).toBe(true);
      expect(layout.displayText).toBe('D - KL');
      expect(layout.clearsCandles).toBe(true);
      expect(layout.x).toBe(400 - 14 - measureWidth('D - KL'));
      expect(layout.y).toBe(130);
      expect(layout.boxLeftLineEnd).toBeLessThan(layout.x);
      expect(layout.boxRightLineStart).toBeGreaterThan(layout.x + layout.width);
    });

    it('should clear candles and not overlap when a candle intersects standard right position', () => {
      const blockingCandles: Candle[] = [
        { time: 0, open: 1.082, high: 1.085, low: 1.081, close: 1.084 },
        { time: 120, open: 1.084, high: 1.12, low: 1.07, close: 1.087 },
      ];

      const blockingTimeScale = {
        timeToCoordinate: (t: unknown) => {
          const timeNum = Number(t);
          if (timeNum === 0) return 50;
          if (timeNum === 120) return 180;
          return null;
        },
      } as unknown as Parameters<
        typeof computeKeyLevelTextLayout
      >[0]['timeScale'];

      const layout = computeKeyLevelTextLayout({
        text: 'D - KL',
        boxLeft: 50,
        boxRight: 200,
        boxTop: 100,
        boxBottom: 160,
        midY: 130,
        candles: blockingCandles,
        timeScale: blockingTimeScale,
        series: mockSeries,
        measureTextWidth: measureWidth,
        fontSize: 11,
        paddingRight: 14,
        halfBar: 5.5,
      });

      expect(layout.visible).toBe(true);
      expect(layout.clearsCandles).toBe(true);
    });

    it('should truncate text with ellipsis when box width is constrained', () => {
      const layout = computeKeyLevelTextLayout({
        text: 'D - KL Very Long Name',
        boxLeft: 50,
        boxRight: 100,
        boxTop: 100,
        boxBottom: 160,
        midY: 130,
        candles: [],
        timeScale: mockTimeScale,
        series: mockSeries,
        measureTextWidth: measureWidth,
      });

      expect(layout.visible).toBe(true);
      expect(layout.displayText.endsWith('...')).toBe(true);
    });
  });

  describe('Test 7: No Border Rendering for POI / Key Level Blocks ("Không có viền cho loại khối này")', () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 30 }),
      setLineDash: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const mockTimeScale = {
      timeToCoordinate: () => 100,
    } as unknown as Parameters<typeof renderPoi>[3];

    const mockSeries = {
      priceToCoordinate: (p: number) => 500 - (p - 1.08) * 1000,
    } as unknown as Parameters<typeof renderPoi>[4];

    it('should NOT draw border (ctx.strokeRect) by default', () => {
      vi.clearAllMocks();
      const poiDrawing: PoiDrawing = {
        id: 'poi-no-border',
        type: 'poi',
        color: '#e11d48',
        topPrice: 1.092,
        bottomPrice: 1.089,
        text: 'D - KL',
        fromTime: 0,
        sourceTimeframe: 'M5',
      };

      renderPoi(
        mockCtx,
        poiDrawing,
        m5Candles,
        mockTimeScale,
        mockSeries,
        800,
        false,
        'M5',
      );

      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.strokeRect).not.toHaveBeenCalled();
    });

    it('should draw border (ctx.strokeRect) only if showBorder is explicitly true', () => {
      vi.clearAllMocks();
      const poiDrawing: PoiDrawing = {
        id: 'poi-with-border',
        type: 'poi',
        color: '#e11d48',
        topPrice: 1.092,
        bottomPrice: 1.089,
        text: 'D - KL',
        fromTime: 0,
        showBorder: true,
        sourceTimeframe: 'M5',
      };

      renderPoi(
        mockCtx,
        poiDrawing,
        m5Candles,
        mockTimeScale,
        mockSeries,
        800,
        false,
        'M5',
      );

      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.strokeRect).toHaveBeenCalled();
    });
  });

  describe('Test 12: Deduplication of Drawing POIs and Candle Embedded POIs', () => {
    it('should deduplicate embedded candle POIs when raw drawings already define the same POI', () => {
      const rawData = {
        symbol: 'TEST/USD',
        timeframes: {
          M5: {
            candles: [
              {
                time: 1000,
                open: 1.08,
                high: 1.09,
                low: 1.07,
                close: 1.085,
                pois: [
                  {
                    topPrice: 1.09,
                    bottomPrice: 1.085,
                    description: 'M5 - Imbalance',
                    candleCount: 5,
                  },
                ],
              },
            ],
            drawings: [
              {
                id: 'm5-raw-imbalance',
                type: 'poi',
                displayName: 'M5 - Imbalance',
                fromTime: 1000,
                topPrice: 1.09,
                bottomPrice: 1.085,
                candleCount: 5,
              },
            ],
          },
        },
      };

      const result = standardizeChartData(rawData);
      const m5Drawings = result.timeframes.M5?.drawings || [];
      expect(m5Drawings).toHaveLength(1);
      expect(m5Drawings[0]?.id).toBe('m5-raw-imbalance');
    });
  });
});
