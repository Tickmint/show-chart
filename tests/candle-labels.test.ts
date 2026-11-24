import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { normalizeCandles } from '../src/utils/fileParser.js';
import {
  computeCalloutLayout,
  renderCandleLabels,
} from '../src/utils/canvasDrawing.js';
import type { Candle } from '../src/types/chart.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

describe('Candle Callout Labels Feature (Callout Block, Candle Clearance & Default Visibility)', () => {
  describe('Test 1: Normalizing Labels with True/False Default Visibility', () => {
    it('should parse label string and set default visible to true', () => {
      const raw = [
        {
          time: 1000,
          open: 1.08,
          high: 1.09,
          low: 1.075,
          close: 1.085,
          label: 'Bullish Order Block',
        },
      ];
      const candles = normalizeCandles(raw);
      expect(candles[0]?.labels).toBeDefined();
      expect(candles[0]?.labels?.length).toBe(1);
      expect(candles[0]?.labels?.[0]?.text).toBe('Bullish Order Block');
      expect(candles[0]?.labels?.[0]?.visible).toBe(true);
    });

    it('should respect visible: false specified in label data', () => {
      const raw = [
        {
          time: 1000,
          open: 1.08,
          high: 1.09,
          low: 1.075,
          close: 1.085,
          labels: [
            {
              text: 'Liquidity Sweep',
              visible: false,
              position: 'above',
            },
          ],
        },
      ];
      const candles = normalizeCandles(raw);
      expect(candles[0]?.labels?.[0]?.visible).toBe(false);
      expect(candles[0]?.labels?.[0]?.position).toBe('above');
    });
  });

  describe('Test 2: Callout Box & Candle Clearance (No Overlap on Other Candles)', () => {
    it('should calculate callout box Y position clear of surrounding candles', () => {
      const targetCandle: Candle = {
        time: 1000,
        open: 100,
        high: 105,
        low: 98,
        close: 102,
      };

      const highNeighborCandle: Candle = {
        time: 1060,
        open: 102,
        high: 115,
        low: 101,
        close: 112,
      };

      const candles = [targetCandle, highNeighborCandle];

      const mockTimeScale = {
        timeToCoordinate: vi.fn((t: number) => (t === 1000 ? 200 : 230)),
      };

      const mockSeries = {
        priceToCoordinate: vi.fn((p: number) => {
          if (p === 105) return 200;
          if (p === 115) return 100;
          if (p === 98) return 300;
          if (p === 101) return 280;
          return 250;
        }),
      };

      const layout = computeCalloutLayout({
        candle: targetCandle,
        label: { text: 'BOS', visible: true, position: 'above' },
        candles,
        timeScale: mockTimeScale as never,
        series: mockSeries as never,
        paneWidth: 800,
        paneHeight: 600,
        measureTextWidth: () => 30,
      });

      expect(layout).not.toBeNull();
      expect(layout?.visible).toBe(true);
      expect(layout?.tipX).toBe(200);
      expect(layout?.tipY).toBe(200);
      expect(layout!.boxTop + layout!.boxHeight).toBeLessThanOrEqual(100 - 14);
    });

    it('should invoke renderCandleLabels without error on canvas', () => {
      const candles: Candle[] = [
        {
          time: 1000,
          open: 1.08,
          high: 1.09,
          low: 1.075,
          close: 1.085,
          labels: [{ text: 'OB', visible: true, position: 'above' }],
        },
      ];
      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn().mockReturnValue({ width: 30 }),
        roundRect: vi.fn(),
        rect: vi.fn(),
        fillRect: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      const mockTimeScale = {
        timeToCoordinate: vi.fn().mockReturnValue(150),
      };

      const mockSeries = {
        priceToCoordinate: vi.fn().mockReturnValue(200),
      };

      expect(() => {
        renderCandleLabels(
          mockCtx,
          candles,
          mockTimeScale as never,
          mockSeries as never,
          800,
          600,
          true,
          'dark',
        );
      }).not.toThrow();
    });

    it('should route callout to avoid overlapping or passing through POI/Box obstacles', () => {
      const targetCandle: Candle = {
        time: 1000,
        open: 100,
        high: 105,
        low: 98,
        close: 102,
      };
      const candles = [targetCandle];

      const mockTimeScale = {
        timeToCoordinate: vi.fn().mockReturnValue(200),
      };

      const mockSeries = {
        priceToCoordinate: vi.fn((p: number) => {
          if (p === 105) return 200;
          if (p === 98) return 280;
          return 240;
        }),
      };

      // Define an obstacle directly above the candle (x: 170..230, y: 120..190)
      const obstacle = {
        left: 170,
        right: 230,
        top: 120,
        bottom: 190,
      };

      const layout = computeCalloutLayout({
        candle: targetCandle,
        label: { text: 'BOS', visible: true, position: 'above' },
        candles,
        timeScale: mockTimeScale as never,
        series: mockSeries as never,
        paneWidth: 800,
        paneHeight: 600,
        measureTextWidth: () => 30,
        obstacles: [obstacle],
      });

      expect(layout).not.toBeNull();
      // Box must not overlap obstacle
      const boxOverlap =
        Math.max(layout!.boxLeft, obstacle.left) <
          Math.min(layout!.boxLeft + layout!.boxWidth, obstacle.right) &&
        Math.max(layout!.boxTop, obstacle.top) <
          Math.min(layout!.boxTop + layout!.boxHeight, obstacle.bottom);
      expect(boxOverlap).toBe(false);
    });

    it('should respect elementVisibility to hide/show each callout individually and allow UI override of initial JSON visibility', () => {
      const targetCandle: Candle = {
        time: 1000,
        open: 100,
        high: 105,
        low: 98,
        close: 102,
        labels: [
          {
            id: 'lbl-1',
            text: 'Asian Session High',
            visible: true,
            position: 'above',
          },
          {
            id: 'lbl-2',
            text: 'London Session Low',
            visible: false,
            position: 'below',
          },
        ],
      };
      const candles = [targetCandle];

      const mockTimeScale = {
        timeToCoordinate: vi.fn().mockReturnValue(200),
      };

      const mockSeries = {
        priceToCoordinate: vi.fn((p: number) => {
          if (p === 105) return 200;
          if (p === 98) return 280;
          return 240;
        }),
      };

      const createMockCtx = () =>
        ({
          font: '',
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 1,
          textAlign: '',
          textBaseline: '',
          save: vi.fn(),
          restore: vi.fn(),
          beginPath: vi.fn(),
          rect: vi.fn(),
          roundRect: vi.fn(),
          fill: vi.fn(),
          stroke: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          closePath: vi.fn(),
          fillRect: vi.fn(),
          fillText: vi.fn(),
          measureText: vi.fn().mockReturnValue({ width: 60 }),
        }) as unknown as CanvasRenderingContext2D;

      // 1. Initial state (no elementVisibility overrides):
      // lbl-1 is visible: true -> rendered
      // lbl-2 is visible: false -> NOT rendered
      const ctx1 = createMockCtx();
      renderCandleLabels(
        ctx1,
        candles,
        mockTimeScale as never,
        mockSeries as never,
        800,
        600,
        true,
        'dark',
        [],
        'M5',
        {},
        {},
      );
      expect(ctx1.fillText).toHaveBeenCalledWith(
        'Asian Session High',
        expect.any(Number),
        expect.any(Number),
      );
      expect(ctx1.fillText).not.toHaveBeenCalledWith(
        'London Session Low',
        expect.any(Number),
        expect.any(Number),
      );

      // 2. UI override: user turns off lbl-1 (Asian Session High) and turns on lbl-2 (London Session Low)
      const ctx2 = createMockCtx();
      renderCandleLabels(
        ctx2,
        candles,
        mockTimeScale as never,
        mockSeries as never,
        800,
        600,
        true,
        'dark',
        [],
        'M5',
        {},
        { 'lbl-1': false, 'lbl-2': true },
      );
      expect(ctx2.fillText).not.toHaveBeenCalledWith(
        'Asian Session High',
        expect.any(Number),
        expect.any(Number),
      );
      expect(ctx2.fillText).toHaveBeenCalledWith(
        'London Session Low',
        expect.any(Number),
        expect.any(Number),
      );
    });
  });

  describe('Test 3: Generated Test Data Verification for Labels', () => {
    it('should contain random labels with both true and false default visibility in EUR_USD_test_data.json.gz', () => {
      const gzPath = path.join(root, 'test_data', 'EUR_USD_test_data.json.gz');
      const content = JSON.parse(
        zlib.gunzipSync(fs.readFileSync(gzPath)).toString('utf8'),
      );
      const m5Candles: Candle[] = content.timeframes.M5.candles;

      const candlesWithLabels = m5Candles.filter(
        (c) => c.labels && c.labels.length > 0,
      );
      expect(candlesWithLabels.length).toBeGreaterThanOrEqual(4);

      const visibleLabels = candlesWithLabels.filter((c) =>
        c.labels?.some((l) => l.visible === true),
      );
      const hiddenLabels = candlesWithLabels.filter((c) =>
        c.labels?.some((l) => l.visible === false),
      );

      expect(visibleLabels.length).toBeGreaterThan(0);
      expect(hiddenLabels.length).toBeGreaterThan(0);
    });
  });
});
