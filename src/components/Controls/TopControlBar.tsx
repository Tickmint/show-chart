import type React from 'react';
import { Eye, EyeOff, Upload, Sparkles, HelpCircle } from 'lucide-react';
import { type ForexChartData } from '../../types/chart.js';

interface TopControlBarProps {
  chartData: ForexChartData;
  currentTimeframe: string;
  onSelectTimeframe: (tf: string) => void;
  onOpenUpload: () => void;
  onLoadSample: () => void;
  onOpenHelp: () => void;
  isPopoverOpen: boolean;
  onTogglePopover: () => void;
  activeElementsCount: number;
  visibleElementsCount: number;
}

export const TopControlBar: React.FC<TopControlBarProps> = ({
  chartData,
  currentTimeframe,
  onSelectTimeframe,
  onOpenUpload,
  onLoadSample,
  onOpenHelp,
  isPopoverOpen,
  onTogglePopover,
  activeElementsCount,
  visibleElementsCount,
}) => {
  const timeframes = Object.keys(chartData.timeframes || {});

  return (
    <div className="h-10 bg-[#0a0f1d] border-b border-slate-800/80 px-3 flex items-center justify-between text-xs select-none z-30">
      <div className="flex items-center gap-2.5">
        <span className="font-bold text-slate-100 tracking-wide font-mono text-xs">
          {chartData.symbol || 'FOREX'}
        </span>

        <div className="h-4 w-[1px] bg-slate-800" />

        <div className="flex items-center bg-slate-900/90 p-0.5 rounded-md border border-slate-800">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => onSelectTimeframe(tf)}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-all ${
                currentTimeframe === tf
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onLoadSample}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors text-[11px]"
          title="Load default sample data"
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span className="hidden sm:inline">Sample</span>
        </button>

        <button
          onClick={onOpenUpload}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600/90 hover:bg-sky-500 text-white font-medium transition-colors text-[11px]"
          title="Upload .json or .gz file"
        >
          <Upload className="w-3 h-3" />
          <span>Upload</span>
        </button>

        <button
          id="btn-show-hide-item"
          onClick={onTogglePopover}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium border transition-all text-xs ${
            isPopoverOpen
              ? 'bg-sky-500/25 text-sky-300 border-sky-500/60 shadow-sm'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
          title="Show / Hide active elements in this timeframe"
        >
          {visibleElementsCount > 0 ? (
            <Eye className="w-3.5 h-3.5 text-sky-400" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span>Elements</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 text-sky-300 font-mono">
            {visibleElementsCount}/{activeElementsCount}
          </span>
        </button>

        <button
          onClick={onOpenHelp}
          className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          title="Help & Schema format"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
