import React, { useEffect, useRef, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, CrosshairMode, Time } from 'lightweight-charts';
import { Candle, LineDrawing, OHLCData } from '../../types/chart';
import { renderLine } from '../../utils/canvasDrawing';

interface ForexChartProps {
  candles: Candle[];
  drawings: LineDrawing[];
  currentTimeframe: string;
  isDrawingsVisible: boolean;
  scopeFilter: { common: boolean; timeframe: boolean };
  individualVisibility: { [id: string]: boolean };
  hoveredDrawingId: string | null;
  onHoverDrawing: (id: string | null) => void;
  onCrosshairMove: (data: OHLCData | null) => void;
}

export const ForexChart: React.FC<ForexChartProps> = ({
  candles,
  drawings,
  currentTimeframe,
  isDrawingsVisible,
  scopeFilter,
  individualVisibility,
  hoveredDrawingId,
  onHoverDrawing,
  onCrosshairMove,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  const latestPropsRef = useRef({
    candles,
    drawings,
    currentTimeframe,
    isDrawingsVisible,
    scopeFilter,
    individualVisibility,
    hoveredDrawingId,
  });

  useEffect(() => {
    latestPropsRef.current = {
      candles,
      drawings,
      currentTimeframe,
      isDrawingsVisible,
      scopeFilter,
      individualVisibility,
      hoveredDrawingId,
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

    const {
      candles: currentCandles,
      drawings: currentDrawings,
      currentTimeframe: currentTf,
      isDrawingsVisible: visibleMaster,
      scopeFilter: scopes,
      individualVisibility: indVis,
      hoveredDrawingId: hoveredId,
    } = latestPropsRef.current;

    if (!visibleMaster || currentCandles.length === 0) {
      ctx.restore();
      return;
    }

    const timeScale = chart.timeScale();

    for (const drawing of currentDrawings) {
      if (indVis[drawing.id] === false) continue;

      const isCommon = !drawing.sourceTimeframe;
      if (isCommon && !scopes.common) continue;
      if (!isCommon && !scopes.timeframe) continue;

      if (!isCommon && drawing.sourceTimeframe !== currentTf && drawing.stretch === false) {
        continue;
      }

      const isHovered = hoveredId === drawing.id;

      try {
        renderLine(ctx, drawing, currentCandles, timeScale, series, isHovered);
      } catch (err) {
        console.error('Error rendering line', drawing.id, err);
      }
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
        barSpacing: 9,
        minBarSpacing: 3,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
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

    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        onCrosshairMove(null);
        return;
      }

      const barData = param.seriesData.get(candleSeries) as any;
      if (barData) {
        const open = barData.open;
        const close = barData.close;
        const change = close - open;
        const changePercent = open !== 0 ? (change / open) * 100 : 0;

        onCrosshairMove({
          time: Number(param.time),
          open: barData.open,
          high: barData.high,
          low: barData.low,
          close: barData.close,
          change,
          changePercent,
        });
      } else {
        onCrosshairMove(null);
      }
    });

    // 60fps loop on mouse drag so lines follow 1:1 without latency
    const startDragLoop = () => {
      isDraggingRef.current = true;
      const step = () => {
        if (!isDraggingRef.current) return;
        redrawCanvas();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const stopDragLoop = () => {
      isDraggingRef.current = false;
      redrawCanvas();
    };

    container.addEventListener('pointerdown', startDragLoop);
    window.addEventListener('pointerup', stopDragLoop);
    window.addEventListener('pointercancel', stopDragLoop);
    container.addEventListener('wheel', requestCanvasRedraw);

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !container) return;
      const { width, height } = entries[0].contentRect;
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

    return () => {
      container.removeEventListener('pointerdown', startDragLoop);
      window.removeEventListener('pointerup', stopDragLoop);
      window.removeEventListener('pointercancel', stopDragLoop);
      container.removeEventListener('wheel', requestCanvasRedraw);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [onCrosshairMove, redrawCanvas, requestCanvasRedraw]);

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

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }

    requestCanvasRedraw();
  }, [candles, requestCanvasRedraw]);

  useEffect(() => {
    requestCanvasRedraw();
  }, [
    drawings,
    currentTimeframe,
    isDrawingsVisible,
    scopeFilter,
    individualVisibility,
    hoveredDrawingId,
    requestCanvasRedraw,
  ]);

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-[#090d16]">
      <div ref={containerRef} className="w-full h-full" />
      <canvas
        ref={canvasRef}
        onMouseLeave={() => onHoverDrawing(null)}
        className="absolute top-0 left-0 pointer-events-none z-10"
      />
    </div>
  );
};
