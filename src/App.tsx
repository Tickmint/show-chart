import type React from 'react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { Upload, Eye, EyeOff } from 'lucide-react';
import {
  type ForexChartData,
  type LineDrawing,
  type TimeframeData,
  type ChartElement,
} from './types/chart.js';
import { canInheritTimeframe } from './utils/timeframeService.js';
import { LineItemsPopover } from './components/Controls/LineItemsPopover.js';
import {
  ForexChart,
  type ForexChartRef,
} from './components/Chart/ForexChart.js';
import { UploadModal } from './components/Modals/UploadModal.js';

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
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);

  const availableTimeframes = useMemo(
    () => Object.keys(chartData.timeframes || {}),
    [chartData.timeframes],
  );

  const currentTfData = useMemo(() => {
    return (
      chartData.timeframes?.[currentTimeframe] || { candles: [], drawings: [] }
    );
  }, [chartData, currentTimeframe]);

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

  const allElements = useMemo(() => {
    const map = new Map<string, ChartElement>();

    for (const d of allDrawings) {
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
  }, [allDrawings]);

  const visibleElementsCount = useMemo(() => {
    return allElements.filter((el) => elementVisibility[el.id] !== false)
      .length;
  }, [allElements, elementVisibility]);

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
      setCurrentTimeframe(newData.defaultTimeframe || tfs[0] || '');
    }
    setElementVisibility({});
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
    <div className="relative h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100 select-none">
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

      <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 shadow-lg backdrop-blur-md font-medium text-xs transition-all hover:border-slate-600 cursor-pointer"
          title="Upload .json or .gz file"
        >
          <Upload className="w-3.5 h-3.5 text-sky-400" />
          <span>Upload</span>
        </button>

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
            {visibleElementsCount}/{allElements.length}
          </span>
        </button>
      </div>

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

        {currentTfData.candles.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 pointer-events-none">
            <div className="bg-[#0e1422]/90 border border-slate-800 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl backdrop-blur-md pointer-events-auto">
              <div className="w-12 h-12 mx-auto rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-sky-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-100 mb-1">
                Forex Chart Viewer
              </h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Upload a JSON or GZ chart data file to view candlesticks and
                price action market structure.
              </p>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition-colors shadow-lg cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Chart Data</span>
              </button>
            </div>
          </div>
        )}

        <LineItemsPopover
          isOpen={isPopoverOpen}
          onClose={() => setIsPopoverOpen(false)}
          elements={allElements}
          elementVisibility={elementVisibility}
          onToggleElementVisibility={handleToggleElementVisibility}
          hoveredElementId={hoveredElementId}
          onHoverElement={setHoveredElementId}
        />
      </main>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onDataLoaded={handleDataLoaded}
      />
    </div>
  );
};

export default App;
