import type React from 'react';
import { useState, useRef } from 'react';
import { X, AlertCircle, FolderOpen } from 'lucide-react';
import {
  parseChartFile,
  parseMultipleChartFiles,
  getFilesFromDataTransfer,
  getFilesFromDirectoryHandle,
  type ChartCase,
} from '../../utils/fileParser.js';
import { type ForexChartData } from '../../types/chart.js';

interface UploadModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onDataLoaded: (data: ForexChartData, filename: string) => void;
  onCasesLoaded?: (cases: ChartCase[], defaultIndex?: number) => void;
  showCloseButton?: boolean;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded,
  onCasesLoaded,
  showCloseButton = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFiles = async (files: File[]) => {
    const chartFiles = files.filter(
      (f) =>
        f.name.endsWith('.json.gz') ||
        f.name.endsWith('.gz') ||
        f.name.endsWith('.gzip') ||
        f.name.endsWith('.json'),
    );

    if (chartFiles.length === 0) {
      setError(
        'No valid chart files found (.json.gz). Please select a folder containing chart data.',
      );
      return;
    }

    setIsLoading(true);
    setError(null);
    setLoadingStatus(
      chartFiles.length === 1
        ? 'Decompressing and parsing chart data...'
        : `Decompressing and parsing ${chartFiles.length} chart files from folder...`,
    );

    try {
      if (chartFiles.length === 1) {
        const file = chartFiles[0]!;
        const { data, fileInfo } = await parseChartFile(file);
        const singleCase: ChartCase = {
          id: file.name,
          name:
            data.symbol ||
            fileInfo.name.replace(/\.(json|gz|gzip|\.json\.gz)$/i, ''),
          filename: file.name,
          data,
        };
        onCasesLoaded?.([singleCase], 0);
        onDataLoaded(data, fileInfo.name);
        onClose?.();
      } else {
        const cases = await parseMultipleChartFiles(chartFiles);
        if (cases.length === 0) {
          throw new Error(
            'Could not parse any valid chart cases from the selected folder.',
          );
        }
        onCasesLoaded?.(cases, 0);
        onDataLoaded(cases[0]!.data, cases[0]!.filename);
        onClose?.();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to parse folder data. Please verify format.';
      setError(msg);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    try {
      const files = await getFilesFromDataTransfer(e.dataTransfer);
      if (files.length > 0) {
        await handleProcessFiles(files);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error reading dropped folder.',
      );
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      handleProcessFiles(files);
    }
  };

  const handleOpenFolderPicker = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (
          window as unknown as {
            showDirectoryPicker: (options?: {
              mode?: string;
            }) => Promise<unknown>;
          }
        ).showDirectoryPicker({ mode: 'read' });

        if (dirHandle) {
          setIsLoading(true);
          setError(null);
          setLoadingStatus('Reading files from selected folder...');
          const files = await getFilesFromDirectoryHandle(dirHandle);
          await handleProcessFiles(files);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          folderInputRef.current?.click();
        }
      } finally {
        setIsLoading(false);
        setLoadingStatus('');
      }
    } else {
      folderInputRef.current?.click();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0e1422] border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-slate-800 dark:text-slate-200 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-sky-500 dark:text-sky-400" />
              <span>Select Forex Data Folder</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select a folder containing compressed chart files (.json.gz, .gz)
            </p>
          </div>
          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => {
            void handleOpenFolderPicker();
          }}
          className={`mt-5 border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-100/80 dark:hover:bg-slate-900'
          }`}
        >
          <input
            ref={folderInputRef}
            type="file"
            multiple
            {...({
              webkitdirectory: '',
              directory: '',
            } as React.InputHTMLAttributes<HTMLInputElement>)}
            onChange={handleFolderChange}
            className="hidden"
          />

          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full mb-3 text-sky-500 dark:text-sky-400">
            <FolderOpen
              className={`w-9 h-9 ${isDragging ? 'animate-bounce' : ''}`}
            />
          </div>

          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            Click to select folder or drag & drop folder here
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">
            Loads all compressed{' '}
            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
              .json.gz
            </span>{' '}
            chart files from the selected folder
          </p>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleOpenFolderPicker();
            }}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-sky-500 hover:bg-sky-600 text-white shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Select Folder</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-600 dark:text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {isLoading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-sky-500 dark:text-sky-400">
            <div className="w-3.5 h-3.5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <span>{loadingStatus}</span>
          </div>
        )}

        {showCloseButton && onClose && (
          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadModal;
