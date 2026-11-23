import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getTimeframeConversionRatio,
  canInheritTimeframe,
  resolveAnchorPoint,
  parseTimeframeDuration,
} from '../src/utils/timeframeService.js';
import { standardizeChartData } from '../src/utils/fileParser.js';
import type { Candle, ChartElement } from '../src/types/chart.js';

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
      expect(Object.keys(content.timeframeUnits)).toEqual(['M5', 'M2', 'M1']);
      expect(content.timeframeUnits.M5).toBe(300);
      expect(content.timeframeUnits.M2).toBe(120);
      expect(content.timeframeUnits.M1).toBe(60);
      expect(content.timeframeUnits.H1).toBeUndefined();
      expect(content.timeframeUnits.D1).toBeUndefined();

      expect(content.timeframeConversions).toBeUndefined();

      const parsedData = standardizeChartData(content);
      expect(Array.isArray(parsedData.timeframeConversions)).toBe(true);
      const m5toM2 = parsedData.timeframeConversions?.find(
        (c) => c.from === 'M5' && c.to === 'M2',
      );
      expect(m5toM2).toBeDefined();
      expect(m5toM2?.ratio).toBe(2.5);

      const m2toM1 = parsedData.timeframeConversions?.find(
        (c) => c.from === 'M2' && c.to === 'M1',
      );
      expect(m2toM1).toBeDefined();
      expect(m2toM1?.ratio).toBe(2.0);

      const m5toM1 = parsedData.timeframeConversions?.find(
        (c) => c.from === 'M5' && c.to === 'M1',
      );
      expect(m5toM1).toBeDefined();
      expect(m5toM1?.ratio).toBe(5.0);

      expect(content.commonDrawings).toBeUndefined();

      const m5Drawings = content.timeframes?.M5?.drawings || [];
      expect(m5Drawings.length).toBeGreaterThanOrEqual(3);
      for (const d of m5Drawings) {
        expect(d.element).toContain('Market Structure');
        expect(d.sourceTimeframe).toBe('M5');
      }
      const m5LineElements = Array.from(
        new Set(
          m5Drawings
            .filter((d: { type: string }) => d.type === 'line')
            .map((d: { element: string }) => d.element),
        ),
      );
      expect(m5LineElements).toEqual([
        'M5 Bullish Market Structure',
        'M5 Bearish Market Structure',
      ]);
      const m5BullishLines = m5Drawings.filter(
        (d: { element: string }) => d.element === 'M5 Bullish Market Structure',
      );
      for (const line of m5BullishLines) {
        expect(line.color).toBe('#10b981');
      }
      const m5Blocks = m5Drawings.filter(
        (d: { type: string }) => d.type === 'poi',
      );
      expect(m5Blocks).toHaveLength(5);

      const m2Drawings = content.timeframes?.M2?.drawings || [];
      expect(m2Drawings.length).toBeGreaterThanOrEqual(3);
      for (const d of m2Drawings) {
        expect(d.element).toContain('Market Structure');
        expect(d.sourceTimeframe).toBe('M2');
      }
      const m2LineElements = Array.from(
        new Set(
          m2Drawings
            .filter((d: { type: string }) => d.type === 'line')
            .map((d: { element: string }) => d.element),
        ),
      );
      expect(m2LineElements).toEqual([
        'M2 Bullish Market Structure',
        'M2 Bearish Market Structure',
      ]);
      const m2BullishLines = m2Drawings.filter(
        (d: { element: string }) => d.element === 'M2 Bullish Market Structure',
      );
      for (const line of m2BullishLines) {
        expect(line.color).toBe('#10b981');
      }
      const m2Blocks = m2Drawings.filter(
        (d: { type: string }) => d.type === 'poi',
      );
      expect(m2Blocks).toHaveLength(5);

      const m1Drawings = content.timeframes?.M1?.drawings || [];
      expect(m1Drawings.length).toBeGreaterThanOrEqual(3);
      for (const d of m1Drawings) {
        expect(d.element).toContain('Market Structure');
        expect(d.sourceTimeframe).toBe('M1');
      }
      const m1LineElements = Array.from(
        new Set(
          m1Drawings
            .filter((d: { type: string }) => d.type === 'line')
            .map((d: { element: string }) => d.element),
        ),
      );
      expect(m1LineElements).toEqual([
        'M1 Bullish Market Structure',
        'M1 Bearish Market Structure',
      ]);
      const m1BullishLines = m1Drawings.filter(
        (d: { element: string }) => d.element === 'M1 Bullish Market Structure',
      );
      for (const line of m1BullishLines) {
        expect(line.color).toBe('#10b981');
      }
      const m1Blocks = m1Drawings.filter(
        (d: { type: string }) => d.type === 'poi',
      );
      expect(m1Blocks).toHaveLength(5);

      const m5Candles = content.timeframes?.M5?.candles || [];
      expect(m5Candles[90].high).toBeLessThan(m5Candles[92].low);

      expect(m5Candles[149].open).toBe(m5Candles[149].high);
      expect(m5Candles[149].close).toBe(m5Candles[149].low);
      expect(m5Candles[149].close).toBeLessThan(m5Candles[149].open);

      expect(m5Candles[150].open).toBe(m5Candles[150].high);
      expect(m5Candles[150].close).toBe(m5Candles[150].low);
      expect(m5Candles[150].close).toBeLessThan(m5Candles[150].open);

      const m1Candles = content.timeframes?.M1?.candles || [];
      const m1Lines = m1Drawings.filter(
        (d: { type: string }) => d.type === 'line',
      );
      expect(m1Lines).toHaveLength(6);

      const leg3 = m1Lines.find((l: { id: string }) =>
        l.id.includes('ms-leg3'),
      );
      const leg4 = m1Lines.find((l: { id: string }) =>
        l.id.includes('ms-leg4'),
      );
      const leg5 = m1Lines.find((l: { id: string }) =>
        l.id.includes('ms-leg5'),
      );
      const leg6 = m1Lines.find((l: { id: string }) =>
        l.id.includes('ms-leg6'),
      );

      expect(leg3?.toTime).toBe(m1Candles[1138].time);
      expect(leg4?.fromTime).toBe(m1Candles[1138].time);
      expect(leg4?.toTime).toBe(m1Candles[1145].time);
      expect(leg5?.fromTime).toBe(m1Candles[1145].time);
      expect(leg5?.toTime).toBe(m1Candles[1160].time);
      expect(leg6?.fromTime).toBe(m1Candles[1160].time);
      expect(leg6?.toTime).toBe(m1Candles[1199].time);

      const m1KlInfi = m1Blocks.find((b: { id: string }) =>
        b.id.includes('kl-infinite'),
      );
      const m1PoiInfi = m1Blocks.find((b: { id: string }) =>
        b.id.includes('poi-infinite'),
      );
      expect(m1KlInfi?.fromTime).toBe(m1Candles[1160].time);
      expect(m1PoiInfi?.fromTime).toBe(m1Candles[1179].time);
    });
  });

  describe('Test 5: Timeframe Element Grouping & Quick Bulk Visibility Toggle', () => {
    it('should group elements by sourceTimeframe in correct hierarchical order', () => {
      const sampleElements: ChartElement[] = [
        {
          id: 'el-m1-1',
          name: 'M1 Bullish MS',
          color: '#06b6d4',
          sourceTimeframe: 'M1',
          drawings: [],
          colors: ['#06b6d4'],
        },
        {
          id: 'el-m5-1',
          name: 'M5 Bullish MS',
          color: '#06b6d4',
          sourceTimeframe: 'M5',
          drawings: [],
          colors: ['#06b6d4'],
        },
        {
          id: 'el-m2-1',
          name: 'M2 Bullish MS',
          color: '#06b6d4',
          sourceTimeframe: 'M2',
          drawings: [],
          colors: ['#06b6d4'],
        },
        {
          id: 'el-common-1',
          name: 'Common Note',
          color: '#f97316',
          sourceTimeframe: 'Common',
          drawings: [],
          colors: ['#f97316'],
        },
      ];

      const groups: Record<string, ChartElement[]> = {};
      for (const el of sampleElements) {
        const tf = el.sourceTimeframe || 'Common';
        if (!groups[tf]) groups[tf] = [];
        groups[tf].push(el);
      }

      expect(Object.keys(groups)).toContain('M5');
      expect(Object.keys(groups)).toContain('M2');
      expect(Object.keys(groups)).toContain('M1');
      expect(Object.keys(groups)).toContain('Common');

      const sortedTfs = Object.keys(groups).sort((a, b) => {
        if (a === 'Common') return 1;
        if (b === 'Common') return -1;
        return parseTimeframeDuration(b) - parseTimeframeDuration(a);
      });

      expect(sortedTfs).toEqual(['M5', 'M2', 'M1', 'Common']);
    });

    it('should perform quick bulk toggle for all elements in a specific timeframe', () => {
      const sampleElements: ChartElement[] = [
        {
          id: 'm5-ms-bullish',
          name: 'M5 Bullish MS',
          color: '#06b6d4',
          sourceTimeframe: 'M5',
          drawings: [],
          colors: ['#06b6d4'],
        },
        {
          id: 'm5-ms-bearish',
          name: 'M5 Bearish MS',
          color: '#ef4444',
          sourceTimeframe: 'M5',
          drawings: [],
          colors: ['#ef4444'],
        },
        {
          id: 'm2-ms-bullish',
          name: 'M2 Bullish MS',
          color: '#06b6d4',
          sourceTimeframe: 'M2',
          drawings: [],
          colors: ['#06b6d4'],
        },
      ];

      let elementVisibility: Record<string, boolean> = {};

      const toggleTimeframeVisibility = (
        timeframe: string,
        targetVisible: boolean,
      ) => {
        const targetIds = sampleElements
          .filter((el) => (el.sourceTimeframe || 'Common') === timeframe)
          .map((el) => el.id);

        elementVisibility = { ...elementVisibility };
        for (const id of targetIds) {
          elementVisibility[id] = targetVisible;
        }
      };

      expect(elementVisibility['m5-ms-bullish']).toBeUndefined();
      expect(elementVisibility['m5-ms-bearish']).toBeUndefined();
      expect(elementVisibility['m2-ms-bullish']).toBeUndefined();

      toggleTimeframeVisibility('M5', false);
      expect(elementVisibility['m5-ms-bullish']).toBe(false);
      expect(elementVisibility['m5-ms-bearish']).toBe(false);

      expect(elementVisibility['m2-ms-bullish']).toBeUndefined();

      toggleTimeframeVisibility('M5', true);
      expect(elementVisibility['m5-ms-bullish']).toBe(true);
      expect(elementVisibility['m5-ms-bearish']).toBe(true);
      expect(elementVisibility['m2-ms-bullish']).toBeUndefined();
    });

    it('should allow independent visibility toggling for individual elements inside a timeframe', () => {
      let elementVisibility: Record<string, boolean> = {
        'm5-ms-bullish': true,
        'm5-ms-bearish': true,
      };

      const toggleElementVisibility = (id: string) => {
        elementVisibility = {
          ...elementVisibility,
          [id]:
            elementVisibility[id] === undefined
              ? false
              : !elementVisibility[id],
        };
      };

      toggleElementVisibility('m5-ms-bullish');
      expect(elementVisibility['m5-ms-bullish']).toBe(false);
      expect(elementVisibility['m5-ms-bearish']).toBe(true);

      toggleElementVisibility('m5-ms-bullish');
      expect(elementVisibility['m5-ms-bullish']).toBe(true);
    });
  });

  describe('Test 6: Formatting & Linting Cache Configuration for Performance', () => {
    it('should configure prettier with --cache and --cache-strategy content in package.json and lint-staged', () => {
      const packageJsonPath = path.join(root, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      expect(pkg.scripts?.format).toContain('--cache');
      expect(pkg.scripts?.format).toContain('--cache-strategy content');

      expect(pkg['lint-staged']).toBeDefined();
      const tsRules = pkg['lint-staged']['*.{ts,tsx}'];
      const assetRules = pkg['lint-staged']['*.{json,md,css,scss}'];

      expect(tsRules).toBeDefined();
      expect(
        tsRules.some(
          (r: string) =>
            r.includes('prettier') &&
            r.includes('--cache') &&
            r.includes('--cache-strategy content'),
        ),
      ).toBe(true);

      expect(assetRules).toBeDefined();
      expect(
        assetRules.some(
          (r: string) =>
            r.includes('prettier') &&
            r.includes('--cache') &&
            r.includes('--cache-strategy content'),
        ),
      ).toBe(true);
    });
  });
});
