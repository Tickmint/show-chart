import type React from 'react';
import { useRef, useEffect, useState } from 'react';
import { Eye, EyeOff, X, Layers, Pencil, Check } from 'lucide-react';
import { type ChartElement } from '../../types/chart.js';

interface LineItemsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  elements: ChartElement[];
  elementVisibility: { [id: string]: boolean };
  onToggleElementVisibility: (id: string) => void;
  hoveredElementId: string | null;
  onHoverElement: (id: string | null) => void;
  onUpdateElementName?: (id: string, newName: string) => void;
  rightOffset?: number;
}

export const LineItemsPopover: React.FC<LineItemsPopoverProps> = ({
  isOpen,
  onClose,
  elements,
  elementVisibility,
  onToggleElementVisibility,
  hoveredElementId,
  onHoverElement,
  onUpdateElementName,
  rightOffset,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

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

  const handleStartEdit = (el: ChartElement, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(el.id);
    setEditingName(el.displayName || el.name);
  };

  const handleSaveEdit = (
    id: string,
    e?: React.FormEvent | React.MouseEvent,
  ) => {
    if (e) e.stopPropagation();
    if (onUpdateElementName && editingName.trim()) {
      onUpdateElementName(id, editingName.trim());
    }
    setEditingId(null);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      style={
        rightOffset !== undefined ? { right: `${rightOffset}px` } : undefined
      }
      className={`absolute z-40 w-84 max-h-[75vh] bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-slate-700/80 rounded-xl flex flex-col overflow-hidden text-xs select-none backdrop-blur-md ${
        rightOffset !== undefined ? 'top-12' : 'top-full mt-1.5 right-0'
      }`}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/70">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-500 dark:text-sky-400" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Elements
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

      <div className="overflow-y-auto p-2 space-y-1.5 max-h-[60vh]">
        {elements.map((el) => {
          const isVisible = elementVisibility[el.id] !== false;
          const isHovered = hoveredElementId === el.id;
          const displayName = el.displayName || el.name;
          const isEditing = editingId === el.id;

          return (
            <div
              key={el.id}
              onMouseEnter={() => onHoverElement(el.id)}
              onMouseLeave={() => onHoverElement(null)}
              className={`flex items-center justify-between gap-2.5 p-2 rounded-lg border ${
                isHovered
                  ? 'bg-slate-100 dark:bg-slate-800 border-sky-500'
                  : isVisible
                    ? 'bg-slate-50/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                    : 'bg-slate-100/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-900 opacity-50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/40"
                  style={{ backgroundColor: el.color }}
                  title={`Color: ${el.color}`}
                />
                {isEditing ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveEdit(el.id);
                    }}
                    className="flex items-center gap-1 flex-1 min-w-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      autoFocus
                      className="w-full bg-white dark:bg-slate-950 border border-sky-500/80 rounded px-1.5 py-0.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={(e) => handleSaveEdit(el.id, e)}
                      className="p-1 rounded text-emerald-500 dark:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 cursor-pointer"
                      title="Save name"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="p-1 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 group/name">
                    <span
                      className="text-slate-800 dark:text-slate-200 truncate leading-snug font-medium text-xs flex-1"
                      title={displayName}
                    >
                      {displayName}
                    </span>
                    {onUpdateElementName && (
                      <button
                        onClick={(e) => handleStartEdit(el, e)}
                        className="opacity-0 group-hover/name:opacity-100 p-0.5 rounded text-slate-400 hover:text-sky-500 dark:hover:text-sky-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                        title="Rename element display"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => onToggleElementVisibility(el.id)}
                className={`p-1.5 rounded shrink-0 cursor-pointer ${
                  isVisible
                    ? 'text-sky-500 dark:text-sky-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                    : 'text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
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
          <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
            No elements found
          </div>
        )}
      </div>
    </div>
  );
};

export default LineItemsPopover;
