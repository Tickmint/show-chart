import type React from 'react';
import { useState, useMemo } from 'react';
import {
  type ForexChartData,
  type LineDrawing,
  type OHLCData,
  type TimeframeData,
} from './types/chart.js';
import { getSampleForexData } from './utils/sampleData.js';
import { TopControlBar } from './components/Controls/TopControlBar.js';
import { LineItemsPopover } from './components/Controls/LineItemsPopover.js';
import { ForexChart } from './components/Chart/ForexChart.js';
import { StatusBar } from './components/StatusBar/StatusBar.js';
import { UploadModal } from './components/Modals/UploadModal.js';
import { SchemaHelpModal } from './components/Modals/SchemaHelpModal.js';

export const App: React.FC = () => {
  const [chartData, setChartData] = useState<ForexChartData>(() =>
    getSampleForexData(),
  );
  const [currentTimeframe, setCurrentTimeframe] = useState<string>('H4');

  const [individualVisibility, setIndividualVisibility] = useState<{
    [id: string]: boolean;
  }>({});

  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);

  const [hoveredDrawingId, setHoveredDrawingId] = useState<string | null>(null);
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
      const isCommon = !d.sourceTimeframe;
      const isCurrentTf = d.sourceTimeframe === currentTimeframe;
      if (!isCommon && !isCurrentTf && d.stretch === false) {
        return false;
      }
      return true;
    });
  }, [allDrawings, currentTimeframe]);

  const visibleLinesCount = useMemo(() => {
    return currentActiveLines.filter(
      (d) => individualVisibility[d.id] !== false,
    ).length;
  }, [currentActiveLines, individualVisibility]);

  const handleToggleIndividualVisibility = (id: string) => {
    setIndividualVisibility((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const handleLoadSample = () => {
    const sample = getSampleForexData();
    setChartData(sample);
    setCurrentTimeframe(sample.defaultTimeframe || 'H4');
    setIndividualVisibility({});
  };

  const handleDataLoaded = (newData: ForexChartData) => {
    setChartData(newData);
    const tfs = Object.keys(newData.timeframes || {});
    if (tfs.length > 0) {
      setCurrentTimeframe(newData.defaultTimeframe || tfs[0] || 'H4');
    }
    setIndividualVisibility({});
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
        activeLinesCount={currentActiveLines.length}
        visibleLinesCount={visibleLinesCount}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 h-full relative">
          <ForexChart
            candles={currentTfData.candles}
            drawings={currentActiveLines}
            currentTimeframe={currentTimeframe}
            isDrawingsVisible={true}
            scopeFilter={{ common: true, timeframe: true }}
            individualVisibility={individualVisibility}
            hoveredDrawingId={hoveredDrawingId}
            onHoverDrawing={setHoveredDrawingId}
            onCrosshairMove={setCrosshairOHLC}
          />

          <LineItemsPopover
            isOpen={isPopoverOpen}
            onClose={() => setIsPopoverOpen(false)}
            drawings={currentActiveLines}
            currentTimeframe={currentTimeframe}
            individualVisibility={individualVisibility}
            onToggleVisibility={handleToggleIndividualVisibility}
            hoveredDrawingId={hoveredDrawingId}
            onHoverDrawing={setHoveredDrawingId}
          />
        </main>
      </div>

      <StatusBar
        ohlc={crosshairOHLC}
        currentTimeframe={currentTimeframe}
        candlesCount={currentTfData.candles.length}
        symbol={chartData.symbol || 'EUR/USD'}
        visibleDrawingsCount={visibleLinesCount}
        totalDrawingsCount={currentActiveLines.length}
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
