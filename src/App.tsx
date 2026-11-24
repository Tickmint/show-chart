import type React from 'react';
import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  lazy,
  Suspense,
} from 'react';
import {
  Eye,
  EyeOff,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Check,
} from 'lucide-react';
import {
  type ForexChartData,
  type Drawing,
  type TimeframeData,
  type ChartElement,
  isPiboDrawing,
} from './types/chart.js';
import { type ThemeMode } from './types/theme.js';
import {
  getInitialTheme,
  saveTheme,
  applyThemeToDocument,
  THEME_STORAGE_KEY,
} from './utils/themeService.js';
import {
  canInheritTimeframe,
  getLargestTimeframe,
  parseTimeframeDuration,
} from './utils/timeframeService.js';
import { type ForexChartRef } from './components/Chart/ForexChart.js';
import {
  parseChartFile,
  parseMultipleChartFiles,
  getFilesFromDataTransfer,
  type ChartCase,
} from './utils/fileParser.js';

const ForexChart = lazy(() => import('./components/Chart/ForexChart.js'));
const LineItemsPopover = lazy(
  () => import('./components/Controls/LineItemsPopover.js'),
);
const UploadModal = lazy(() => import('./components/Modals/UploadModal.js'));

export const App: React.FC = () => {
  const chartRef = useRef<ForexChartRef>(null);
  const [chartData, setChartData] = useState<ForexChartData>({
    symbol: '',
    timeframes: {},
  });
  const [cases, setCases] = useState<ChartCase[]>([]);
  const [currentCaseIndex, setCurrentCaseIndex] = useState<number>(0);
  const [currentTimeframe, setCurrentTimeframe] = useState<string>('');

  const [elementVisibility, setElementVisibility] = useState<{
    [id: string]: boolean;
  }>({});

  const [isPopoverOpen, setIsPopoverOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [isNewsVisible] = useState<boolean>(true);
  const [hoveredDrawingId, setHoveredDrawingId] = useState<string | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [priceScaleWidth, setPriceScaleWidth] = useState<number>(68);

  const [isCaseDropdownOpen, setIsCaseDropdownOpen] = useState<boolean>(false);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const caseDropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const caseDropdownContainerRef = useRef<HTMLDivElement>(null);

  const handleCaseMouseEnter = useCallback(() => {
    if (caseDropdownTimeoutRef.current) {
      clearTimeout(caseDropdownTimeoutRef.current);
      caseDropdownTimeoutRef.current = null;
    }
    setIsCaseDropdownOpen(true);
  }, []);

  const handleCaseMouseLeave = useCallback(() => {
    caseDropdownTimeoutRef.current = setTimeout(() => {
      setIsCaseDropdownOpen(false);
      setHoveredGroup(null);
    }, 250);
  }, []);

  useEffect(() => {
    if (!isCaseDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        caseDropdownContainerRef.current &&
        !caseDropdownContainerRef.current.contains(e.target as Node)
      ) {
        setIsCaseDropdownOpen(false);
        setHoveredGroup(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCaseDropdownOpen]);

  const groupedCases = useMemo(() => {
    const groupsMap = new Map<
      string,
      Array<{ caseItem: ChartCase; originalIndex: number }>
    >();
    const ungrouped: Array<{ caseItem: ChartCase; originalIndex: number }> = [];

    cases.forEach((caseItem, idx) => {
      if (caseItem.group && caseItem.group.trim()) {
        const gName = caseItem.group.trim();
        if (!groupsMap.has(gName)) {
          groupsMap.set(gName, []);
        }
        groupsMap.get(gName)!.push({ caseItem, originalIndex: idx });
      } else {
        ungrouped.push({ caseItem, originalIndex: idx });
      }
    });

    return {
      groups: Array.from(groupsMap.entries()).map(([name, items]) => ({
        name,
        items,
      })),
      ungrouped,
    };
  }, [cases]);

  const handleToggleTheme = () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    saveTheme(nextTheme);
    applyThemeToDocument(nextTheme);
  };

  useEffect(() => {
    applyThemeToDocument(theme);

    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mediaQuery) return;

    const handleChange = (e: MediaQueryListEvent) => {
      try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (!stored) {
          const sysTheme: ThemeMode = e.matches ? 'dark' : 'light';
          setTheme(sysTheme);
          applyThemeToDocument(sysTheme);
        }
      } catch {}
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const availableTimeframes = useMemo(() => {
    const tfs = Object.keys(chartData.timeframes || {});
    return tfs.sort(
      (a, b) =>
        parseTimeframeDuration(b, chartData.timeframeUnits) -
        parseTimeframeDuration(a, chartData.timeframeUnits),
    );
  }, [chartData.timeframes, chartData.timeframeUnits]);

  const currentTfData = useMemo(() => {
    return (
      chartData.timeframes?.[currentTimeframe] || { candles: [], drawings: [] }
    );
  }, [chartData, currentTimeframe]);

  const hasCandles = currentTfData.candles.length > 0;

  const allDrawings = useMemo(() => {
    const list: Drawing[] = [];

    if (chartData.commonDrawings && Array.isArray(chartData.commonDrawings)) {
      list.push(...chartData.commonDrawings);
    }

    if (chartData.timeframes) {
      for (const [tf, data] of Object.entries(chartData.timeframes) as [
        string,
        TimeframeData,
      ][]) {
        if (data.drawings && Array.isArray(data.drawings)) {
          for (const d of data.drawings) {
            list.push({ ...d, sourceTimeframe: d.sourceTimeframe || tf });
          }
        }
      }
    }

    return list;
  }, [chartData]);

  const currentActiveDrawings = useMemo(() => {
    return allDrawings.filter((d) => {
      if (isPiboDrawing(d)) {
        if (d.sourceTimeframe && d.sourceTimeframe !== currentTimeframe) {
          return false;
        }
        return true;
      }
      const srcTf = d.sourceTimeframe;
      if (srcTf) {
        return canInheritTimeframe(
          srcTf,
          currentTimeframe,
          chartData.timeframeUnits,
        );
      }
      return true;
    });
  }, [allDrawings, currentTimeframe, chartData.timeframeUnits]);

  const activeElements = useMemo(() => {
    const map = new Map<string, ChartElement>();

    for (const d of currentActiveDrawings) {
      const elId = d.element || d.group || 'Elements';
      const elName = d.element || d.group || d.displayName || elId;
      const srcTf = d.sourceTimeframe || 'Common';

      const existing = map.get(elId);
      if (existing) {
        existing.drawings.push(d);
        if (!existing.colors.includes(d.color)) {
          existing.colors.push(d.color);
        }
      } else {
        map.set(elId, {
          id: elId,
          name: elName,
          displayName: elName,
          color: d.color,
          sourceTimeframe: srcTf,
          drawings: [d],
          colors: [d.color],
        });
      }
    }

    if (currentTfData.candles) {
      const nameOccurrences = new Map<string, number>();

      for (const c of currentTfData.candles) {
        const labelList = c.labels || (c.label ? [c.label] : []);
        for (let lIdx = 0; lIdx < labelList.length; lIdx++) {
          const label = labelList[lIdx]!;
          const elId =
            label.element ||
            label.id ||
            `callout-${c.time}-${lIdx}-${label.text || 'Callout'}`;

          const baseName = label.text || label.title || label.id || 'Callout';
          const srcTf = currentTimeframe || 'Common';
          const labelColor = label.color || label.borderColor || '#0284c7';
          const isInitialVisible = label.visible !== false;

          const labelDrawing = {
            id: elId,
            type: 'line',
            direction: 'up',
            color: labelColor,
            visible: isInitialVisible,
            element: elId,
            sourceTimeframe: srcTf,
          } as unknown as Drawing;

          const existing = map.get(elId);
          if (existing) {
            existing.drawings.push(labelDrawing);
            if (!existing.colors.includes(labelColor)) {
              existing.colors.push(labelColor);
            }
          } else {
            const count = (nameOccurrences.get(baseName) || 0) + 1;
            nameOccurrences.set(baseName, count);
            const elName = count > 1 ? `${baseName} (#${count})` : baseName;

            map.set(elId, {
              id: elId,
              name: elName,
              displayName: elName,
              color: labelColor,
              sourceTimeframe: srcTf,
              drawings: [labelDrawing],
              colors: [labelColor],
            });
          }
        }
      }
    }

    return Array.from(map.values());
  }, [currentActiveDrawings, currentTfData.candles, currentTimeframe]);

  const visibleElementsCount = useMemo(() => {
    return activeElements.filter((el) => {
      if (elementVisibility[el.id] !== undefined) {
        return elementVisibility[el.id];
      }
      return el.drawings.some((d) => d.visible !== false);
    }).length;
  }, [activeElements, elementVisibility]);

  const handleToggleElementVisibility = (id: string) => {
    const el = activeElements.find((e) => e.id === id);
    const isCurrentlyVisible =
      elementVisibility[id] !== undefined
        ? elementVisibility[id]
        : (el?.drawings.some((d) => d.visible !== false) ?? true);

    setElementVisibility((prev) => ({
      ...prev,
      [id]: !isCurrentlyVisible,
    }));
  };

  const handleToggleTimeframeVisibility = (
    timeframe: string,
    targetVisible: boolean,
  ) => {
    const targetIds = activeElements
      .filter((el) => (el.sourceTimeframe || 'Common') === timeframe)
      .map((el) => el.id);

    setElementVisibility((prev) => {
      const next = { ...prev };
      for (const id of targetIds) {
        next[id] = targetVisible;
      }
      return next;
    });
  };

  const handleDataLoaded = useCallback((newData: ForexChartData) => {
    setChartData(newData);
    const tfs = Object.keys(newData.timeframes || {});
    if (tfs.length > 0) {
      const largestTf = getLargestTimeframe(tfs, newData.timeframeUnits);
      setCurrentTimeframe(largestTf);
    }
    setElementVisibility({});
  }, []);

  const handleCasesLoaded = useCallback(
    (newCases: ChartCase[], defaultIndex: number = 0) => {
      setCases(newCases);
      const safeIdx = Math.max(0, Math.min(defaultIndex, newCases.length - 1));
      setCurrentCaseIndex(safeIdx);
      if (newCases[safeIdx]) {
        handleDataLoaded(newCases[safeIdx]!.data);
      }
    },
    [handleDataLoaded],
  );

  const handleSwitchCase = useCallback(
    (newIndex: number) => {
      if (cases.length === 0) return;
      const safeIdx = (newIndex + cases.length) % cases.length;
      setCurrentCaseIndex(safeIdx);
      if (cases[safeIdx]) {
        handleDataLoaded(cases[safeIdx]!.data);
      }
    },
    [cases, handleDataLoaded],
  );

  const handleDropOnWindow = async (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const files = await getFilesFromDataTransfer(e.dataTransfer);
      const chartFiles = files.filter(
        (f) =>
          f.name.endsWith('.json') ||
          f.name.endsWith('.gz') ||
          f.name.endsWith('.gzip'),
      );
      if (chartFiles.length === 1) {
        const { data, fileInfo } = await parseChartFile(chartFiles[0]!);
        handleCasesLoaded(
          [
            {
              id: chartFiles[0]!.name,
              name:
                data.symbol ||
                fileInfo.name.replace(/\.(json|gz|gzip|\.json\.gz)$/i, ''),
              filename: chartFiles[0]!.name,
              data,
            },
          ],
          0,
        );
      } else if (chartFiles.length > 1) {
        const parsedCases = await parseMultipleChartFiles(chartFiles);
        if (parsedCases.length > 0) {
          handleCasesLoaded(parsedCases, 0);
        }
      }
    } catch {}
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
        e.preventDefault();
        if (cases.length > 1) {
          handleSwitchCase(currentCaseIndex - 1);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
        e.preventDefault();
        if (cases.length > 1) {
          handleSwitchCase(currentCaseIndex + 1);
        }
        return;
      }

      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= availableTimeframes.length) {
        const tf = availableTimeframes[num - 1];
        if (tf) setCurrentTimeframe(tf);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [availableTimeframes, cases.length, currentCaseIndex, handleSwitchCase]);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDropOnWindow}
      className="relative h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#090d16] text-slate-800 dark:text-slate-100 select-none"
    >
      <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
        {availableTimeframes.length > 0 && (
          <div className="inline-flex items-center h-8 bg-white/90 dark:bg-slate-900/90 p-1 rounded-lg border border-slate-200 dark:border-slate-700/80 backdrop-blur-md shadow-sm">
            {availableTimeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setCurrentTimeframe(tf)}
                className={`h-6 px-2.5 inline-flex items-center justify-center text-xs font-semibold leading-none rounded-md cursor-pointer transition-colors ${
                  currentTimeframe === tf
                    ? 'bg-sky-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        )}

        {cases.length > 1 && (
          <div
            ref={caseDropdownContainerRef}
            className="relative inline-block"
            onMouseEnter={handleCaseMouseEnter}
            onMouseLeave={handleCaseMouseLeave}
          >
            <div className="inline-flex items-center h-8 bg-white/95 dark:bg-slate-900/95 p-1 rounded-lg border border-slate-200 dark:border-slate-700/80 backdrop-blur-md shadow-sm">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwitchCase(currentCaseIndex - 1);
                }}
                className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                title="Previous case (Ctrl + ←)"
                aria-label="Previous case"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div
                className="h-6 px-2 inline-flex items-center justify-center gap-1.5 text-xs rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer select-none transition-colors"
                onClick={() => setIsCaseDropdownOpen((prev) => !prev)}
                title="Hover or click to select case"
              >
                <FolderOpen className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span
                  className="font-semibold text-slate-800 dark:text-slate-100 leading-normal truncate max-w-[200px] sm:max-w-[280px] py-0.5"
                  title={
                    cases[currentCaseIndex]?.title ||
                    cases[currentCaseIndex]?.name ||
                    'Case'
                  }
                >
                  {cases[currentCaseIndex]?.title ||
                    cases[currentCaseIndex]?.name ||
                    'Case'}
                </span>
                <span className="inline-flex items-center justify-center h-[18px] px-1.5 rounded-full text-[10px] font-medium leading-none bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                  {currentCaseIndex + 1}/{cases.length}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isCaseDropdownOpen ? 'rotate-180' : ''}`}
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSwitchCase(currentCaseIndex + 1);
                }}
                className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                title="Next case (Ctrl + →)"
                aria-label="Next case"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {isCaseDropdownOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 z-50 min-w-[260px] max-w-[320px] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1.5 shadow-2xl backdrop-blur-md text-xs"
                onMouseEnter={handleCaseMouseEnter}
                onMouseLeave={handleCaseMouseLeave}
              >
                {groupedCases.ungrouped.map(({ caseItem, originalIndex }) => {
                  const isActive = originalIndex === currentCaseIndex;
                  return (
                    <button
                      key={caseItem.id}
                      onMouseEnter={() => setHoveredGroup(null)}
                      onClick={() => {
                        handleSwitchCase(originalIndex);
                        setIsCaseDropdownOpen(false);
                        setHoveredGroup(null);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title={caseItem.title || caseItem.name}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium truncate">
                          {caseItem.title || caseItem.name}
                        </span>
                      </div>
                      {isActive && (
                        <Check className="w-4 h-4 text-sky-500 shrink-0" />
                      )}
                    </button>
                  );
                })}

                {groupedCases.ungrouped.length > 0 &&
                  groupedCases.groups.length > 0 && (
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  )}

                {groupedCases.groups.map((group) => {
                  const isGroupHovered = hoveredGroup === group.name;

                  return (
                    <div
                      key={group.name}
                      className="relative"
                      onMouseEnter={() => setHoveredGroup(group.name)}
                    >
                      <div
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg transition-colors cursor-pointer select-none ${
                          isGroupHovered
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Folder className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          <span className="font-medium truncate">
                            {group.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
                            {group.items.length}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>

                      {isGroupHovered && (
                        <div
                          className="absolute left-full top-0 ml-1.5 z-50 min-w-[260px] max-w-[340px] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1.5 shadow-2xl backdrop-blur-md text-xs max-h-[380px] overflow-y-auto before:absolute before:-left-2 before:top-0 before:w-2.5 before:h-full before:content-['']"
                          onMouseEnter={() => setHoveredGroup(group.name)}
                        >
                          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mb-1 border-b border-slate-100 dark:border-slate-800/80 pb-1.5">
                            <Folder className="w-3 h-3 text-sky-500" />
                            <span className="truncate">{group.name}</span>
                          </div>
                          <div className="space-y-0.5">
                            {group.items.map(({ caseItem, originalIndex }) => {
                              const isActive =
                                originalIndex === currentCaseIndex;
                              return (
                                <button
                                  key={caseItem.id}
                                  onClick={() => {
                                    handleSwitchCase(originalIndex);
                                    setIsCaseDropdownOpen(false);
                                    setHoveredGroup(null);
                                  }}
                                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title={caseItem.title || caseItem.name}
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="font-medium truncate">
                                      {caseItem.title || caseItem.name}
                                    </span>
                                  </div>
                                  {isActive && (
                                    <Check className="w-4 h-4 text-sky-500 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className="absolute top-3 z-30 flex items-center gap-2"
        style={{ right: `${Math.max(76, priceScaleWidth) + 12}px` }}
      >
        {hasCandles && (
          <>
            <div className="relative">
              <button
                id="btn-show-hide-item"
                onClick={() => setIsPopoverOpen((prev) => !prev)}
                className={`inline-flex items-center justify-center h-8 gap-2 px-3 rounded-lg font-medium border text-xs leading-none backdrop-blur-md cursor-pointer transition-colors ${
                  isPopoverOpen
                    ? 'bg-sky-500/25 text-sky-600 dark:text-sky-300 border-sky-500/60'
                    : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Show / Hide active elements in this timeframe"
              >
                {visibleElementsCount > 0 ? (
                  <Eye className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                )}
                <span className="leading-none">Elements</span>
                <span
                  className={`inline-flex items-center justify-center h-5 min-w-5 px-2 rounded-full text-[11px] font-medium leading-none ${
                    isPopoverOpen
                      ? 'bg-sky-500/20 text-sky-700 dark:text-sky-200'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80'
                  }`}
                >
                  {visibleElementsCount}/{activeElements.length}
                </span>
              </button>

              {isPopoverOpen && (
                <Suspense fallback={null}>
                  <LineItemsPopover
                    isOpen={isPopoverOpen}
                    onClose={() => setIsPopoverOpen(false)}
                    elements={activeElements}
                    elementVisibility={elementVisibility}
                    onToggleElementVisibility={handleToggleElementVisibility}
                    onToggleTimeframeVisibility={
                      handleToggleTimeframeVisibility
                    }
                    hoveredElementId={hoveredElementId}
                    onHoverElement={setHoveredElementId}
                  />
                </Suspense>
              )}
            </div>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="inline-flex items-center justify-center h-8 gap-1.5 px-3 rounded-lg font-medium border text-xs leading-none backdrop-blur-md cursor-pointer transition-colors bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Open Folder (Select chart data folder)"
            >
              <FolderOpen className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span className="leading-none">Folder</span>
            </button>
          </>
        )}

        <button
          id="btn-toggle-theme"
          onClick={handleToggleTheme}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg font-medium border text-xs backdrop-blur-md cursor-pointer transition-colors bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800"
          title={
            theme === 'dark' ? 'Switch to white mode' : 'Switch to dark mode'
          }
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>
      </div>

      <main className="w-full h-full relative">
        <Suspense
          fallback={
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#090d16] text-slate-500 dark:text-slate-400 gap-3">
              <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full" />
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Loading chart...
              </span>
            </div>
          }
        >
          <ForexChart
            ref={chartRef}
            candles={currentTfData.candles}
            drawings={currentActiveDrawings}
            currentTimeframe={currentTimeframe}
            timeframeUnits={chartData.timeframeUnits}
            isDrawingsVisible={true}
            scopeFilter={{ common: true, timeframe: true }}
            elementVisibility={elementVisibility}
            hoveredDrawingId={hoveredDrawingId}
            hoveredElementId={hoveredElementId}
            onHoverDrawing={setHoveredDrawingId}
            theme={theme}
            onPriceScaleWidthChange={setPriceScaleWidth}
            isNewsVisible={isNewsVisible}
          />
        </Suspense>
      </main>

      {(!hasCandles || isUploadModalOpen) && (
        <Suspense fallback={null}>
          <UploadModal
            isOpen={true}
            showCloseButton={hasCandles}
            onClose={() => setIsUploadModalOpen(false)}
            onDataLoaded={handleDataLoaded}
            onCasesLoaded={handleCasesLoaded}
          />
        </Suspense>
      )}
    </div>
  );
};

export default App;
