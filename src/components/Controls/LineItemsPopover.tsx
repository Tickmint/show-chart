import type React from 'react';
import { useRef, useEffect } from 'react';
import { Eye, EyeOff, X, Layers } from 'lucide-react';
import { type ChartElement } from '../../types/chart.js';

interface LineItemsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  elements: ChartElement[];
  elementVisibility: { [id: string]: boolean };
  onToggleElementVisibility: (id: string) => void;
  hoveredElementId: string | null;
  onHoverElement: (id: string | null) => void;
}

export const LineItemsPopover: React.FC<LineItemsPopoverProps> = ({
  isOpen,
  onClose,
  elements,
  elementVisibility,
  onToggleElementVisibility,
  hoveredElementId,
  onHoverElement,
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

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-3 top-12 z-40 w-80 max-h-[75vh] bg-[#0c121e] border border-slate-700/80 rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs select-none backdrop-blur-md animate-fade-in"
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800 bg-slate-900/70">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-slate-200">Elements</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-400 font-mono">
            {elements.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="overflow-y-auto p-2 space-y-1.5 max-h-[60vh]">
        {elements.map((el) => {
          const isVisible = elementVisibility[el.id] !== false;
          const isHovered = hoveredElementId === el.id;

          return (
            <div
              key={el.id}
              onMouseEnter={() => onHoverElement(el.id)}
              onMouseLeave={() => onHoverElement(null)}
              className={`flex items-center justify-between gap-2.5 p-2 rounded-lg border transition-all ${
                isHovered
                  ? 'bg-slate-800 border-sky-500 shadow-md'
                  : isVisible
                    ? 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                    : 'bg-slate-950/40 border-slate-900 opacity-50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/40"
                  style={{ backgroundColor: el.color }}
                  title={`Color: ${el.color}`}
                />
                <span
                  className="text-slate-200 truncate leading-snug font-medium text-xs"
                  title={el.name}
                >
                  {el.name}
                </span>
              </div>

              <button
                onClick={() => onToggleElementVisibility(el.id)}
                className={`p-1.5 rounded shrink-0 transition-colors cursor-pointer ${
                  isVisible
                    ? 'text-sky-400 hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
                }`}
                title={isVisible ? 'Hide element' : 'Show element'}
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

        {elements.length === 0 && (
          <div className="text-center py-6 text-slate-500 text-xs">
            No elements found
          </div>
        )}
      </div>
    </div>
  );
};
