import type React from 'react';
import { useState } from 'react';
import { X, Copy, Check, FileJson, TrendingUp, GitFork } from 'lucide-react';

interface SchemaHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_JSON_SCHEMA = `{
  "symbol": "EUR/USD",
  "title": "EUR/USD Multi-Timeframe Market Structure",

  // 1. TIMEFRAME UNITS (Đơn vị tính bằng Giây)
  "timeframeUnits": {
    "D1": 86400,
    "H4": 14400,
    "H1": 3600,
    "M15": 900,
    "M5": 300,
    "M2": 120,
    "M1": 60
  },

  // 2. CHUYỂN ĐỔI 1 CHIỀU (Chỉ áp dụng từ khung to -> khung nhỏ, hỗ trợ không chia hết như M5 -> M2)
  "timeframeConversions": [
    { "from": "D1", "to": "H4", "ratio": 6 },
    { "from": "H4", "to": "H1", "ratio": 4 },
    { "from": "H1", "to": "M15", "ratio": 4 },
    { "from": "M15", "to": "M5", "ratio": 3 },
    { "from": "M5", "to": "M2", "ratio": 2.5 }, // Tình huống không chia hết
    { "from": "M2", "to": "M1", "ratio": 2 }
  ],

  // 3. CÁC ĐƯỜNG VẼ THEO KHUNG THỜI GIAN (Thừa kế 1 chiều xuống khung nhỏ hơn)
  "timeframes": {
    "H4": {
      "candles": [
        { "time": 1704067200, "open": 1.0720, "high": 1.0780, "low": 1.0710, "close": 1.0750 }
      ],
      "drawings": [
        // Market Structure: HL -> HH -> HL -> HH
        {
          "id": "h4-ms-leg1",
          "type": "line",
          "direction": "up", // 'up': Đáy nến 1 (Low) -> Đỉnh nến 2 (High)
          "color": "#38bdf8",
          "element": "H4 Bullish Market Structure (HH/HL)",
          "fromTime": 1704067200,
          "toTime": 1704600000,
          "sourceTimeframe": "H4", // Khung gốc; thừa kế xuống H1 & M15, không hiện trên D1
          "stretch": true
        },
        {
          "id": "h4-ms-leg2",
          "type": "line",
          "direction": "down", // 'down': Đỉnh nến 1 (High) -> Đáy nến 2 (Low)
          "color": "#fb7185",
          "element": "H4 Bullish Market Structure (HH/HL)",
          "fromTime": 1704600000,
          "toTime": 1705000000,
          "sourceTimeframe": "H4",
          "stretch": true
        }
      ]
    },
    "H1": {
      "candles": [ ... ],
      "drawings": [ ... ]
    }
  },
  "defaultTimeframe": "H4"
}`;

export const SchemaHelpModal: React.FC<SchemaHelpModalProps> = ({
  isOpen,
  onClose,
}) => {
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
                Multi-Timeframe Market Structure & Conversion Schema
              </h3>
              <p className="text-xs text-slate-400">
                1-Way Downward Inheritance & Wick-Perfect Sub-Candle Snapping
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
                <GitFork className="w-4 h-4" />
                <span>1. Thừa kế 1 chiều (Khung to → Khung nhỏ)</span>
              </div>
              <p className="text-slate-400">
                Các đường vẽ định nghĩa ở khung lớn (ví dụ{' '}
                <code className="text-sky-300">H1</code>) sẽ hiển thị và kéo dãn
                xuống các khung nhỏ hơn (
                <code className="text-indigo-300">M15</code>). Nhưng đường vẽ ở
                khung nhỏ (<code className="text-indigo-300">M15</code>){' '}
                <strong>không bao giờ</strong> hiển thị trên khung lớn (
                <code className="text-sky-300">H1</code>).
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>2. Neo bám đỉnh/đáy nến con (Sub-Candles)</span>
              </div>
              <p className="text-slate-400">
                Khi xuống khung nhỏ hơn, hệ thống tự quét toàn bộ nến con trong
                khoảng thời gian của nến mẹ: neo vào nến có{' '}
                <strong className="text-slate-200">High cao nhất</strong> (đối
                với đỉnh) hoặc{' '}
                <strong className="text-slate-200">Low thấp nhất</strong> (đối
                với đáy), kể cả trường hợp không chia hết (như M5 → M2).
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-slate-400 text-[11px]">
                JSON Schema Example:
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
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
