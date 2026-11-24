import {
  useEffect,
  useRef,
  useCallback,
  memo,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';
import { RotateCcw, Newspaper } from 'lucide-react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  type Time,
} from 'lightweight-charts';
import {
  type Candle,
  type Drawing,
  isLineDrawing,
  isPoiDrawing,
  isPiboDrawing,
} from '../../types/chart.js';
import { type ThemeMode } from '../../types/theme.js';
import {
  renderLine,
  renderZone,
  renderPoi,
  renderPibo,
  renderCandleNews,
  renderCandleLabels,
  type NewsAnchor,
} from '../../utils/canvasDrawing.js';
import { canInheritTimeframe } from '../../utils/timeframeService.js';
import {
  THEME_PALETTES,
  getThemeChartOptions,
} from '../../utils/themeService.js';

export interface ForexChartRef {
  resetView: () => void;
}

interface ForexChartProps {
  candles: Candle[];
  drawings: Drawing[];
  currentTimeframe: string;
  timeframeUnits?: Record<string, number>;
  isDrawingsVisible: boolean;
  scopeFilter: { common: boolean; timeframe: boolean };
  elementVisibility: { [id: string]: boolean };
  hoveredDrawingId: string | null;
  hoveredElementId: string | null;
  onHoverDrawing: (id: string | null) => void;
  theme?: ThemeMode;
  onPriceScaleWidthChange?: (width: number) => void;
  isNewsVisible?: boolean;
}

