import type React from 'react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  type ForexChartData,
  type LineDrawing,
  type TimeframeData,
  type ChartElement,
} from './types/chart.js';
import {
  canInheritTimeframe,
  getLargestTimeframe,
  parseTimeframeDuration,
} from './utils/timeframeService.js';
import { LineItemsPopover } from './components/Controls/LineItemsPopover.js';
import {
  ForexChart,
  type ForexChartRef,
} from './components/Chart/ForexChart.js';
import { UploadModal } from './components/Modals/UploadModal.js';
import { parseChartFile } from './utils/fileParser.js';

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

  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);
  const [hoveredDrawingId, setHoveredDrawingId] = useState<string | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

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
    const list: LineDrawing[] = [];

    if (chartData.commonDrawings && Array.isArray(chartData.commonDrawings)) {
      list.push(...(chartData.commonDrawings as LineDrawing[]));
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

  const currentActiveLines = useMemo(() => {
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

    for (const d of currentActiveLines) {
      const elId = d.element || d.group || 'Elements';

      const existing = map.get(elId);
      if (existing) {
        existing.drawings.push(d);
        if (!existing.colors.includes(d.color)) {
          existing.colors.push(d.color);
        }
      } else {
        map.set(elId, {
          id: elId,
          name: elId,
          color: d.color,
          drawings: [d],
          colors: [d.color],
        });
      }
    }

    return Array.from(map.values());
  }, [currentActiveLines]);

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

  const handleDataLoaded = (newData: ForexChartData) => {
    setChartData(newData);
    const tfs = Object.keys(newData.timeframes || {});
    if (tfs.length > 0) {
      const largestTf = getLargestTimeframe(tfs, newData.timeframeUnits);
      setCurrentTimeframe(largestTf);
    }
    setElementVisibility({});
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
      className="relative h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100 select-none"
    >
      {availableTimeframes.length > 0 && (
        <div className="absolute top-3 left-3 z-30 flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-700/80 shadow-lg backdrop-blur-md">
          {availableTimeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setCurrentTimeframe(tf)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                currentTimeframe === tf
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      )}

      {hasCandles && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          <button
            id="btn-show-hide-item"
            onClick={() => setIsPopoverOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium border text-xs shadow-lg backdrop-blur-md transition-all cursor-pointer ${
              isPopoverOpen
                ? 'bg-sky-500/25 text-sky-300 border-sky-500/60 shadow-sky-500/10'
                : 'bg-slate-900/90 text-slate-200 border-slate-700/80 hover:bg-slate-800 hover:border-slate-600'
            }`}
            title="Show / Hide active elements in this timeframe"
          >
            {visibleElementsCount > 0 ? (
              <Eye className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>Elements</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/50 text-sky-300 font-mono">
              {visibleElementsCount}/{activeElements.length}
            </span>
          </button>
        </div>
      )}

      <main className="w-full h-full relative">
        <ForexChart
          ref={chartRef}
          candles={currentTfData.candles}
          drawings={currentActiveLines}
          currentTimeframe={currentTimeframe}
          timeframeUnits={chartData.timeframeUnits}
          isDrawingsVisible={true}
          scopeFilter={{ common: true, timeframe: true }}
          elementVisibility={elementVisibility}
          hoveredDrawingId={hoveredDrawingId}
          hoveredElementId={hoveredElementId}
          onHoverDrawing={setHoveredDrawingId}
        />

        <LineItemsPopover
          isOpen={isPopoverOpen}
          onClose={() => setIsPopoverOpen(false)}
          elements={activeElements}
          elementVisibility={elementVisibility}
          onToggleElementVisibility={handleToggleElementVisibility}
          hoveredElementId={hoveredElementId}
          onHoverElement={setHoveredElementId}
        />
      </main>

      {!hasCandles && (
        <UploadModal
          isOpen={true}
          showCloseButton={false}
          onDataLoaded={handleDataLoaded}
        />
      )}
    </div>
  );
};

export default App;
