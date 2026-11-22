import {
  useEffect,
  useRef,
  useCallback,
  memo,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';
import { RotateCcw } from 'lucide-react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  CrosshairMode,
  type Time,
} from 'lightweight-charts';
import { type Candle, type LineDrawing } from '../../types/chart.js';
import { renderLine } from '../../utils/canvasDrawing.js';
import { canInheritTimeframe } from '../../utils/timeframeService.js';

export interface ForexChartRef {
  resetView: () => void;
}

interface ForexChartProps {
  candles: Candle[];
  drawings: LineDrawing[];
  currentTimeframe: string;
  timeframeUnits?: Record<string, number>;
  isDrawingsVisible: boolean;
  scopeFilter: { common: boolean; timeframe: boolean };
  elementVisibility: { [id: string]: boolean };
  hoveredDrawingId: string | null;
  hoveredElementId: string | null;
  onHoverDrawing: (id: string | null) => void;
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
      } = latestPropsRef.current;

      if (!visibleMaster || currentCandles.length === 0) {
        ctx.restore();
        return;
      }

      const timeScale = chart.timeScale();

      for (const drawing of currentDrawings) {
        const elId = drawing.element || drawing.group || 'Elements';

        if (elVis[elId] === false) continue;
        if (drawing.visible === false) continue;

        const isCommon = !drawing.sourceTimeframe;
        if (isCommon && !scopes.common) continue;
        if (!isCommon && !scopes.timeframe) continue;

        if (
          drawing.sourceTimeframe &&
          !canInheritTimeframe(drawing.sourceTimeframe, currentTf, tfUnits)
        ) {
          continue;
        }

        if (
          !isCommon &&
          drawing.sourceTimeframe !== currentTf &&
          drawing.stretch === false
        ) {
          continue;
        }

        const isHovered = hoveredEl === elId || hoveredId === drawing.id;

        try {
          renderLine(
            ctx,
            drawing,
            currentCandles,
            timeScale,
            series,
            isHovered,
            currentTf,
            tfUnits,
          );
        } catch {}
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
      const defaultBarSpacing = 11;
      const rightOffset = 12;
      const visibleBars = Math.max(
        40,
        Math.floor(containerWidth / defaultBarSpacing),
      );

      let from: number;
      let to: number;

      if (candleCount < visibleBars) {
        const candleCenter = (candleCount - 1) / 2;
        const halfVisible = visibleBars / 2;
        from = candleCenter - halfVisible;
        to = candleCenter + halfVisible;
      } else {
        to = candleCount - 1 + rightOffset;
        from = to - visibleBars;
      }

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

      const chart = createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
          background: { type: ColorType.Solid, color: '#090d16' },
          textColor: '#94a3b8',
          fontSize: 12,
          fontFamily: "'JetBrains Mono', monospace",
        },
        grid: {
          vertLines: { color: 'rgba(51, 65, 85, 0.22)', style: 1 },
          horzLines: { color: 'rgba(51, 65, 85, 0.22)', style: 1 },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: '#64748b',
            width: 1,
            style: 3,
            labelBackgroundColor: '#1e293b',
          },
          horzLine: {
            color: '#64748b',
            width: 1,
            style: 3,
            labelBackgroundColor: '#1e293b',
          },
        },
        rightPriceScale: {
          borderColor: '#334155',
          scaleMargins: {
            top: 0.08,
            bottom: 0.08,
          },
        },
        timeScale: {
          borderColor: '#334155',
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 12,
          barSpacing: 11,
          minBarSpacing: 6,
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
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
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

        const minBarSpacing = 6;
        const maxBarSpacing = 50;
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
    }, [candles, applyDefaultView, requestCanvasRedraw, resetChartModified]);

    useEffect(() => {
      resetChartModified();
    }, [currentTimeframe, resetChartModified]);

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
        className="relative w-full h-full select-none overflow-hidden bg-[#090d16]"
      >
        <div ref={containerRef} className="w-full h-full" />
        <canvas
          ref={canvasRef}
          onMouseLeave={() => onHoverDrawing(null)}
          className="absolute top-0 left-0 pointer-events-none z-10"
        />
        {contextMenu && isChartModified && (
          <div
            ref={contextMenuRef}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            className="absolute z-50 bg-[#1e222d] border border-slate-700/90 rounded-md shadow-2xl p-1 text-xs select-none backdrop-blur-md"
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
              className="flex items-center justify-center gap-2 px-3 py-1.5 rounded text-slate-200 hover:bg-sky-600/30 hover:text-white transition-colors group cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400" />
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
