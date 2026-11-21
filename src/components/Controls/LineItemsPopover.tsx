import React, { useRef, useEffect } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { LineDrawing } from '../../types/chart';

interface LineItemsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  drawings: LineDrawing[];
  currentTimeframe: string;
  individualVisibility: { [id: string]: boolean };
  onToggleVisibility: (id: string) => void;
  hoveredDrawingId: string | null;
  onHoverDrawing: (id: string | null) => void;
}

export const LineItemsPopover: React.FC<LineItemsPopoverProps> = ({
  isOpen,
  onClose,
  drawings,
  currentTimeframe,
  individualVisibility,
  onToggleVisibility,
  hoveredDrawingId,
  onHoverDrawing,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // close if clicked outside
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

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-4 top-12 z-40 w-80 max-h-[75vh] bg-[#0c121e] border border-slate-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs select-none backdrop-blur-md animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800 bg-slate-900/70">
        <div>
          <span className="font-semibold text-slate-200">Active Lines ({currentTimeframe})</span>
          <span className="ml-2 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-400 font-mono">
            {drawings.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* List of active lines in current timeframe */}
      <div className="overflow-y-auto p-2 space-y-1.5 max-h-[60vh]">
        {drawings.map((drawing) => {
          const isVisible = individualVisibility[drawing.id] !== false;
          const isHovered = hoveredDrawingId === drawing.id;
          const isUp = drawing.direction === 'up';
          const mainDescription =
            drawing.description || `${drawing.id} (${isUp ? 'Low → High' : 'High → Low'})`;

          return (
            <div
              key={drawing.id}
              onMouseEnter={() => onHoverDrawing(drawing.id)}
              onMouseLeave={() => onHoverDrawing(null)}
              className={`flex items-center justify-between gap-2.5 p-2 rounded-lg border transition-all ${
                isHovered
                  ? 'bg-slate-800 border-sky-500 shadow-md'
                  : isVisible
                  ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                  : 'bg-slate-950/40 border-slate-900 opacity-50'
              }`}
            >
              {/* Left: Color dot & Main description */}
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/40"
                  style={{ backgroundColor: drawing.color }}
                  title={`Color: ${drawing.color}`}
                />
                <span className="text-slate-200 truncate leading-snug font-medium" title={mainDescription}>
                  {mainDescription}
                </span>
              </div>

              {/* Right: Eye Toggle Button */}
              <button
                onClick={() => onToggleVisibility(drawing.id)}
                className={`p-1.5 rounded shrink-0 transition-colors ${
                  isVisible
                    ? 'text-sky-400 hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
                }`}
                title={isVisible ? 'Hide this line' : 'Show this line'}
              >
                {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          );
        })}

        {drawings.length === 0 && (
          <div className="text-center py-6 text-slate-500 text-xs">
            No lines active on {currentTimeframe}
          </div>
        )}
      </div>
    </div>
  );
};
