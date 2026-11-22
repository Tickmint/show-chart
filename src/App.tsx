import type React from 'react';
import { useState, useMemo, useCallback, useRef } from 'react';
import {
  type ForexChartData,
  type LineDrawing,
  type OHLCData,
  type TimeframeData,
  type ChartElement,
} from './types/chart.js';
import { getSampleForexData } from './utils/sampleData.js';
import { canInheritTimeframe } from './utils/timeframeService.js';
import { TopControlBar } from './components/Controls/TopControlBar.js';
import { LineItemsPopover } from './components/Controls/LineItemsPopover.js';
import {
  ForexChart,
  type ForexChartRef,
} from './components/Chart/ForexChart.js';
import { StatusBar } from './components/StatusBar/StatusBar.js';
import { UploadModal } from './components/Modals/UploadModal.js';
import { SchemaHelpModal } from './components/Modals/SchemaHelpModal.js';

export const App: React.FC = () => {
  const chartRef = useRef<ForexChartRef>(null);
  const [chartData, setChartData] = useState<ForexChartData>(() =>
    getSampleForexData(),
  );
  const [currentTimeframe, setCurrentTimeframe] = useState<string>('H4');

  const [elementVisibility, setElementVisibility] = useState<{
    [id: string]: boolean;
  }>({});

  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);

  const [hoveredDrawingId, setHoveredDrawingId] = useState<string | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [crosshairOHLC, setCrosshairOHLC] = useState<OHLCData | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);

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

  const activeElements = useMemo(() => {
    const map = new Map<string, ChartElement>();

    for (const d of currentActiveLines) {
      const elId =
        d.element ||
        d.group ||
        (d.sourceTimeframe ? `Timeframe ${d.sourceTimeframe}` : 'Common');

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
          sourceTimeframe: d.sourceTimeframe,
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

  const handleCrosshairMove = useCallback((data: OHLCData | null) => {
    setCrosshairOHLC(data);
  }, []);

  const handleToggleElementVisibility = (id: string) => {
    setElementVisibility((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const handleLoadSample = () => {
    const sample = getSampleForexData();
    setChartData(sample);
    setCurrentTimeframe(sample.defaultTimeframe || 'H4');
    setElementVisibility({});
  };

  const handleDataLoaded = (newData: ForexChartData) => {
    setChartData(newData);
    const tfs = Object.keys(newData.timeframes || {});
    if (tfs.length > 0) {
      setCurrentTimeframe(newData.defaultTimeframe || tfs[0] || 'H4');
    }
    setElementVisibility({});
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100">
      <TopControlBar
        chartData={chartData}
        currentTimeframe={currentTimeframe}
        onSelectTimeframe={setCurrentTimeframe}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        onLoadSample={handleLoadSample}
        onOpenHelp={() => setIsHelpModalOpen(true)}
        isPopoverOpen={isPopoverOpen}
        onTogglePopover={() => setIsPopoverOpen((prev) => !prev)}
        activeElementsCount={activeElements.length}
        visibleElementsCount={visibleElementsCount}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 h-full relative">
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
            onCrosshairMove={handleCrosshairMove}
          />

          <LineItemsPopover
            isOpen={isPopoverOpen}
            onClose={() => setIsPopoverOpen(false)}
            elements={activeElements}
            currentTimeframe={currentTimeframe}
            elementVisibility={elementVisibility}
            onToggleElementVisibility={handleToggleElementVisibility}
            hoveredElementId={hoveredElementId}
            onHoverElement={setHoveredElementId}
          />
        </main>
      </div>

      <StatusBar
        ohlc={crosshairOHLC}
        currentTimeframe={currentTimeframe}
        candlesCount={currentTfData.candles.length}
        symbol={chartData.symbol || 'EUR/USD'}
        visibleElementsCount={visibleElementsCount}
        totalElementsCount={activeElements.length}
      />

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onDataLoaded={handleDataLoaded}
      />

      <SchemaHelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </div>
  );
};

export default App;
