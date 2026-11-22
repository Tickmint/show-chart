import type React from 'react';
import { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { Eye, EyeOff, Sun, Moon } from 'lucide-react';
import {
  type ForexChartData,
  type Drawing,
  type TimeframeData,
  type ChartElement,
} from './types/chart.js';
import { type ThemeMode } from './types/theme.js';
import {
  getInitialTheme,
  saveTheme,
  applyThemeToDocument,
  THEME_STORAGE_KEY,
} from './utils/themeService.js';
import {
  canInheritTimeframe,
  getLargestTimeframe,
  parseTimeframeDuration,
} from './utils/timeframeService.js';
import { type ForexChartRef } from './components/Chart/ForexChart.js';
import { parseChartFile } from './utils/fileParser.js';

const ForexChart = lazy(() => import('./components/Chart/ForexChart.js'));
const LineItemsPopover = lazy(
  () => import('./components/Controls/LineItemsPopover.js'),
);
const UploadModal = lazy(() => import('./components/Modals/UploadModal.js'));

export const App: React.FC = () => {
  const chartRef = useRef<ForexChartRef>(null);
  const [chartData, setChartData] = useState<ForexChartData>({
    symbol: '',
    timeframes: {},
  });
  const [currentTimeframe, setCurrentTimeframe] = useState<string>('');

  const [elementVisibility, setElementVisibility] = useState<{
    [id: string]: boolean;
  }>({});
  const [customElementNames, setCustomElementNames] = useState<{
    [id: string]: string;
  }>({});

  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);
  const [hoveredDrawingId, setHoveredDrawingId] = useState<string | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [priceScaleWidth, setPriceScaleWidth] = useState<number>(68);

  const handleToggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    saveTheme(nextTheme);
    applyThemeToDocument(nextTheme);
  };

  useEffect(() => {
    applyThemeToDocument(theme);

    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mediaQuery) return;

    const handleChange = (e: MediaQueryListEvent) => {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (!stored) {
          const sysTheme: ThemeMode = e.matches ? 'dark' : 'light';
          setTheme(sysTheme);
          applyThemeToDocument(sysTheme);
        }
      } catch {}
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const availableTimeframes = useMemo(() => {
    const tfs = Object.keys(chartData.timeframes || {});
    return tfs.sort(
      (a, b) =>
        parseTimeframeDuration(b, chartData.timeframeUnits) -
        parseTimeframeDuration(a, chartData.timeframeUnits),
    );
  }, [chartData.timeframes, chartData.timeframeUnits]);

  const currentTfData = useMemo(() => {
    return (
      chartData.timeframes?.[currentTimeframe] || { candles: [], drawings: [] }
    );
  }, [chartData, currentTimeframe]);

  const hasCandles = currentTfData.candles.length > 0;

  const allDrawings = useMemo(() => {
    const list: Drawing[] = [];

    if (chartData.commonDrawings && Array.isArray(chartData.commonDrawings)) {
      list.push(...chartData.commonDrawings);
    }

    if (chartData.timeframes) {
      for (const [tf, data] of Object.entries(chartData.timeframes) as [
        string,
        TimeframeData,
      ][]) {
        if (data.drawings && Array.isArray(data.drawings)) {
          for (const d of data.drawings) {
            list.push({ ...d, sourceTimeframe: d.sourceTimeframe || tf });
          }
        }
      }
    }

    return list;
  }, [chartData]);

  const currentActiveDrawings = useMemo(() => {
    return allDrawings.filter((d) => {
      const srcTf = d.sourceTimeframe;
      if (srcTf) {
        return canInheritTimeframe(
          srcTf,
          currentTimeframe,
          chartData.timeframeUnits,
        );
      }
      return true;
    });
  }, [allDrawings, currentTimeframe, chartData.timeframeUnits]);

  const activeElements = useMemo(() => {
    const map = new Map<string, ChartElement>();

    for (const d of currentActiveDrawings) {
      const elId = d.element || d.group || 'Elements';
      const customName =
        customElementNames[elId] || d.displayName || d.element || elId;

      const existing = map.get(elId);
      if (existing) {
        existing.drawings.push(d);
        if (!existing.colors.includes(d.color)) {
          existing.colors.push(d.color);
        }
      } else {
        map.set(elId, {
          id: elId,
          name: customName,
          displayName: customName,
          color: d.color,
          drawings: [d],
          colors: [d.color],
        });
      }
    }

    return Array.from(map.values());
  }, [currentActiveDrawings, customElementNames]);

  const visibleElementsCount = useMemo(() => {
    return activeElements.filter((el) => elementVisibility[el.id] !== false)
      .length;
  }, [activeElements, elementVisibility]);

  const handleToggleElementVisibility = (id: string) => {
    setElementVisibility((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const handleUpdateElementName = (id: string, newName: string) => {
    setCustomElementNames((prev) => ({
      ...prev,
      [id]: newName,
    }));
  };

  const handleDataLoaded = (newData: ForexChartData) => {
    setChartData(newData);
    const tfs = Object.keys(newData.timeframes || {});
    if (tfs.length > 0) {
      const largestTf = getLargestTimeframe(tfs, newData.timeframeUnits);
      setCurrentTimeframe(largestTf);
    }
    setElementVisibility({});
    setCustomElementNames({});
  };

  const handleDropOnWindow = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      try {
        const { data } = await parseChartFile(file);
        handleDataLoaded(data);
      } catch {}
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= availableTimeframes.length) {
        const tf = availableTimeframes[num - 1];
        if (tf) setCurrentTimeframe(tf);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [availableTimeframes]);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDropOnWindow}
      className="relative h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#090d16] text-slate-800 dark:text-slate-100 select-none"
    >
      {availableTimeframes.length > 0 && (
        <div className="absolute top-3 left-3 z-30 flex items-center bg-white/90 dark:bg-slate-900/90 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/80 backdrop-blur-md">
          {availableTimeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setCurrentTimeframe(tf)}
              className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                currentTimeframe === tf
                  ? 'bg-sky-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      )}

      <div
        className="absolute top-3 z-30 flex items-center gap-2"
        style={{ right: `${Math.max(76, priceScaleWidth) + 12}px` }}
      >
        {hasCandles && (
          <div className="relative">
            <button
              id="btn-show-hide-item"
              onClick={() => setIsPopoverOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium border text-xs backdrop-blur-md cursor-pointer ${
                isPopoverOpen
                  ? 'bg-sky-500/25 text-sky-600 dark:text-sky-300 border-sky-500/60'
                  : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Show / Hide active elements in this timeframe"
            >
              {visibleElementsCount > 0 ? (
                <Eye className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>Elements</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-black/50 text-sky-600 dark:text-sky-300 font-mono">
                {visibleElementsCount}/{activeElements.length}
              </span>
            </button>

            {isPopoverOpen && (
              <Suspense fallback={null}>
                <LineItemsPopover
                  isOpen={isPopoverOpen}
                  onClose={() => setIsPopoverOpen(false)}
                  elements={activeElements}
                  elementVisibility={elementVisibility}
                  onToggleElementVisibility={handleToggleElementVisibility}
                  hoveredElementId={hoveredElementId}
                  onHoverElement={setHoveredElementId}
                  onUpdateElementName={handleUpdateElementName}
                />
              </Suspense>
            )}
          </div>
        )}

        <button
          id="btn-toggle-theme"
          onClick={handleToggleTheme}
          className="flex items-center justify-center p-1.5 rounded-lg font-medium border text-xs backdrop-blur-md cursor-pointer bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800"
          title={
            theme === 'dark' ? 'Switch to white mode' : 'Switch to dark mode'
          }
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>
      </div>

      <main className="w-full h-full relative">
        <Suspense
          fallback={
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#090d16] text-slate-500 dark:text-slate-400 gap-3">
              <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full" />
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Loading chart...
              </span>
            </div>
          }
        >
          <ForexChart
            ref={chartRef}
            candles={currentTfData.candles}
            drawings={currentActiveDrawings}
            currentTimeframe={currentTimeframe}
            timeframeUnits={chartData.timeframeUnits}
            isDrawingsVisible={true}
            scopeFilter={{ common: true, timeframe: true }}
            elementVisibility={elementVisibility}
            hoveredDrawingId={hoveredDrawingId}
            hoveredElementId={hoveredElementId}
            onHoverDrawing={setHoveredDrawingId}
            theme={theme}
            onPriceScaleWidthChange={setPriceScaleWidth}
          />
        </Suspense>
      </main>

      {!hasCandles && (
        <Suspense fallback={null}>
          <UploadModal
            isOpen={true}
            showCloseButton={false}
            onDataLoaded={handleDataLoaded}
          />
        </Suspense>
      )}
    </div>
  );
};

export default App;
