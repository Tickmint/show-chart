import type React from 'react';
import { type OHLCData } from '../../types/chart.js';

interface StatusBarProps {
  ohlc: OHLCData | null;
  currentTimeframe: string;
  candlesCount: number;
  symbol: string;
  visibleDrawingsCount: number;
  totalDrawingsCount: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  ohlc,
  currentTimeframe,
  candlesCount,
  symbol,
  visibleDrawingsCount,
  totalDrawingsCount,
}) => {
  const formatDate = (timestampSec: number) => {
    const d = new Date(timestampSec * 1000);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const isUp = ohlc ? ohlc.close >= ohlc.open : true;

  return (
    <footer className="h-8 bg-[#080c16] border-t border-slate-800/80 px-4 flex items-center justify-between text-[11px] text-slate-400 font-mono select-none">
      <div className="flex items-center gap-3 overflow-hidden">
        {ohlc ? (
          <div className="flex items-center gap-3">
            <span className="text-slate-300 font-semibold">
              {formatDate(ohlc.time)}
            </span>
            <span className="hidden sm:inline">
              O:{' '}
              <strong className="text-slate-200">{ohlc.open.toFixed(5)}</strong>
            </span>
            <span className="hidden sm:inline">
              H:{' '}
              <strong className="text-slate-200">{ohlc.high.toFixed(5)}</strong>
            </span>
            <span className="hidden sm:inline">
              L:{' '}
              <strong className="text-slate-200">{ohlc.low.toFixed(5)}</strong>
            </span>
            <span>
              C:{' '}
              <strong className={isUp ? 'text-emerald-400' : 'text-rose-400'}>
                {ohlc.close.toFixed(5)}
              </strong>
            </span>
            {ohlc.change !== undefined && (
              <span
                className={`font-medium ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {ohlc.change >= 0 ? '+' : ''}
                {ohlc.change.toFixed(5)} (
                {ohlc.changePercent
                  ? (ohlc.changePercent >= 0 ? '+' : '') +
                    ohlc.changePercent.toFixed(2)
                  : '0.00'}
                %)
              </span>
            )}
          </div>
        ) : (
          <span className="text-slate-500 italic">
            Hover over chart candles to inspect OHLC data
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 text-slate-400 shrink-0">
        <div>
          <strong className="text-slate-200">{symbol}</strong>
        </div>
        <div className="h-3 w-[1px] bg-slate-800" />
        <div>
          TF: <strong className="text-sky-400">{currentTimeframe}</strong> (
          {candlesCount} candles)
        </div>
        <div className="h-3 w-[1px] bg-slate-800" />
        <div>
          Drawings:{' '}
          <strong className="text-indigo-400">
            {visibleDrawingsCount}/{totalDrawingsCount}
          </strong>
        </div>
      </div>
    </footer>
  );
};
