import type React from 'react';
import { useRef, useEffect, useMemo } from 'react';
import { Eye, EyeOff, X, Layers } from 'lucide-react';
import { type ChartElement } from '../../types/chart.js';
import { parseTimeframeDuration } from '../../utils/timeframeService.js';

export interface LineItemsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  elements: ChartElement[];
  elementVisibility: { [id: string]: boolean };
  onToggleElementVisibility: (id: string) => void;
  onToggleTimeframeVisibility?: (timeframe: string, visible: boolean) => void;
  hoveredElementId: string | null;
  onHoverElement: (id: string | null) => void;
  rightOffset?: number;
}

export const LineItemsPopover: React.FC<LineItemsPopoverProps> = ({
  isOpen,
  onClose,
  elements,
  elementVisibility,
  onToggleElementVisibility,
  onToggleTimeframeVisibility,
  hoveredElementId,
  onHoverElement,
  rightOffset,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const toggleBtn = document.getElementById('btn-show-hide-item');
        if (toggleBtn && toggleBtn.contains(e.target as Node)) return;
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const groupedElements = useMemo(() => {
    const groups: { [tf: string]: ChartElement[] } = {};
    for (const el of elements) {
      const tf = el.sourceTimeframe || 'Common';
      if (!groups[tf]) {
        groups[tf] = [];
      }
      groups[tf].push(el);
    }
    return groups;
  }, [elements]);

  const sortedTimeframes = useMemo(() => {
    return Object.keys(groupedElements).sort((a, b) => {
      if (a === 'Common') return 1;
      if (b === 'Common') return -1;
      return parseTimeframeDuration(b) - parseTimeframeDuration(a);
    });
  }, [groupedElements]);

  const handleToggleTimeframe = (tf: string, targetVisible: boolean) => {
    if (onToggleTimeframeVisibility) {
      onToggleTimeframeVisibility(tf, targetVisible);
    } else {
      const tfElements = groupedElements[tf] || [];
      for (const el of tfElements) {
        const isCurrentVisible = elementVisibility[el.id] !== false;
        if (isCurrentVisible !== targetVisible) {
          onToggleElementVisibility(el.id);
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      style={
        rightOffset !== undefined ? { right: `${rightOffset}px` } : undefined
      }
      className={`absolute z-40 w-88 max-h-[75vh] bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-slate-700/80 rounded-xl flex flex-col overflow-hidden text-xs select-none backdrop-blur-md shadow-xl ${
        rightOffset !== undefined ? 'top-12' : 'top-full mt-1.5 right-0'
      }`}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/70">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-500 dark:text-sky-400" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Elements by Timeframe
          </span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
            {elements.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="overflow-y-auto p-2 space-y-2.5 max-h-[60vh]">
        {sortedTimeframes.map((tf) => {
          const tfElements = groupedElements[tf] || [];
          const anyVisible = tfElements.some(
            (el) => elementVisibility[el.id] !== false,
          );
          const visibleCount = tfElements.filter(
            (el) => elementVisibility[el.id] !== false,
          ).length;

          return (
            <div
              key={tf}
              className="space-y-1.5 p-1.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80"
              data-testid={`timeframe-group-${tf}`}
            >
              <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-200 tracking-wide">
                    {tf === 'Common' ? 'Common Drawings' : `Timeframe ${tf}`}
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white/90 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                    {visibleCount}/{tfElements.length}
                  </span>
                </div>
                <button
                  onClick={() => handleToggleTimeframe(tf, !anyVisible)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors ${
                    anyVisible
                      ? 'text-sky-600 dark:text-sky-400 hover:bg-slate-300/60 dark:hover:bg-slate-700'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-slate-700'
                  }`}
                  title={
                    anyVisible
                      ? `Hide all ${tf} drawings`
                      : `Show all ${tf} drawings`
                  }
                  data-testid={`toggle-tf-${tf}`}
                >
                  <span>{anyVisible ? 'Hide all' : 'Show all'}</span>
                  {anyVisible ? (
                    <Eye className="w-3.5 h-3.5" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              <div className="space-y-1">
                {tfElements.map((el) => {
                  const isVisible = elementVisibility[el.id] !== false;
                  const isHovered = hoveredElementId === el.id;
                  const displayName = el.displayName || el.name;

                  return (
                    <div
                      key={el.id}
                      onMouseEnter={() => onHoverElement(el.id)}
                      onMouseLeave={() => onHoverElement(null)}
                      className={`flex items-center justify-between gap-2.5 p-2 rounded-lg border transition-colors ${
                        isHovered
                          ? 'bg-slate-100 dark:bg-slate-800 border-sky-500'
                          : isVisible
                            ? 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                            : 'bg-slate-100/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-900 opacity-50'
                      }`}
                      data-testid={`element-item-${el.id}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/40"
                          style={{
                            background:
                              el.colors && el.colors.length > 1
                                ? `linear-gradient(135deg, ${el.colors.join(', ')})`
                                : el.color,
                          }}
                          title={`Color: ${el.colors && el.colors.length > 1 ? el.colors.join(', ') : el.color}`}
                        />
                        <span
                          className="text-slate-800 dark:text-slate-200 truncate leading-snug font-medium text-xs flex-1"
                          title={displayName}
                        >
                          {displayName}
                        </span>
                      </div>

                      <button
                        onClick={() => onToggleElementVisibility(el.id)}
                        className={`p-1.5 rounded shrink-0 cursor-pointer ${
                          isVisible
                            ? 'text-sky-500 dark:text-sky-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                            : 'text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                        title={isVisible ? 'Hide element' : 'Show element'}
                        data-testid={`toggle-element-${el.id}`}
                      >
                        {isVisible ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {elements.length === 0 && (
          <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
            No elements found
          </div>
        )}
      </div>
    </div>
  );
};

export default LineItemsPopover;
