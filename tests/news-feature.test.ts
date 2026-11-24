import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { normalizeCandles } from '../src/utils/fileParser.js';
import { renderCandleNews } from '../src/utils/canvasDrawing.js';
import type { Candle } from '../src/types/chart.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

describe('Candle News Feature (Circle N Under Candle & Multi-News Support)', () => {
  describe('Test 1: Normalizing News in Candlestick Data', () => {
    it('should parse single news string into CandleNewsItem array', () => {
      const raw = [
        {
          time: 1000,
          open: 1.08,
          high: 1.09,
          low: 1.075,
          close: 1.085,
          news: 'US CPI Release',
        },
      ];
      const candles = normalizeCandles(raw);
      expect(candles[0]?.news).toBeDefined();
      expect(candles[0]?.news?.length).toBe(1);
      expect(candles[0]?.news?.[0]?.title).toBe('US CPI Release');
    });

    it('should parse news object with title, impact, and description', () => {
      const raw = [
        {
          time: 1000,
          open: 1.08,
          high: 1.09,
          low: 1.075,
          close: 1.085,
          news: {
            title: 'NFP Non-Farm Payrolls',
            impact: 'high',
            description: 'Actual: 254K',
          },
        },
      ];
      const candles = normalizeCandles(raw);
      expect(candles[0]?.news?.[0]?.title).toBe('NFP Non-Farm Payrolls');
      expect(candles[0]?.news?.[0]?.impact).toBe('high');
      expect(candles[0]?.news?.[0]?.description).toBe('Actual: 254K');
    });

    it('should parse multiple news items in a single candle (0, 1, or many)', () => {
      const raw = [
        {
          time: 1000,
          open: 1.08,
          high: 1.09,
          low: 1.075,
          close: 1.085,
        },
        {
          time: 2000,
          open: 1.085,
          high: 1.095,
          low: 1.082,
          close: 1.09,
          news: [
            { title: 'Fed Interest Rate Decision', impact: 'high', time: 2000 },
            { title: 'FOMC Press Conference', impact: 'high', time: 2060 },
          ],
        },
      ];
      const candles = normalizeCandles(raw);
      expect(candles[0]?.news).toBeUndefined();
      expect(candles[1]?.news?.length).toBe(2);
      expect(candles[1]?.news?.[0]?.title).toBe('Fed Interest Rate Decision');
      expect(candles[1]?.news?.[0]?.time).toBe(2000);
      expect(candles[1]?.news?.[1]?.title).toBe('FOMC Press Conference');
      expect(candles[1]?.news?.[1]?.time).toBe(2060);
    });
  });

  describe('Test 2: Canvas News Rendering & Placement at Bottom Baseline (TradingView Style)', () => {
    it('should position circle N at bottom baseline of chart pane', () => {
      const candles: Candle[] = [
        {
          time: 1000,
          open: 1.08,
          high: 1.09,
          low: 1.075,
          close: 1.085,
          news: [{ title: 'Retail Sales', impact: 'medium' }],
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
      } as unknown as CanvasRenderingContext2D;

      const mockTimeScale = {
        timeToCoordinate: vi.fn().mockReturnValue(150),
      };

      const mockSeries = {
        priceToCoordinate: vi.fn().mockReturnValue(200),
      };

      const anchors = renderCandleNews(
        mockCtx,
        candles,
        mockTimeScale as never,
        mockSeries as never,
        800,
        600,
        'dark',
      );

      // paneHeight = 600, radius = 9, bottomY = 600 - 9 - 5 = 586
      expect(anchors.length).toBe(1);
      expect(anchors[0]?.x).toBe(150);
      expect(anchors[0]?.y).toBe(586);
      expect(anchors[0]?.news.length).toBe(1);
      expect(mockCtx.arc).toHaveBeenCalledWith(150, 586, 9, 0, Math.PI * 2);
      expect(mockCtx.fillText).toHaveBeenCalledWith('N', 150, 586.5);
    });
  });

  describe('Test 3: Generated Test Data Verification for News Items', () => {
    it('should contain random news events with varying count (0, 1, or multiple) in EUR_USD_test_data.json.gz', () => {
      const gzPath = path.join(root, 'test_data', 'EUR_USD_test_data.json.gz');
      expect(fs.existsSync(gzPath)).toBe(true);

      const content = JSON.parse(
        zlib.gunzipSync(fs.readFileSync(gzPath)).toString('utf8'),
      );
      const m1Candles: Candle[] = content.timeframes.M1.candles;

      const candlesWithNews = m1Candles.filter(
        (c) => c.news && c.news.length > 0,
      );
      const candlesWithoutNews = m1Candles.filter(
        (c) => !c.news || c.news.length === 0,
      );

      expect(candlesWithNews.length).toBeGreaterThan(5);
      expect(candlesWithoutNews.length).toBeGreaterThan(100);

      const singleNews = candlesWithNews.filter((c) => c.news?.length === 1);
      const multiNews = candlesWithNews.filter(
        (c) => (c.news?.length ?? 0) > 1,
      );

      expect(singleNews.length).toBeGreaterThan(0);
      expect(multiNews.length).toBeGreaterThan(0);
    });
  });
});
