import React, { useState, useMemo, useEffect } from 'react';
import { ForexChartData, LineDrawing, OHLCData } from './types/chart';
import { getSampleForexData } from './utils/sampleData';
import { TopControlBar } from './components/Controls/TopControlBar';
import { LineItemsPopover } from './components/Controls/LineItemsPopover';
import { ForexChart } from './components/Chart/ForexChart';
import { StatusBar } from './components/StatusBar/StatusBar';
import { UploadModal } from './components/Modals/UploadModal';
import { SchemaHelpModal } from './components/Modals/SchemaHelpModal';

export const App: React.FC = () => {
  const [chartData, setChartData] = useState<ForexChartData>(() => getSampleForexData());
  const [currentTimeframe, setCurrentTimeframe] = useState<string>('H4');

  // Master visibility & individual visibility
  const [individualVisibility, setIndividualVisibility] = useState<{ [id: string]: boolean }>({});

  // Line Inspector popover is CLOSED by default (không mở sẵn)
  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);

  const [hoveredDrawingId, setHoveredDrawingId] = useState<string | null>(null);
  const [crosshairOHLC, setCrosshairOHLC] = useState<OHLCData | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const tfs = Object.keys(chartData.timeframes || {});
    if (tfs.length > 0 && (!chartData.timeframes[currentTimeframe] || !currentTimeframe)) {
      setCurrentTimeframe(chartData.defaultTimeframe || tfs[0]);
    }
  }, [chartData, currentTimeframe]);

  const currentTfData = useMemo(() => {
    return chartData.timeframes?.[currentTimeframe] || { candles: [], drawings: [] };
  }, [chartData, currentTimeframe]);

  // Consolidate all lines in the JSON
  const allDrawings = useMemo(() => {
    const list: LineDrawing[] = [];

    if (chartData.commonDrawings && Array.isArray(chartData.commonDrawings)) {
      list.push(...(chartData.commonDrawings as LineDrawing[]));
    }

    if (chartData.timeframes) {
      for (const [tf, data] of Object.entries(chartData.timeframes)) {
        if (data.drawings && Array.isArray(data.drawings)) {
          for (const d of data.drawings) {
            list.push({ ...d, sourceTimeframe: d.sourceTimeframe || tf });
          }
        }
      }
    }

    return list;
  }, [chartData]);

  // ONLY lines currently displaying in the selected timeframe:
  // - Common lines (outside)
  // - Lines created in current timeframe
  // - Lines from other timeframes ONLY if stretch: true
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

  // Count visible lines currently on chart
  const visibleLinesCount = useMemo(() => {
    return currentActiveLines.filter((d) => individualVisibility[d.id] !== false).length;
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
      setCurrentTimeframe(newData.defaultTimeframe || tfs[0]);
    }
    setIndividualVisibility({});
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#090d16] text-slate-100">
      {/* Minimal Top Control Bar (No Header) */}
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

      {/* Main Chart Area */}
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

          {/* Show/Hide Item Popover (Chỉ mở khi bấm nút, hiển thị đúng các đường trong timeframe đang chọn) */}
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

      {/* Bottom Status Bar */}
      <StatusBar
        ohlc={crosshairOHLC}
        currentTimeframe={currentTimeframe}
        candlesCount={currentTfData.candles.length}
        symbol={chartData.symbol || 'EUR/USD'}
        visibleDrawingsCount={visibleLinesCount}
        totalDrawingsCount={currentActiveLines.length}
      />

      {/* Modals */}
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
