// Interactive chart powered by TradingView Lightweight Charts.
import { useEffect, useMemo, useRef, useState } from 'react';

const C = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b', blue:'#3b82f6',
  teal:'#14b8a6', bg:'#060d18', grid:'#1e3050', muted:'#5a7090',
};

function normaliseBars(bars) {
  return (bars || [])
    .filter(bar => bar && Number(bar.comex) > 0 && Number(bar.ts) > 0)
    .map(bar => ({
      time: Math.floor(Number(bar.ts) / 1000),
      open: Number(bar.open || bar.comex),
      high: Number(bar.high || Number(bar.comex) * 1.003),
      low: Number(bar.low || Number(bar.comex) * 0.997),
      close: Number(bar.comex),
      volume: Number(bar.vol || 0),
    }))
    .sort((a, b) => a.time - b.time)
    .filter((bar, index, values) => index === 0 || bar.time !== values[index - 1].time);
}

export default function TVChart({
  bars = [], activeTF = 'H4', ew, smcData,
  showFib = true, showSMC = true, showVolume = true,
  isLoading = false, onCrosshair,
}) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const volumeRef = useRef(null);
  const priceLinesRef = useRef([]);
  const fittedTimeframeRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const data = useMemo(() => normaliseBars(bars), [bars]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver;
    let crosshairHandler;

    async function mountChart() {
      try {
        const { createChart, ColorType, CrosshairMode } = await import('lightweight-charts');
        if (cancelled || !hostRef.current) return;
        const chart = createChart(hostRef.current, {
          width: hostRef.current.clientWidth,
          height: 330,
          layout: { background: { type: ColorType.Solid, color: C.bg }, textColor: '#8da3be' },
          grid: { vertLines: { color: '#102039' }, horzLines: { color: '#102039' } },
          crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#4a6387', labelBackgroundColor: C.blue }, horzLine: { color: '#4a6387', labelBackgroundColor: C.blue } },
          rightPriceScale: { borderColor: C.grid },
          timeScale: { borderColor: C.grid, timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 9, minBarSpacing: 3 },
          handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
          handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
        });
        const candle = chart.addCandlestickSeries({
          upColor: C.green, downColor: C.red, borderUpColor: C.green, borderDownColor: C.red,
          wickUpColor: C.green, wickDownColor: C.red, priceLineVisible: true,
          lastValueVisible: true, priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
        });
        const volume = chart.addHistogramSeries({
          priceFormat: { type: 'volume' }, priceScaleId: '', scaleMargins: { top: 0.78, bottom: 0 },
          lastValueVisible: false, priceLineVisible: false,
        });

        crosshairHandler = param => {
          const point = param.seriesData.get(candle);
          if (point) onCrosshair?.({ open: point.open, high: point.high, low: point.low, close: point.close });
        };
        chart.subscribeCrosshairMove(crosshairHandler);
        resizeObserver = new ResizeObserver(entries => {
          const width = entries[0]?.contentRect.width;
          if (width) chart.applyOptions({ width });
        });
        resizeObserver.observe(hostRef.current);
        chartRef.current = chart;
        candleRef.current = candle;
        volumeRef.current = volume;
        setReady(true);
      } catch {
        setLoadError(true);
      }
    }

    mountChart();
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (chartRef.current && crosshairHandler) chartRef.current.unsubscribeCrosshairMove(crosshairHandler);
      chartRef.current?.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, [onCrosshair]);

  useEffect(() => {
    if (!ready || !candleRef.current || !volumeRef.current) return;
    candleRef.current.setData(data);
    volumeRef.current.setData(showVolume ? data.map(bar => ({
      time: bar.time, value: bar.volume, color: bar.close >= bar.open ? `${C.green}55` : `${C.red}55`,
    })) : []);
    if (fittedTimeframeRef.current !== activeTF) {
      chartRef.current.timeScale().fitContent();
      fittedTimeframeRef.current = activeTF;
    }
  }, [ready, data, activeTF, showVolume]);

  useEffect(() => {
    const candle = candleRef.current;
    if (!ready || !candle) return;
    priceLinesRef.current.forEach(line => candle.removePriceLine(line));
    const lines = [];
    if (showFib) lines.push(
      { price: ew?.fib382, color: C.teal, title: 'Fib .382' },
      { price: ew?.fib500, color: C.blue, title: 'Fib .500' },
      { price: ew?.fib618, color: C.amber, title: 'Fib .618' },
      { price: ew?.w3Target, color: C.green, title: 'TP' },
    );
    if (showSMC) lines.push(
      { price: smcData?.obBear?.[0], color: C.red, title: 'OB' },
      { price: smcData?.obBull?.[1], color: C.green, title: 'OB' },
      { price: smcData?.liq, color: C.amber, title: 'Liq' },
    );
    priceLinesRef.current = lines
      .filter(line => Number.isFinite(line.price) && line.price > 0)
      .map(line => candle.createPriceLine({ ...line, lineWidth: 1, lineStyle: 2, axisLabelVisible: true }));
  }, [ready, ew, smcData, showFib, showSMC]);

  if (loadError) return <ChartMessage message="Không thể khởi tạo biểu đồ tương tác." />;
  if (isLoading && !data.length) return <ChartMessage message={`Đang tải dữ liệu ${activeTF}...`} loading />;
  if (!data.length) return <ChartMessage message={`Chưa có dữ liệu ${activeTF}.`} />;

  return (
    <div className="lightweight-chart" aria-label="Biểu đồ TradingView tương tác">
      <div ref={hostRef} className="lightweight-chart-host" />
      <div className="chart-status-bar">
        <span>{activeTF} · {data.length} nến</span>
        <span>Kéo để pan · Cuộn/pinch để zoom · Double-click để reset</span>
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts</a>
      </div>
    </div>
  );
}

function ChartMessage({ message, loading = false }) {
  return <div style={{ height: 330, display: 'grid', placeItems: 'center', background: C.bg, border: `1px dashed ${C.grid}`, borderRadius: 7, color: loading ? C.amber : C.muted, fontSize: 10 }}>{loading ? '⟳ ' : '📊 '}{message}</div>;
}
