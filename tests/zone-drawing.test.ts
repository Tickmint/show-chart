import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import {
  canInheritTimeframe,
  resolveZoneBounds,
} from '../src/utils/timeframeService.js';
import { normalizeDrawings } from '../src/utils/fileParser.js';
import { computeZoneLabelLayout } from '../src/utils/canvasDrawing.js';
import type { Candle, ZoneDrawing, BoxDrawing } from '../src/types/chart.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

describe('Zone / Box Drawing Feature (Multi-Timeframe & Padding Rules)', () => {
  describe('Test 1: Price Enclosing & Vertical Padding', () => {
    it('should enclose highest high and lowest low with 5% default padding on price axis', () => {
      const candles: Candle[] = [
        { time: 1000, open: 100, high: 110, low: 95, close: 105 },
        { time: 1060, open: 105, high: 120, low: 102, close: 115 },
        { time: 1120, open: 115, high: 118, low: 90, close: 92 },
        { time: 1180, open: 92, high: 105, low: 91, close: 100 },
      ];

      const bounds = resolveZoneBounds({
        fromTime: 1000,
        toTime: 1180,
        sourceTimeframe: 'M1',
        targetTimeframe: 'M1',
        targetCandles: candles,
      });

      expect(bounds).not.toBeNull();
      expect(bounds?.highestPrice).toBe(120);
      expect(bounds?.lowestPrice).toBe(90);

      expect(bounds?.padding).toBeCloseTo(1.5, 4);
      expect(bounds?.boxTopPrice).toBeCloseTo(121.5, 4);
      expect(bounds?.boxBottomPrice).toBeCloseTo(88.5, 4);

      expect(bounds?.startTime).toBe(1000);
      expect(bounds?.endTime).toBe(1180);
      expect(bounds?.overlappingCandles.length).toBe(4);
    });

    it('should support custom paddingRatio and paddingPrice', () => {
      const candles: Candle[] = [
        { time: 1000, open: 100, high: 110, low: 90, close: 100 },
      ];

      const boundsRatio = resolveZoneBounds({
        fromTime: 1000,
        toTime: 1000,
        paddingRatio: 0.1,
        targetTimeframe: 'M1',
        targetCandles: candles,
      });

      expect(boundsRatio?.boxTopPrice).toBe(112);
      expect(boundsRatio?.boxBottomPrice).toBe(88);

      const boundsPrice = resolveZoneBounds({
        fromTime: 1000,
        toTime: 1000,
        paddingPrice: 5.0,
        targetTimeframe: 'M1',
        targetCandles: candles,
      });
      expect(boundsPrice?.boxTopPrice).toBe(115);
      expect(boundsPrice?.boxBottomPrice).toBe(85);
    });
  });

  describe('Test 2: Multi-Timeframe Auto-Stretching & 1-Way Downward Inheritance', () => {
    it('should automatically stretch an H1 Zone across all M15 sub-candles and re-calculate bounds', () => {
      const m15Candles: Candle[] = [
        { time: 1000, open: 1.082, high: 1.085, low: 1.081, close: 1.084 },
        { time: 1900, open: 1.084, high: 1.092, low: 1.083, close: 1.087 },
        { time: 2800, open: 1.087, high: 1.086, low: 1.078, close: 1.081 },
        { time: 3700, open: 1.081, high: 1.084, low: 1.08, close: 1.083 },
        { time: 4600, open: 1.083, high: 1.088, low: 1.082, close: 1.085 },
      ];

      const bounds = resolveZoneBounds({
        fromTime: 1000,
        toTime: 1000,
        sourceTimeframe: 'H1',
        targetTimeframe: 'M15',
        targetCandles: m15Candles,
      });

      expect(bounds).not.toBeNull();

      expect(bounds?.overlappingCandles.length).toBe(4);
      expect(bounds?.highestPrice).toBe(1.092);
      expect(bounds?.lowestPrice).toBe(1.078);

      const span = 1.092 - 1.078;
      const pad = span * 0.05;
      expect(bounds?.boxTopPrice).toBeCloseTo(1.092 + pad, 5);
      expect(bounds?.boxBottomPrice).toBeCloseTo(1.078 - pad, 5);
    });

    it('should strictly NOT display lower timeframe zone on higher timeframe (upward inheritance prohibited)', () => {
      const h1Candles: Candle[] = [
        { time: 1000, open: 1.082, high: 1.092, low: 1.078, close: 1.083 },
      ];

      expect(canInheritTimeframe('M15', 'H1')).toBe(false);
      expect(canInheritTimeframe('M5', 'H4')).toBe(false);

      const bounds = resolveZoneBounds({
        fromTime: 1000,
        toTime: 1000,
        sourceTimeframe: 'M15',
        targetTimeframe: 'H1',
        targetCandles: h1Candles,
      });

      expect(bounds).toBeNull();
    });

    it('should support non-divisible timeframes (M5 to M2 with ratio 2.5)', () => {
      const m2Candles: Candle[] = [
        { time: 0, open: 92, high: 100, low: 90, close: 95 },
        { time: 120, open: 95, high: 110, low: 95, close: 105 },
        { time: 240, open: 105, high: 102, low: 85, close: 88 },
        { time: 360, open: 88, high: 115, low: 87, close: 110 },
      ];

      const bounds = resolveZoneBounds({
        fromTime: 0,
        toTime: 0,
        sourceTimeframe: 'M5',
        targetTimeframe: 'M2',
        targetCandles: m2Candles,
      });

      expect(bounds).not.toBeNull();
      expect(bounds?.overlappingCandles.length).toBe(3);
      expect(bounds?.highestPrice).toBe(110);
      expect(bounds?.lowestPrice).toBe(85);

      expect(bounds?.boxTopPrice).toBeCloseTo(111.25, 2);
      expect(bounds?.boxBottomPrice).toBeCloseTo(83.75, 2);
    });
  });

  describe('Test 3: Normalization, Custom Display Name & Alias Support', () => {
    it('should normalize both "zone" and "box" types, preserving custom display name', () => {
      const rawDrawings = [
        {
          id: 'zone-1',
          type: 'zone',
          color: '#06b6d4',
          displayName: 'D1 Demand Zone',
          element: 'Market Structure Demand',
          fromTime: 1000,
          toTime: 2000,
        },
        {
          id: 'box-2',
          type: 'box',
          color: '#ec4899',
          title: 'M15 Scalp Box',
          fromTime: 3000,
          toTime: 4000,
        },
      ];

      const normalized = normalizeDrawings(rawDrawings, 'H1');
      expect(normalized.length).toBe(2);

      const zone1 = normalized[0] as ZoneDrawing;
      expect(zone1.type).toBe('zone');
      expect(zone1.displayName).toBe('D1 Demand Zone');
      expect(zone1.element).toBe('D1 Demand Zone');
      expect(zone1.color).toBe('#06b6d4');
      expect(zone1.fromTime).toBe(1000);
      expect(zone1.toTime).toBe(2000);

      const box2 = normalized[1] as BoxDrawing;
      expect(box2.type).toBe('box');
      expect(box2.displayName).toBe('M15 Scalp Box');
      expect(box2.element).toBe('M15 Scalp Box');
      expect(box2.color).toBe('#ec4899');
    });
  });

  describe('Test 4: Test Data Verification (EUR_USD_test_data.json.gz)', () => {
    it('should verify EUR_USD_test_data.json.gz contains valid multi-timeframe Zone & Box drawings', () => {
      const rawJsonPath = path.join(
        root,
        'test_data',
        'EUR_USD_test_data.json',
      );
      expect(fs.existsSync(rawJsonPath)).toBe(false);

      const testDataPath = path.join(
        root,
        'test_data',
        'EUR_USD_test_data.json.gz',
      );
      expect(fs.existsSync(testDataPath)).toBe(true);

      const compressedBuf = fs.readFileSync(testDataPath);
      const decompressedStr = zlib.gunzipSync(compressedBuf).toString('utf8');
      const content = JSON.parse(decompressedStr);

      const m5Drawings = content.timeframes?.M5?.drawings || [];
      const m5Zone = m5Drawings.find(
        (d: { type: string }) => d.type === 'zone',
      );
      expect(m5Zone).toBeDefined();
      expect(m5Zone.element).toContain('Market Structure');
      expect(m5Zone.displayName).toBe('M5 Demand Zone');
      expect(m5Zone.paddingRatio).toBe(0.05);

      const m2Drawings = content.timeframes?.M2?.drawings || [];
      const m2Box = m2Drawings.find((d: { type: string }) => d.type === 'box');
      expect(m2Box).toBeDefined();
      expect(m2Box.element).toContain('Market Structure');
      expect(m2Box.displayName).toBe('M2 Scalp Box');
    });
  });

  describe('Test 5: Label Display, Candle Clearance & Ellipsis Truncation', () => {
    const measure7px = (str: string) => str.length * 7;

    it('should place label strictly in top padding so candles NEVER overlap it', () => {
      const layout = computeZoneLabelLayout({
        text: 'H1 Supply Zone',
        boxX: 50,
        boxWidth: 200,
        boxY: 100,
        candleHighY: 130,
        measureTextWidth: measure7px,
        fontSize: 10,
        paddingY: 2,
      });

      expect(layout.visible).toBe(true);
      expect(layout.y).toBe(102);
      expect(layout.height).toBe(14);

      expect(layout.y + layout.height).toBeLessThanOrEqual(130);
      expect(layout.clearsCandles).toBe(true);
    });

    it('should hide label when headroom is insufficient to prevent candle overlap', () => {
      const layout = computeZoneLabelLayout({
        text: 'H1 Supply Zone',
        boxX: 50,
        boxWidth: 200,
        boxY: 100,
        candleHighY: 108,
        measureTextWidth: measure7px,
        fontSize: 10,
        paddingY: 2,
      });

      expect(layout.visible).toBe(false);
      expect(layout.displayText).toBe('');
    });

    it('should hide label when box width is too small', () => {
      const layout = computeZoneLabelLayout({
        text: 'D1 Demand Zone',
        boxX: 10,
        boxWidth: 25,
        boxY: 100,
        candleHighY: 150,
        measureTextWidth: measure7px,
      });

      expect(layout.visible).toBe(false);
    });

    it('should truncate with "..." on a single line when text is too long', () => {
      const longText = 'D1 Major Macro Bullish Market Structure Demand Zone';

      const layout = computeZoneLabelLayout({
        text: longText,
        boxX: 50,
        boxWidth: 100,
        boxY: 100,
        candleHighY: 150,
        measureTextWidth: measure7px,
      });

      expect(layout.visible).toBe(true);
      expect(layout.isTruncated).toBe(true);
      expect(layout.displayText.endsWith('...')).toBe(true);

      expect(layout.displayText.includes('\n')).toBe(false);
      expect(layout.displayText.includes('\r')).toBe(false);

      expect(layout.width).toBeLessThanOrEqual(100);
    });

    it('should show full text without "..." when box width is generous', () => {
      const text = 'Demand Zone';
      const layout = computeZoneLabelLayout({
        text,
        boxX: 50,
        boxWidth: 300,
        boxY: 100,
        candleHighY: 150,
        measureTextWidth: measure7px,
      });

      expect(layout.visible).toBe(true);
      expect(layout.isTruncated).toBe(false);
      expect(layout.displayText).toBe('Demand Zone');
    });

    it('should normalize label-related properties in fileParser', () => {
      const raw = [
        {
          id: 'z-label-1',
          type: 'zone',
          color: '#06b6d4',
          label: 'Custom POI Zone',
          showLabel: true,
          labelColor: '#38bdf8',
          labelFontSize: 11,
          fromTime: 1000,
          toTime: 2000,
        },
        {
          id: 'z-label-2',
          type: 'box',
          color: '#fb923c',
          showLabel: false,
          fromTime: 1000,
          toTime: 2000,
        },
      ];

      const res = normalizeDrawings(raw, 'H1');
      const z1 = res[0] as ZoneDrawing;
      expect(z1.label).toBe('Custom POI Zone');
      expect(z1.showLabel).toBe(true);
      expect(z1.labelColor).toBe('#38bdf8');
      expect(z1.labelFontSize).toBe(11);

      const z2 = res[1] as ZoneDrawing;
      expect(z2.showLabel).toBe(false);
    });
  });
});