const ForexChartComponent = forwardRef<ForexChartRef, ForexChartProps>(
  (
    {
      candles,
      drawings,
      currentTimeframe,
      timeframeUnits,
      isDrawingsVisible,
      scopeFilter,
      elementVisibility,
      hoveredDrawingId,
      hoveredElementId,
      onHoverDrawing,
      theme = 'dark',
      onPriceScaleWidthChange,
      isNewsVisible = true,
    },
    ref,
  ) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const isDraggingRef = useRef<boolean>(false);
    const [contextMenu, setContextMenu] = useState<{
      x: number;
      y: number;
    } | null>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const [isChartModified, setIsChartModified] = useState<boolean>(false);
    const isChartModifiedRef = useRef<boolean>(false);
    const [hoveredNews, setHoveredNews] = useState<NewsAnchor | null>(null);
    const hoveredNewsRef = useRef<NewsAnchor | null>(null);
    const newsAnchorsRef = useRef<NewsAnchor[]>([]);

    const markChartModified = useCallback(() => {
      if (!isChartModifiedRef.current) {
        isChartModifiedRef.current = true;
        setIsChartModified(true);
      }
    }, []);

    const resetChartModified = useCallback(() => {
      isChartModifiedRef.current = false;
      setIsChartModified(false);
    }, []);

    const lastPriceScaleWidthRef = useRef<number>(0);

    const latestPropsRef = useRef({
      candles,
      drawings,
      currentTimeframe,
      timeframeUnits,
      isDrawingsVisible,
      scopeFilter,
      elementVisibility,
      hoveredDrawingId,
      hoveredElementId,
      theme,
      onPriceScaleWidthChange,
      isNewsVisible,
    });

    useEffect(() => {
      latestPropsRef.current = {
        candles,
        drawings,
        currentTimeframe,
        timeframeUnits,
        isDrawingsVisible,
        scopeFilter,
        elementVisibility,
        hoveredDrawingId,
        hoveredElementId,
        theme,
        onPriceScaleWidthChange,
        isNewsVisible,
      };
    });

    const redrawCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const chart = chartRef.current;
      const series = candlestickSeriesRef.current;
      if (!canvas || !chart || !series) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const priceScaleWidth = chart.priceScale('right').width();
      if (
        priceScaleWidth > 0 &&
        priceScaleWidth !== lastPriceScaleWidthRef.current
      ) {
        lastPriceScaleWidthRef.current = priceScaleWidth;
        latestPropsRef.current.onPriceScaleWidthChange?.(priceScaleWidth);
      }
      const timeScaleHeight = chart.timeScale().height();
      const paneWidth = Math.max(0, width - priceScaleWidth);
      const paneHeight = Math.max(0, height - timeScaleHeight);

      ctx.beginPath();
      ctx.rect(0, 0, paneWidth, paneHeight);
      ctx.clip();

      const {
        candles: currentCandles,
        drawings: currentDrawings,
        currentTimeframe: currentTf,
        timeframeUnits: tfUnits,
        isDrawingsVisible: visibleMaster,
        scopeFilter: scopes,
        elementVisibility: elVis,
        hoveredDrawingId: hoveredId,
        hoveredElementId: hoveredEl,
        theme: currentTheme = 'dark',
      } = latestPropsRef.current;

      if (!visibleMaster || currentCandles.length === 0) {
        ctx.restore();
        return;
      }

      const timeScale = chart.timeScale();

      for (const drawing of currentDrawings) {
        const elId = drawing.group || drawing.element || 'Elements';

        const isElementVisible =
          elVis[elId] !== undefined ? elVis[elId] : drawing.visible !== false;
        if (!isElementVisible) continue;

        const isCommon = !drawing.sourceTimeframe;
        if (isCommon && !scopes.common) continue;
        if (!isCommon && !scopes.timeframe) continue;

        if (isPiboDrawing(drawing)) {
          if (
            drawing.sourceTimeframe &&
            drawing.sourceTimeframe !== currentTf
          ) {
            continue;
          }
        } else if (
          drawing.sourceTimeframe &&
          !canInheritTimeframe(drawing.sourceTimeframe, currentTf, tfUnits)
        ) {
          continue;
        }

        if (
          !isCommon &&
          drawing.type !== 'poi' &&
          drawing.type !== 'keyLevel' &&
          drawing.type !== 'pibo' &&
          drawing.type !== 'fibonacci' &&
          drawing.sourceTimeframe !== currentTf &&
          drawing.stretch === false
        ) {
          continue;
        }

        const isHovered = hoveredEl === elId || hoveredId === drawing.id;

        try {
          if (isLineDrawing(drawing)) {
            renderLine(
              ctx,
              drawing,
              currentCandles,
              timeScale,
              series,
              isHovered,
              currentTf,
              tfUnits,
              currentTheme,
            );
          } else if (isPoiDrawing(drawing)) {
            renderPoi(
              ctx,
              drawing,
              currentCandles,
              timeScale,
              series,
              paneWidth,
              isHovered,
              currentTf,
              tfUnits,
              currentTheme,
            );
          } else if (isPiboDrawing(drawing)) {
            renderPibo(
              ctx,
              drawing,
              currentCandles,
              timeScale,
              series,
              paneWidth,
              isHovered,
              currentTf,
              tfUnits,
              currentTheme,
            );
          } else {
            renderZone(
              ctx,
              drawing,
              currentCandles,
              timeScale,
              series,
              isHovered,
              currentTf,
              tfUnits,
              currentTheme,
            );
          }
        } catch {}
      }

      try {
        renderCandleLabels(
          ctx,
          currentCandles,
          timeScale,
          series,
          paneWidth,
          paneHeight,
          true,
          currentTheme,
          currentDrawings,
          currentTf,
          tfUnits,
          elVis,
          hoveredEl,
        );
      } catch {}

      if (latestPropsRef.current.isNewsVisible !== false) {
        try {
          const anchors = renderCandleNews(
            ctx,
            currentCandles,
            timeScale,
            series,
            paneWidth,
            paneHeight,
            currentTheme,
            hoveredNewsRef.current?.candle.time,
          );
          newsAnchorsRef.current = anchors;
        } catch {
          newsAnchorsRef.current = [];
        }
      } else {
        newsAnchorsRef.current = [];
      }

      ctx.restore();
    }, []);

    const requestCanvasRedraw = useCallback(() => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(() => {
        redrawCanvas();
      });
    }, [redrawCanvas]);

    const applyDefaultView = useCallback((candleCount: number) => {
      const chart = chartRef.current;
      const container = containerRef.current;
      if (!chart || !container || candleCount === 0) return;

      const containerWidth = container.clientWidth || 1200;

      let targetBarSpacing = 11;
      if (candleCount <= 40) {
        const coverageRatio = Math.min(
          0.62,
          Math.max(0.42, 0.7 - candleCount * 0.006),
        );
        const calculatedSpacing = Math.floor(
          (containerWidth * coverageRatio) / candleCount,
        );
        targetBarSpacing = Math.min(65, Math.max(16, calculatedSpacing));
      } else if (candleCount <= 70) {
        targetBarSpacing = 14;
      }

      const visibleBars = Math.max(
        candleCount + 6,
        Math.floor(containerWidth / targetBarSpacing),
      );

      let from: number;
      let to: number;

      if (candleCount < visibleBars) {
        const candleCenter = (candleCount - 1) / 2;
        const halfVisible = visibleBars / 2;
        from = candleCenter - halfVisible;
        to = candleCenter + halfVisible;
      } else {
        const rightOffset = 12;
        to = candleCount - 1 + rightOffset;
        from = to - visibleBars;
      }

      chart.timeScale().applyOptions({
        barSpacing: targetBarSpacing,
        minBarSpacing: 1,
      });
      chart.timeScale().setVisibleLogicalRange({ from, to });
      chart.priceScale('right').applyOptions({ autoScale: true });
    }, []);

    const resetView = useCallback(() => {
      if (!chartRef.current) return;
      applyDefaultView(latestPropsRef.current.candles.length);
      resetChartModified();
      requestCanvasRedraw();
    }, [applyDefaultView, requestCanvasRedraw, resetChartModified]);

    const openContextMenu = useCallback((clientX: number, clientY: number) => {
      if (!isChartModifiedRef.current) {
        return;
      }
      const container = wrapperRef.current || containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;

      const menuWidth = 160;
      const menuHeight = 36;
      const x = Math.min(
        Math.max(8, rawX),
        Math.max(8, rect.width - menuWidth - 8),
      );
      const y = Math.min(
        Math.max(8, rawY),
        Math.max(8, rect.height - menuHeight - 8),
      );

      setContextMenu({ x, y });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        resetView,
      }),
      [resetView],
    );

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const initialTheme = latestPropsRef.current.theme || 'dark';
      const themeOpts = getThemeChartOptions(initialTheme);
      const palette = THEME_PALETTES[initialTheme].chart;

      const chart = createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        ...themeOpts,
        layout: {
          ...themeOpts.layout,
          background: { type: ColorType.Solid, color: palette.background },
        },
        timeScale: {
          ...themeOpts.timeScale,
          timeVisible: latestPropsRef.current.currentTimeframe !== 'D1',
          secondsVisible: false,
          rightOffset: 12,
          barSpacing: 11,
          minBarSpacing: 1,
        },
        rightPriceScale: {
          ...themeOpts.rightPriceScale,
          scaleMargins: {
            top: 0.08,
            bottom: 0.08,
          },
        },
        kineticScroll: {
          touch: false,
          mouse: false,
        },
        handleScroll: {
          mouseWheel: false,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          axisDoubleClickReset: true,
          mouseWheel: false,
          pinch: true,
        },
      });

      chartRef.current = chart;

      const candleSeries = chart.addCandlestickSeries({
        upColor: palette.upCandleColor,
        downColor: palette.downCandleColor,
        borderVisible: false,
        wickUpColor: palette.upCandleColor,
        wickDownColor: palette.downCandleColor,
        priceFormat: {
          type: 'price',
          precision: 5,
          minMove: 0.00001,
        },
      });
      candlestickSeriesRef.current = candleSeries;

      chart.timeScale().subscribeVisibleTimeRangeChange(() => {
        requestCanvasRedraw();
      });
      chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
        requestCanvasRedraw();
      });

      let pointerStartX = 0;
      let pointerStartY = 0;

      const handlePointerDown = (e: PointerEvent) => {
        if (e.button === 0) {
          pointerStartX = e.clientX;
          pointerStartY = e.clientY;
          isDraggingRef.current = true;
          const step = () => {
            if (!isDraggingRef.current) return;
            redrawCanvas();
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      };

      const handlePointerMove = (e: PointerEvent) => {
        if (isDraggingRef.current) {
          const dx = Math.abs(e.clientX - pointerStartX);
          const dy = Math.abs(e.clientY - pointerStartY);
          if (dx > 3 || dy > 3) {
            markChartModified();
          }
        } else if (container) {
          const rect = container.getBoundingClientRect();
          const px = e.clientX - rect.left;
          const py = e.clientY - rect.top;
          let matched: NewsAnchor | null = null;
          for (const a of newsAnchorsRef.current) {
            const dx = px - a.x;
            const dy = py - a.y;
            if (dx * dx + dy * dy <= (a.radius + 6) * (a.radius + 6)) {
              matched = a;
              break;
            }
          }
          if (matched) {
            if (hoveredNewsRef.current?.candle.time !== matched.candle.time) {
              hoveredNewsRef.current = matched;
              setHoveredNews(matched);
              requestCanvasRedraw();
            }
          } else if (hoveredNewsRef.current) {
            hoveredNewsRef.current = null;
            setHoveredNews(null);
            requestCanvasRedraw();
          }
        }
      };

      const handlePointerLeave = () => {
        if (hoveredNewsRef.current) {
          hoveredNewsRef.current = null;
          setHoveredNews(null);
          requestCanvasRedraw();
        }
      };

      const stopDragLoop = () => {
        isDraggingRef.current = false;
        redrawCanvas();
      };

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const chartInstance = chartRef.current;
        if (!chartInstance) return;

        const timeScale = chartInstance.timeScale();
        const currentRange = timeScale.getVisibleLogicalRange();
        if (!currentRange) return;

        const delta = e.deltaY;
        if (delta === 0) return;

        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const logicalUnderCursor = timeScale.coordinateToLogical(x);

        const zoomSpeed = 0.0018;
        const scale = Math.exp(delta * zoomSpeed);

        const center =
          logicalUnderCursor !== null
            ? logicalUnderCursor
            : (currentRange.from + currentRange.to) / 2;

        const currentSpan = currentRange.to - currentRange.from;
        const newFrom = center - (center - currentRange.from) * scale;
        const newTo = center + (currentRange.to - center) * scale;
        const newSpan = newTo - newFrom;

        const minBarSpacing = 4;
        const maxBarSpacing = 85;
        const minSpan = Math.max(12, Math.floor(rect.width / maxBarSpacing));
        const maxSpan = Math.max(
          minSpan + 5,
          Math.floor(rect.width / minBarSpacing),
        );

        const clampedSpan = Math.min(Math.max(newSpan, minSpan), maxSpan);
        if (
          Math.abs(clampedSpan - currentSpan) < 0.01 &&
          ((scale > 1 && currentSpan >= maxSpan) ||
            (scale < 1 && currentSpan <= minSpan))
        ) {
          return;
        }

        const ratio = clampedSpan / currentSpan;
        const clampedFrom = center - (center - currentRange.from) * ratio;
        const clampedTo = center + (currentRange.to - center) * ratio;

        timeScale.setVisibleLogicalRange({ from: clampedFrom, to: clampedTo });
        markChartModified();
        requestCanvasRedraw();
      };

      container.addEventListener('pointerdown', handlePointerDown);
      container.addEventListener('pointerleave', handlePointerLeave);
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', stopDragLoop);
      window.addEventListener('pointercancel', stopDragLoop);
      container.addEventListener('wheel', handleWheel, { passive: false });

      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !container) return;
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });

          const canvas = canvasRef.current;
          if (canvas) {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
          }

          requestCanvasRedraw();

          const pWidth = chart.priceScale('right').width();
          if (pWidth > 0 && pWidth !== lastPriceScaleWidthRef.current) {
            lastPriceScaleWidthRef.current = pWidth;
            latestPropsRef.current.onPriceScaleWidthChange?.(pWidth);
          }
        }
      });

      resizeObserver.observe(container);

      const handleDblClick = () => {
        resetView();
      };

      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        openContextMenu(e.clientX, e.clientY);
      };

      container.addEventListener('dblclick', handleDblClick);
      container.addEventListener('contextmenu', handleContextMenu, true);

      return () => {
        container.removeEventListener('pointerdown', handlePointerDown);
        container.removeEventListener('pointerleave', handlePointerLeave);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', stopDragLoop);
        window.removeEventListener('pointercancel', stopDragLoop);
        container.removeEventListener('wheel', handleWheel);
        container.removeEventListener('dblclick', handleDblClick);
        container.removeEventListener('contextmenu', handleContextMenu, true);
        resizeObserver.disconnect();
        chart.remove();
        chartRef.current = null;
      };
    }, [
      markChartModified,
      openContextMenu,
      redrawCanvas,
      requestCanvasRedraw,
      resetView,
    ]);

    useEffect(() => {
      if (!contextMenu) return;

      const handlePointerDown = (e: PointerEvent) => {
        if (
          contextMenuRef.current &&
          !contextMenuRef.current.contains(e.target as Node)
        ) {
          setContextMenu(null);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setContextMenu(null);
        }
      };

      window.addEventListener('pointerdown', handlePointerDown);
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('pointerdown', handlePointerDown);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [contextMenu]);

    useEffect(() => {
      if (!candlestickSeriesRef.current || candles.length === 0) return;

      const chartCandles = candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      candlestickSeriesRef.current.setData(chartCandles);

      applyDefaultView(candles.length);
      resetChartModified();
      requestCanvasRedraw();

      const pWidth = chartRef.current?.priceScale('right').width() ?? 0;
      if (pWidth > 0 && pWidth !== lastPriceScaleWidthRef.current) {
        lastPriceScaleWidthRef.current = pWidth;
        latestPropsRef.current.onPriceScaleWidthChange?.(pWidth);
      }
    }, [candles, applyDefaultView, requestCanvasRedraw, resetChartModified]);

    useEffect(() => {
      resetChartModified();
      const chart = chartRef.current;
      if (chart) {
        chart.timeScale().applyOptions({
          timeVisible: currentTimeframe !== 'D1',
        });
      }
    }, [currentTimeframe, resetChartModified]);

    useEffect(() => {
      const chart = chartRef.current;
      const series = candlestickSeriesRef.current;
      if (!chart || !series) return;

      const themeOpts = getThemeChartOptions(theme);
      const palette = THEME_PALETTES[theme].chart;

      chart.applyOptions({
        ...themeOpts,
        layout: {
          ...themeOpts.layout,
          background: { type: ColorType.Solid, color: palette.background },
        },
      });

      series.applyOptions({
        upColor: palette.upCandleColor,
        downColor: palette.downCandleColor,
        wickUpColor: palette.upCandleColor,
        wickDownColor: palette.downCandleColor,
      });

      requestCanvasRedraw();
    }, [theme, requestCanvasRedraw]);

    useEffect(() => {
      requestCanvasRedraw();
    }, [
      drawings,
      currentTimeframe,
      isDrawingsVisible,
      scopeFilter,
      elementVisibility,
      hoveredDrawingId,
      hoveredElementId,
      theme,
      isNewsVisible,
      requestCanvasRedraw,
    ]);

    return (
      <div
        ref={wrapperRef}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openContextMenu(e.clientX, e.clientY);
        }}
        className="relative w-full h-full select-none overflow-hidden bg-slate-50 dark:bg-[#090d16]"
      >
        <div ref={containerRef} className="w-full h-full" />
        <canvas
          ref={canvasRef}
          onMouseLeave={() => onHoverDrawing(null)}
          className="absolute top-0 left-0 pointer-events-none z-10"
        />
        {hoveredNews && (
          <div
            style={{
              left: `${Math.max(
                10,
                Math.min(
                  hoveredNews.x - 130,
                  (containerRef.current?.clientWidth || 800) - 290,
                ),
              )}px`,
              bottom: `${Math.max(
                16,
                (containerRef.current?.clientHeight || 600) -
                  (hoveredNews.y - hoveredNews.radius) +
                  10,
              )}px`,
            }}
            className="absolute z-40 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md w-72 pointer-events-none text-xs max-h-[min(380px,calc(100vh-120px))] flex flex-col"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                <Newspaper className="w-3.5 h-3.5 text-sky-500" />
                <span>News Events ({hoveredNews.news.length})</span>
              </div>
            </div>
            <div className="space-y-2 overflow-y-auto pr-1">
              {hoveredNews.news.map((item, idx) => {
                const itemTime = item.time ?? hoveredNews.candle.time;
                const formattedTime = new Date(
                  itemTime * 1000,
                ).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <div
                    key={idx}
                    className="space-y-1 pb-2 border-b border-slate-100 dark:border-slate-800/60 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {item.impact && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase shrink-0 ${
                              item.impact === 'high'
                                ? 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'
                                : item.impact === 'medium'
                                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                  : 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30'
                            }`}
                          >
                            {item.impact}
                          </span>
                        )}
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.title}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono shrink-0">
                        {formattedTime}
                      </span>
                    </div>
                    {item.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                        {item.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {contextMenu && isChartModified && (
          <div
            ref={contextMenuRef}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            className="absolute z-50 bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-700/90 rounded-md p-1 text-xs select-none backdrop-blur-md"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              onClick={() => {
                resetView();
                setContextMenu(null);
              }}
              className="flex items-center justify-center gap-2 px-3 py-1.5 rounded text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-600/30 hover:text-sky-600 dark:hover:text-white group cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-sky-500 dark:group-hover:text-sky-400" />
              <span className="font-medium text-xs leading-none">
                Reset chart view
              </span>
            </button>
          </div>
        )}
      </div>
    );
  },
);

export const ForexChart = memo(ForexChartComponent);
export default ForexChart;
