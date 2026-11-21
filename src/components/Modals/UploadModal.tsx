import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, FileArchive } from 'lucide-react';
import { parseChartFile } from '../../utils/fileParser';
import { ForexChartData } from '../../types/chart';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (data: ForexChartData, filename: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onDataLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, fileInfo } = await parseChartFile(file);
      onDataLoaded(data, fileInfo.name);
      onClose();
    } catch (err: any) {
      console.error('File parsing error:', err);
      setError(err.message || 'Failed to parse file. Please verify format.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleProcessFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleProcessFile(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0e1422] border border-slate-800 rounded-xl shadow-2xl p-6 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-sky-400" />
              <span>Import Forex Chart Data</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Supports plain JSON (.json) or compressed GZIP (.gz, .json.gz)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-5 border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
            isDragging
              ? 'border-sky-500 bg-sky-500/10'
              : 'border-slate-700 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.gz,.gzip"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="p-3 bg-slate-800 rounded-full mb-3 text-sky-400">
            {isDragging ? (
              <FileArchive className="w-8 h-8 animate-bounce" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <p className="text-sm font-medium text-slate-200">
            Click to upload or drag & drop file here
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Accepts <span className="font-mono text-slate-400">.json</span>,{' '}
            <span className="font-mono text-slate-400">.gz</span>, or{' '}
            <span className="font-mono text-slate-400">.json.gz</span>
          </p>

          <div className="flex items-center gap-4 mt-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-sky-400" /> Plain JSON
            </span>
            <span className="flex items-center gap-1">
              <FileArchive className="w-3.5 h-3.5 text-amber-400" /> GZIP Stream
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Fast Client Parse
            </span>
          </div>
        </div>

        {/* Quick Test Datasets Section */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">
              Or Load Generated Test Datasets:
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              From /test_data/
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { symbol: 'EUR/USD', file: 'EUR_USD_test_data' },
              { symbol: 'GBP/USD', file: 'GBP_USD_test_data' },
              { symbol: 'USD/JPY', file: 'USD_JPY_test_data' },
              { symbol: 'XAU/USD', file: 'XAU_USD_test_data' },
            ].map((item) => (
              <div
                key={item.symbol}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between"
              >
                <span className="font-semibold text-slate-200">{item.symbol}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={async () => {
                      setIsLoading(true);
                      setError(null);
                      try {
                        const res = await fetch(`/test_data/${item.file}.json`);
                        const text = await res.text();
                        const file = new File([text], `${item.file}.json`, { type: 'application/json' });
                        await handleProcessFile(file);
                      } catch (err: any) {
                        setError('Failed to load test dataset: ' + err.message);
                        setIsLoading(false);
                      }
                    }}
                    className="px-2 py-0.5 rounded bg-sky-950 text-sky-400 hover:bg-sky-900 border border-sky-800/60 text-[10px] font-mono transition-colors"
                    title="Load as plain JSON"
                  >
                    JSON
                  </button>
                  <button
                    onClick={async () => {
                      setIsLoading(true);
                      setError(null);
                      try {
                        const res = await fetch(`/test_data/${item.file}.json.gz`);
                        const blob = await res.blob();
                        const file = new File([blob], `${item.file}.json.gz`, { type: 'application/gzip' });
                        await handleProcessFile(file);
                      } catch (err: any) {
                        setError('Failed to load test GZIP: ' + err.message);
                        setIsLoading(false);
                      }
                    }}
                    className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 hover:bg-amber-900 border border-amber-800/60 text-[10px] font-mono transition-colors"
                    title="Load as compressed GZIP (.gz)"
                  >
                    GZ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="mt-4 text-center text-xs text-sky-400 animate-pulse">
            Decompressing and parsing chart data...
          </div>
        )}

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
