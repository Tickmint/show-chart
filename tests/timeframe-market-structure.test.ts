import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getTimeframeConversionRatio,
  canInheritTimeframe,
  resolveAnchorPoint,
} from '../src/utils/timeframeService.js';
import type { Candle } from '../src/types/chart.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

describe('Timeframe Conversions, 1-Way Downward Inheritance & Market Structure', () => {
  describe('Test 1: 1-Way Timeframe Conversion Ratios', () => {
    it('should calculate correct conversion ratios for larger to smaller timeframes', () => {
      expect(getTimeframeConversionRatio('D1', 'H4')).toBe(6.0);
      expect(getTimeframeConversionRatio('H4', 'H1')).toBe(4.0);
      expect(getTimeframeConversionRatio('H1', 'M15')).toBe(4.0);
      expect(getTimeframeConversionRatio('M15', 'M5')).toBe(3.0);
      expect(getTimeframeConversionRatio('M5', 'M2')).toBe(2.5);
      expect(getTimeframeConversionRatio('M2', 'M1')).toBe(2.0);
    });

    it('should strictly disallow upward conversion (returning null)', () => {
      expect(getTimeframeConversionRatio('M15', 'H1')).toBeNull();
      expect(getTimeframeConversionRatio('H1', 'H4')).toBeNull();
      expect(getTimeframeConversionRatio('H4', 'D1')).toBeNull();
    });
  });

  describe('Test 2: 1-Way Downward Inheritance Rules', () => {
    it('should allow larger timeframes to inherit down to smaller timeframes', () => {
      expect(canInheritTimeframe('D1', 'H4')).toBe(true);
      expect(canInheritTimeframe('D1', 'H1')).toBe(true);
      expect(canInheritTimeframe('D1', 'M15')).toBe(true);
      expect(canInheritTimeframe('H4', 'H1')).toBe(true);
      expect(canInheritTimeframe('H4', 'M15')).toBe(true);
      expect(canInheritTimeframe('H1', 'M15')).toBe(true);
      expect(canInheritTimeframe('M5', 'M2')).toBe(true);
    });

    it('should allow native display on same timeframe', () => {
      expect(canInheritTimeframe('H1', 'H1')).toBe(true);
      expect(canInheritTimeframe('M15', 'M15')).toBe(true);
    });

    it('should disallow smaller timeframes from inheriting up to larger timeframes', () => {
      expect(canInheritTimeframe('M15', 'H1')).toBe(false);
      expect(canInheritTimeframe('M15', 'H4')).toBe(false);
      expect(canInheritTimeframe('M15', 'D1')).toBe(false);
      expect(canInheritTimeframe('H1', 'H4')).toBe(false);
      expect(canInheritTimeframe('H1', 'D1')).toBe(false);
      expect(canInheritTimeframe('M2', 'M5')).toBe(false);
    });
  });

  describe('Test 3: Multi-Timeframe Anchor Snapping (Highest High & Lowest Low)', () => {
    it('Scenario A: snaps H1 anchor to highest High and lowest Low in M15 sub-candles', () => {
      const m15Candles: Candle[] = [
        { time: 1000, open: 1.082, high: 1.085, low: 1.081, close: 1.084 },
        { time: 1900, open: 1.084, high: 1.089, low: 1.083, close: 1.087 },
        { time: 2800, open: 1.087, high: 1.086, low: 1.079, close: 1.081 },
        { time: 3700, open: 1.081, high: 1.084, low: 1.082, close: 1.083 },
        { time: 4600, open: 1.083, high: 1.088, low: 1.082, close: 1.085 },
      ];

      const highAnchor = resolveAnchorPoint({
        candleTime: 1000,
        sourceTimeframe: 'H1',
        targetTimeframe: 'M15',
        priceType: 'high',
        targetCandles: m15Candles,
      });

      expect(highAnchor).not.toBeNull();
      expect(highAnchor?.time).toBe(1900);
      expect(highAnchor?.price).toBe(1.089);

      const lowAnchor = resolveAnchorPoint({
        candleTime: 1000,
        sourceTimeframe: 'H1',
        targetTimeframe: 'M15',
        priceType: 'low',
        targetCandles: m15Candles,
      });

      expect(lowAnchor).not.toBeNull();
      expect(lowAnchor?.time).toBe(2800);
      expect(lowAnchor?.price).toBe(1.079);
    });

    it('Scenario B: snaps M5 anchor to highest High and lowest Low in non-divisible M2 sub-candles (ratio 2.5)', () => {
      const m2Candles: Candle[] = [
        { time: 0, open: 92, high: 100, low: 90, close: 95 },
        { time: 120, open: 95, high: 108, low: 95, close: 105 },
        { time: 240, open: 105, high: 102, low: 85, close: 88 },
        { time: 360, open: 88, high: 115, low: 87, close: 110 },
      ];

      const m2HighAnchor = resolveAnchorPoint({
        candleTime: 0,
        sourceTimeframe: 'M5',
        targetTimeframe: 'M2',
        priceType: 'high',
        targetCandles: m2Candles,
      });

      expect(m2HighAnchor).not.toBeNull();
      expect(m2HighAnchor?.time).toBe(120);
      expect(m2HighAnchor?.price).toBe(108);

      const m2LowAnchor = resolveAnchorPoint({
        candleTime: 0,
        sourceTimeframe: 'M5',
        targetTimeframe: 'M2',
        priceType: 'low',
        targetCandles: m2Candles,
      });

      expect(m2LowAnchor).not.toBeNull();
      expect(m2LowAnchor?.time).toBe(240);
      expect(m2LowAnchor?.price).toBe(85);
    });
  });

  describe('Test 4: Generated Test Data Verification (Market Structure & Schema)', () => {
    it('should validate EUR_USD_test_data.json schema, units, conversions, and Market Structure', () => {
      const testDataPath = path.join(
        root,
        'test_data',
        'EUR_USD_test_data.json',
      );
      expect(fs.existsSync(testDataPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));

      expect(content.timeframeUnits).toBeDefined();
      expect(content.timeframeUnits.H1).toBe(3600);
      expect(content.timeframeUnits.M15).toBe(900);
      expect(content.timeframeUnits.M5).toBe(300);
      expect(content.timeframeUnits.M2).toBe(120);

      expect(Array.isArray(content.timeframeConversions)).toBe(true);
      const m5toM2 = content.timeframeConversions.find(
        (c: { from: string; to: string; ratio: number }) =>
          c.from === 'M5' && c.to === 'M2',
      );
      expect(m5toM2).toBeDefined();
      expect(m5toM2?.ratio).toBe(2.5);

      expect(content.commonDrawings).toBeUndefined();

      const h4Drawings = content.timeframes?.H4?.drawings || [];
      expect(h4Drawings.length).toBeGreaterThanOrEqual(3);
      for (const d of h4Drawings) {
        expect(d.element).toContain('Market Structure');
        expect(d.sourceTimeframe).toBe('H4');
      }

      const h1Drawings = content.timeframes?.H1?.drawings || [];
      expect(h1Drawings.length).toBeGreaterThanOrEqual(3);
      for (const d of h1Drawings) {
        expect(d.element).toContain('Market Structure');
        expect(d.sourceTimeframe).toBe('H1');
      }
    });
  });
});
