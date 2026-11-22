import { type ThemeMode, type ThemeColors } from '../types/theme.js';

export const THEME_STORAGE_KEY = 'forex_chart_theme';

export const THEME_PALETTES: Record<ThemeMode, ThemeColors> = {
  dark: {
    chart: {
      background: '#090d16',
      textColor: '#94a3b8',
      fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
      vertGridColor: 'rgba(51, 65, 85, 0.22)',
      horzGridColor: 'rgba(51, 65, 85, 0.22)',
      crosshairColor: '#64748b',
      crosshairLabelBg: '#1e293b',
      priceScaleBorderColor: '#334155',
      timeScaleBorderColor: '#334155',
      upCandleColor: '#10b981',
      downCandleColor: '#ef4444',
      contextMenuBg: '#1e222d',
      contextMenuBorder: '#334155',
      contextMenuText: '#e2e8f0',
      contextMenuHoverBg: 'rgba(14, 165, 233, 0.25)',
    },
    canvas: {
      lineHoverColor: '#ffffff',
      zoneHoverBorderColor: '#ffffff',
      zoneLabelBg: 'rgba(9, 13, 22, 0.88)',
      zoneLabelBorderAlpha: 0.65,
      zoneLabelTextColor: '#e2e8f0',
      zoneLabelHoverTextColor: '#ffffff',
    },
  },
  light: {
    chart: {
      background: '#ffffff',
      textColor: '#475569',
      fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace",
      vertGridColor: 'rgba(226, 232, 240, 0.8)',
      horzGridColor: 'rgba(226, 232, 240, 0.8)',
      crosshairColor: '#94a3b8',
      crosshairLabelBg: '#e2e8f0',
      priceScaleBorderColor: '#e2e8f0',
      timeScaleBorderColor: '#e2e8f0',
      upCandleColor: '#10b981',
      downCandleColor: '#ef4444',
      contextMenuBg: '#ffffff',
      contextMenuBorder: '#e2e8f0',
      contextMenuText: '#0f172a',
      contextMenuHoverBg: 'rgba(14, 165, 233, 0.12)',
    },
    canvas: {
      lineHoverColor: '#0f172a',
      zoneHoverBorderColor: '#0f172a',
      zoneLabelBg: 'rgba(255, 255, 255, 0.94)',
      zoneLabelBorderAlpha: 0.75,
      zoneLabelTextColor: '#1e293b',
      zoneLabelHoverTextColor: '#0f172a',
    },
  },
};

export function getDeviceTheme(): ThemeMode {
  if (typeof window !== 'undefined' && window.matchMedia) {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  }
  return 'dark';
}

export function getInitialTheme(): ThemeMode {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch {}
  }
  return getDeviceTheme();
}

export function saveTheme(theme: ThemeMode): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }
}

export function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }
}

export function parseColorToRgb(
  color: string,
): { r: number; g: number; b: number } | null {
  if (!color || typeof color !== 'string') return null;
  const str = color.trim().toLowerCase();

  if (str.startsWith('#')) {
    const hex = str.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0]! + hex[0]!, 16);
      const g = parseInt(hex[1]! + hex[1]!, 16);
      const b = parseInt(hex[2]! + hex[2]!, 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return { r, g, b };
    } else if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return { r, g, b };
    }
  }

  const rgbMatch = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1] ?? '0', 10);
    const g = parseInt(rgbMatch[2] ?? '0', 10);
    const b = parseInt(rgbMatch[3] ?? '0', 10);
    return { r, g, b };
  }

  return null;
}

export function getLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = parseColorToRgb(color1);
  const rgb2 = parseColorToRgb(color2);
  if (!rgb1 || !rgb2) return 1;

  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function adaptColorForTheme(color: string, theme: ThemeMode): string {
  if (!color || typeof color !== 'string') {
    return theme === 'light' ? '#0f172a' : '#ffffff';
  }

  const rgb = parseColorToRgb(color);
  if (!rgb) return color;

  const lum = getLuminance(rgb.r, rgb.g, rgb.b);

  if (theme === 'light') {
    if (lum > 0.88) {
      return '#0f172a';
    }
  } else {
    if (lum < 0.1) {
      return '#f8fafc';
    }
  }

  return color;
}

export function getThemeChartOptions(theme: ThemeMode) {
  const p = THEME_PALETTES[theme].chart;
  return {
    layout: {
      background: { color: p.background },
      textColor: p.textColor,
      fontSize: p.fontSize,
      fontFamily: p.fontFamily,
    },
    grid: {
      vertLines: { color: p.vertGridColor, style: 1 },
      horzLines: { color: p.horzGridColor, style: 1 },
    },
    crosshair: {
      vertLine: {
        color: p.crosshairColor,
        labelBackgroundColor: p.crosshairLabelBg,
      },
      horzLine: {
        color: p.crosshairColor,
        labelBackgroundColor: p.crosshairLabelBg,
      },
    },
    rightPriceScale: {
      borderColor: p.priceScaleBorderColor,
    },
    timeScale: {
      borderColor: p.timeScaleBorderColor,
    },
  };
}
