import React, { useState } from 'react';
import { X, Copy, Check, FileJson, TrendingUp, Maximize2 } from 'lucide-react';

interface SchemaHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_JSON_SCHEMA = `{
  "symbol": "EUR/USD",
  "title": "EUR/USD Multi-Timeframe Line Structure",

  // 1. COMMON LINES (Placed OUTSIDE individual timeframes)
  "commonDrawings": [
    {
      "id": "macro-bullish-line",
      "type": "line",
      "direction": "up", // 'up' (Chiều tăng: Nối từ đáy nến đầu đến đỉnh nến cuối)
      "color": "#10b981",
      "fromTime": 1704067200,
      "toTime": 1708000000,
      "stretch": true // Stretches dynamically across all timeframes (like TradingView)
    },
    {
      "id": "macro-bearish-line",
      "type": "line",
      "direction": "down", // 'down' (Chiều giảm: Nối từ đỉnh nến đầu đến đáy nến cuối)
      "color": "#ef4444",
      "fromTime": 1708000000,
      "toTime": 1709500000,
      "stretch": true
    }
  ],

  // 2. TIMEFRAMES (With SPECIFIC lines placed INSIDE each timeframe)
  "timeframes": {
    "H4": {
      "candles": [
        { "time": 1704067200, "open": 1.0720, "high": 1.0780, "low": 1.0710, "close": 1.0750 }
      ],
      "drawings": [
        {
          "id": "h4-swing-up",
          "type": "line",
          "direction": "up", // 'up' | 'down'
          "color": "#38bdf8",
          "fromTime": 1704067200,
          "toTime": 1704600000,
          "stretch": true // Drawn on H4; stretches across H1 (x4 candles) & M15 (x16 candles)
        }
      ]
    }
  },
  "defaultTimeframe": "H4"
}`;

export const SchemaHelpModal: React.FC<SchemaHelpModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SAMPLE_JSON_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#0e1422] border border-slate-800 rounded-xl shadow-2xl flex flex-col text-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Multi-Timeframe Line Data Format & Schema
              </h3>
              <p className="text-xs text-slate-400">
                Plain JSON or GZIP (.json / .gz / .json.gz) Structure
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="font-semibold text-sky-400 mb-1 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>1. Common vs Timeframe Lines</span>
              </div>
              <p className="text-slate-400">
                <strong className="text-slate-200">Common Lines</strong> are placed outside timeframes under <code className="text-sky-300">"commonDrawings"</code>.<br />
                <strong className="text-slate-200">Specific Lines</strong> are placed inside each timeframe under <code className="text-indigo-300">"drawings"</code>.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                <Maximize2 className="w-4 h-4" />
                <span>2. TradingView Multi-TF Stretch</span>
              </div>
              <p className="text-slate-400">
                Set <code className="text-emerald-300">"stretch": true</code>: When moving from H4 to H1 to M15, the line stretches smoothly across the corresponding candles! Set <code className="text-slate-300">"stretch": false</code> to lock the line strictly to its native timeframe.
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-slate-400 text-[11px]">JSON Schema Example:</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Schema'}</span>
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-[#080c14] border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-64">
              {SAMPLE_JSON_SCHEMA}
            </pre>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded-md bg-sky-600 hover:bg-sky-500 text-white font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
