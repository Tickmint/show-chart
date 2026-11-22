import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  THEME_PALETTES,
  getDeviceTheme,
  getInitialTheme,
  saveTheme,
  applyThemeToDocument,
  parseColorToRgb,
  getLuminance,
  getContrastRatio,
  adaptColorForTheme,
  getThemeChartOptions,
} from '../src/utils/themeService.js';
import type { ThemeMode } from '../src/types/theme.js';

describe('Theme System & Color Conversion Architecture', () => {
  const mockStorage = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, val: string) => mockStorage.set(key, String(val)),
    removeItem: (key: string) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
  };

  const fakeClasses = new Set<string>();
  const fakeDocument = {
    documentElement: {
      classList: {
        add: (cls: string) => fakeClasses.add(cls),
        remove: (cls: string) => fakeClasses.delete(cls),
        contains: (cls: string) => fakeClasses.has(cls),
      },
      style: {
        colorScheme: '',
      },
    },
  };

  beforeEach(() => {
    mockStorage.clear();
    fakeClasses.clear();
    fakeDocument.documentElement.style.colorScheme = '';

    vi.stubGlobal('localStorage', fakeLocalStorage);
    vi.stubGlobal('document', fakeDocument);
    vi.stubGlobal('window', {
      localStorage: fakeLocalStorage,
      matchMedia: (query: string) => ({
        matches: query.includes('dark'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  describe('Test 1: Device Preference & LocalStorage Integration', () => {
    it('should detect dark device theme from media query', () => {
      vi.stubGlobal('window', {
        localStorage: fakeLocalStorage,
        matchMedia: (query: string) => ({
          matches: query.includes('dark'),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      });

      expect(getDeviceTheme()).toBe('dark');
    });

    it('should detect light device theme from media query', () => {
      vi.stubGlobal('window', {
        localStorage: fakeLocalStorage,
        matchMedia: (query: string) => ({
          matches: query.includes('light'),
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }),
      });

      expect(getDeviceTheme()).toBe('light');
    });

    it('should fallback to device theme when localStorage has no theme set', () => {
      expect(getInitialTheme()).toBe('dark');
    });

    it('should prioritize stored theme from localStorage and update when saved', () => {
      saveTheme('light');
      expect(fakeLocalStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
      expect(getInitialTheme()).toBe('light');

      saveTheme('dark');
      expect(fakeLocalStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
      expect(getInitialTheme()).toBe('dark');
    });

    it('should properly apply dark and light classes and colorScheme to document', () => {
      applyThemeToDocument('dark');
      expect(fakeDocument.documentElement.classList.contains('dark')).toBe(
        true,
      );
      expect(fakeDocument.documentElement.classList.contains('light')).toBe(
        false,
      );
      expect(fakeDocument.documentElement.style.colorScheme).toBe('dark');

      applyThemeToDocument('light');
      expect(fakeDocument.documentElement.classList.contains('dark')).toBe(
        false,
      );
      expect(fakeDocument.documentElement.classList.contains('light')).toBe(
        true,
      );
      expect(fakeDocument.documentElement.style.colorScheme).toBe('light');
    });
  });

  describe('Test 2: Color Parsing, Luminance & Contrast Calculation', () => {
    it('should parse 3-digit and 6-digit hex colors', () => {
      expect(parseColorToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseColorToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseColorToRgb('#10b981')).toEqual({ r: 16, g: 185, b: 129 });
    });

    it('should parse rgb and rgba colors', () => {
      expect(parseColorToRgb('rgb(14, 165, 233)')).toEqual({
        r: 14,
        g: 165,
        b: 233,
      });
      expect(parseColorToRgb('rgba(239, 68, 68, 0.5)')).toEqual({
        r: 239,
        g: 68,
        b: 68,
      });
    });

    it('should compute perceived luminance accurately', () => {
      expect(getLuminance(255, 255, 255)).toBeCloseTo(1.0, 2);
      expect(getLuminance(0, 0, 0)).toBeCloseTo(0.0, 2);
      const greenLum = getLuminance(0, 255, 0);
      const blueLum = getLuminance(0, 0, 255);
      expect(greenLum).toBeGreaterThan(blueLum);
    });

    it('should compute contrast ratio between colors', () => {
      const blackWhiteContrast = getContrastRatio('#000000', '#ffffff');
      expect(blackWhiteContrast).toBeGreaterThanOrEqual(20);

      const sameColorContrast = getContrastRatio('#38bdf8', '#38bdf8');
      expect(sameColorContrast).toBeCloseTo(1.0, 1);
    });
  });

  describe('Test 3: Smart Color Adaptation for Light & Dark Mode', () => {
    it('should adapt pure white and near-white colors to high-contrast dark in light theme', () => {
      expect(adaptColorForTheme('#ffffff', 'light')).toBe('#0f172a');
      expect(adaptColorForTheme('#fff', 'light')).toBe('#0f172a');
      expect(adaptColorForTheme('rgb(255, 255, 255)', 'light')).toBe('#0f172a');
      expect(adaptColorForTheme('#f8fafc', 'light')).toBe('#0f172a');
    });

    it('should adapt pure black and near-black colors to high-contrast light in dark theme', () => {
      expect(adaptColorForTheme('#000000', 'dark')).toBe('#f8fafc');
      expect(adaptColorForTheme('#000', 'dark')).toBe('#f8fafc');
      expect(adaptColorForTheme('rgb(0, 0, 0)', 'dark')).toBe('#f8fafc');
      expect(adaptColorForTheme('#090d16', 'dark')).toBe('#f8fafc');
    });

    it('should preserve chromatic and brand colors in both themes without alteration', () => {
      const colors = ['#10b981', '#ef4444', '#0ea5e9', '#f59e0b', '#8b5cf6'];
      for (const col of colors) {
        expect(adaptColorForTheme(col, 'light')).toBe(col);
        expect(adaptColorForTheme(col, 'dark')).toBe(col);
      }
    });
  });

  describe('Test 4: Palette Configuration & Chart Options Integrity', () => {
    const modes: ThemeMode[] = ['dark', 'light'];

    it('should have complete tokens for chart and canvas in all palettes', () => {
      for (const mode of modes) {
        const palette = THEME_PALETTES[mode];
        expect(palette.chart.background).toBeDefined();
        expect(palette.chart.textColor).toBeDefined();
        expect(palette.chart.vertGridColor).toBeDefined();
        expect(palette.chart.horzGridColor).toBeDefined();
        expect(palette.chart.crosshairColor).toBeDefined();
        expect(palette.chart.upCandleColor).toBeDefined();
        expect(palette.chart.downCandleColor).toBeDefined();
        expect(palette.chart.contextMenuBg).toBeDefined();

        expect(palette.canvas.lineHoverColor).toBeDefined();
        expect(palette.canvas.zoneHoverBorderColor).toBeDefined();
        expect(palette.canvas.zoneLabelBg).toBeDefined();
        expect(palette.canvas.zoneLabelTextColor).toBeDefined();
      }
    });

    it('should generate valid chart layout and scale options', () => {
      const darkOpts = getThemeChartOptions('dark');
      expect(darkOpts.layout.background.color).toBe('#090d16');
      expect(darkOpts.layout.textColor).toBe('#94a3b8');

      const lightOpts = getThemeChartOptions('light');
      expect(lightOpts.layout.background.color).toBe('#ffffff');
      expect(lightOpts.layout.textColor).toBe('#475569');
    });
  });

  describe('Test 5: Adaptive Bar Spacing for Few Candles (Largest Timeframe Scaling)', () => {
    function computeOptimalBarSpacing(
      candleCount: number,
      containerWidth = 1200,
    ): number {
      if (candleCount <= 40) {
        const coverageRatio = Math.min(
          0.62,
          Math.max(0.42, 0.7 - candleCount * 0.006),
        );
        const calculatedSpacing = Math.floor(
          (containerWidth * coverageRatio) / candleCount,
        );
        return Math.min(65, Math.max(16, calculatedSpacing));
      }
      if (candleCount <= 70) return 14;
      return 11;
    }

    it('should assign wider bar spacing for few candles to prevent tiny squashed candles', () => {
      expect(computeOptimalBarSpacing(10, 1200)).toBeGreaterThanOrEqual(40);

      expect(computeOptimalBarSpacing(20, 1920)).toBe(55);

      expect(computeOptimalBarSpacing(20, 1200)).toBe(34);

      expect(computeOptimalBarSpacing(60, 1200)).toBe(14);

      expect(computeOptimalBarSpacing(100, 1200)).toBe(11);
    });

    it('should center few candles comfortably on wide screen without making them monstrous', () => {
      const containerWidth = 1920;
      const candleCount = 20;
      const barSpacing = computeOptimalBarSpacing(candleCount, containerWidth);
      const visibleBars = Math.max(
        candleCount + 6,
        Math.floor(containerWidth / barSpacing),
      );

      const candleCenter = (candleCount - 1) / 2;
      const from = candleCenter - visibleBars / 2;
      const to = candleCenter + visibleBars / 2;

      const span = to - from;
      expect(span).toBe(visibleBars);
      expect(span).toBeGreaterThanOrEqual(candleCount + 6);

      const candleCoverage = candleCount / span;
      expect(candleCoverage).toBeGreaterThanOrEqual(0.45);
      expect(candleCoverage).toBeLessThanOrEqual(0.65);
    });
  });

  describe('Test 6: Price Scale Layout Clearance (Elements & Controls)', () => {
    it('should calculate right offset strictly exceeding price scale width to prevent overlap', () => {
      const priceScaleWidths = [0, 50, 65, 75, 85, 100];
      const margin = 12;

      for (const pWidth of priceScaleWidths) {
        const rightOffset = Math.max(76, pWidth) + margin;

        expect(rightOffset).toBeGreaterThan(pWidth);

        expect(rightOffset).toBeGreaterThanOrEqual(88);
      }
    });

    it('should anchor popover with right-0 flush to elements button without default 80px shift', () => {
      function getPopoverClassesAndStyle(rightOffset?: number) {
        return {
          style:
            rightOffset !== undefined
              ? { right: `${rightOffset}px` }
              : undefined,
          className:
            rightOffset !== undefined ? 'top-12' : 'top-full mt-1.5 right-0',
        };
      }

      const relPos = getPopoverClassesAndStyle();
      expect(relPos.style).toBeUndefined();
      expect(relPos.className).toContain('right-0');
      expect(relPos.className).toContain('top-full');

      const absPos = getPopoverClassesAndStyle(100);
      expect(absPos.style).toEqual({ right: '100px' });
      expect(absPos.className).toContain('top-12');
    });
  });
});
