// ─── TVChart v4 — Multi-CDN fallback + npm fallback + zero crash ──────────────
import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Danh sách CDN fallback theo thứ tự ưu tiên ──────────────────────────────
const CDN_URLS = [
  'https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js',
  'https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js',
  'https://cdnjs.cloudflare.com/ajax/libs/lightweight-charts/4.1.3/lightweight-charts.standalone.production.js',
];

// ─── Load CDN script với timeout per URL ──────────────────────────────────────
function loadScript(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    // Nếu đã load xong thì resolve ngay
    if (window.LightweightCharts) { resolve(window.LightweightCharts); return; }

    const existing = document.getElementById('lwc-script');
    if (existing) {
      // Script đang load, poll cho đến khi xong
      let tries = 0;
      const id = setInterval(() => {
        if (window.LightweightCharts) { clearInterval(id); resolve(window.LightweightCharts); }
        else if (++tries > 40) { clearInterval(id); reject(new Error(`Timeout waiting: ${url}`)); }
      }, 200);
      return;
    }

    const s   = document.createElement('script');
    s.id      = 'lwc-script';
    s.src     = url;
    s.async   = true;

    const timer = setTimeout(() => {
      s.remove();
      reject(new Error(`CDN timeout: ${url}`));
    }, timeoutMs);

    s.onload = () => {
      clearTimeout(timer);
      if (window.LightweightCharts) resolve(window.LightweightCharts);
      else reject(new Error(`LWC not found after load: ${url}`));
    };

    s.onerror = () => {
      clearTimeout(timer);
      s.remove();
      reject(new Error(`CDN error: ${url}`));
    };

    document.head.appendChild(s);
  });
}

// ─── Thử từng CDN theo thứ tự, fallback npm nếu tất cả fail ─────────────────
async function waitForLWC() {
  // Đã có sẵn
  if (window.LightweightCharts) return window.LightweightCharts;

  // Xoá script cũ nếu có để retry sạch
  const old = document.getElementById('lwc-script');
  if (old) old.remove();

  // Thử từng CDN
  for (const url of CDN_URLS) {
    try {
      console.log('[TVChart] Trying CDN:', url);
      const lwc = await loadScript(url, 8000);
      console.log('[TVChart] CDN loaded:', url);
      return lwc;
    } catch(e) {
      console.warn('[TVChart] CDN failed:', e.message);
      // Xoá script để thử CDN tiếp theo
      const s = document.getElementById('lwc-script');
      if (s) s.remove();
    }
  }

  // Fallback: thử import npm package (nếu đã cài)
  try {
    const mod = await import('lightweight-charts');
    if (mod?.createChart) {
      // Wrap để tương thích với CDN API
      window.LightweightCharts = mod;
      console.log('[TVChart] Loaded from npm package');
      return mod;
    }
  } catch(e) {
    console.warn('[TVChart] npm fallback failed:', e.message);
  }

  throw new Error('LightweightCharts: tất cả CDN và npm đều thất bại');
}

// ─── Dark theme ───────────────────────────────────────────────────────────────
const DARK = {
  layout:  { background:{ type:'solid', color:'#060d18' }, textColor:'#5a7090', fontSize:10 },
  grid:    { vertLines:{ color:'#0f1e30' }, horzLines:{ color:'#0f1e30' } },
  crosshair: {
    mode:1,
    vertLine:{ color:'#1e3a5f', labelBackgroundColor:'#1e3a5f' },
    horzLine:{ color:'#1e3a5f', labelBackgroundColor:'#1e3a5f' },
  },
  rightPriceScale: { borderColor:'#0f1e30' },
  timeScale: {
    borderColor:'#0f1e30', timeVisible:true,
    fixRightEdge:true, barSpacing:8,
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TVChart({
  bars          = [],
  activeTF      = 'H4',
  ew            = null,
  vsa           = null,
  smcData       = null,
  showFib       = true,
  showSMC       = true,
  showWyckoff   = true,
  showVolume    = true,
  isLoading     = false,
  onCrosshair   = null,
  chartContainerRef = null,
}) {
  const internalRef  = useRef(null);
  const containerRef = chartContainerRef || internalRef;

  const chartRef      = useRef(null);
  const candleRef     = useRef(null);
  const volumeRef     = useRef(null);
  const priceLinesRef = useRef([]);
  const markersRef    = useRef([]);
  const initDoneRef   = useRef(false);
  const roRef         = useRef(null);

  // status: 'idle' | 'loading' | 'ready' | 'error'
  const [lwcStatus,   setLwcStatus]   = useState('idle');
  const [errorMsg,    setErrorMsg]    = useState('');
  const [retryCount,  setRetryCount]  = useState(0);

  // ── Init chart ─────────────────────────────────────────────────────────────
  const initChart = useCallback(async () => {
    if (initDoneRef.current) return;
    if (!containerRef.current) return;

    initDoneRef.current = true;
    setLwcStatus('loading');
    setErrorMsg('');

    try {
      const lwc = await waitForLWC();

      if (!containerRef.current) return; // unmounted trong lúc chờ

      const chart = lwc.createChart(containerRef.current, {
        ...DARK,
        width:  containerRef.current.clientWidth  || 600,
        height: 280,
        handleScroll: { mouseWheel:true, pressedMouseMove:true },
        handleScale:  { axisPressedMouseMove:true, mouseWheel:true },
      });
      chartRef.current = chart;

      // Candle series
      const candle = chart.addCandlestickSeries({
        upColor:'#22c55e', downColor:'#ef4444',
        borderUpColor:'#22c55e', borderDownColor:'#ef4444',
        wickUpColor:'#22c55e88', wickDownColor:'#ef444488',
        priceLineVisible:false, lastValueVisible:true,
      });
      candleRef.current = candle;

      // Volume histogram
      const vol = chart.addHistogramSeries({
        priceFormat:{ type:'volume' },
        priceScaleId:'vol',
        color:'#3b82f620',
        priceLineVisible:false,
      });
      chart.priceScale('vol').applyOptions({
        scaleMargins:{ top:0.82, bottom:0 },
        drawTicks:false, borderVisible:false,
      });
      volumeRef.current = vol;

      // Crosshair
      if (onCrosshair) {
        chart.subscribeCrosshairMove(param => {
          if (!param?.point) return;
          const d = param.seriesData?.get(candle);
          if (d) onCrosshair(d);
        });
      }

      // ResizeObserver
      roRef.current = new ResizeObserver(entries => {
        for (const e of entries)
          chartRef.current?.applyOptions({ width: e.contentRect.width });
      });
      roRef.current.observe(containerRef.current);

      setLwcStatus('ready');

    } catch(err) {
      console.error('[TVChart] init error:', err);
      setLwcStatus('error');
      setErrorMsg(err.message || 'Không load được biểu đồ');
      initDoneRef.current = false; // cho phép retry
    }
  }, [onCrosshair]);

  // ── Mount / Unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    initChart();
    return () => {
      roRef.current?.disconnect();
      if (chartRef.current) {
        try { chartRef.current.remove(); } catch {}
        chartRef.current  = null;
        candleRef.current = null;
        volumeRef.current = null;
      }
      initDoneRef.current = false;
    };
  }, []); // run once

  // ── Retry khi user click ───────────────────────────────────────────────────
  const handleRetry = () => {
    setRetryCount(n => n + 1);
    // Xoá script cũ để reload CDN
    const s = document.getElementById('lwc-script');
    if (s) s.remove();
    initDoneRef.current = false;
    initChart();
  };

  // ── Update candle data ─────────────────────────────────────────────────────
  useEffect(() => {
    const candle = candleRef.current;
    const vol    = volumeRef.current;
    if (!candle || !vol || !bars.length) return;

    const cd = bars
      .filter(b => b.ts && b.comex)
      .map(b => ({
        time:  Math.floor(b.ts / 1000),
        open:  +(b.open  || b.comex).toFixed(4),
        high:  +(b.high  || b.comex * 1.005).toFixed(4),
        low:   +(b.low   || b.comex * 0.995).toFixed(4),
        close: +b.comex.toFixed(4),
      }))
      .sort((a,b) => a.time - b.time)
      .filter((v,i,a) => i===0 || v.time !== a[i-1].time);

    const vd = bars
      .filter(b => b.ts && b.comex)
      .map(b => ({
        time:  Math.floor(b.ts / 1000),
        value: b.vol || 0,
        color: (b.comex >= (b.open||b.comex)) ? '#22c55e22' : '#ef444422',
      }))
      .sort((a,b) => a.time - b.time)
      .filter((v,i,a) => i===0 || v.time !== a[i-1].time);

    try {
      if (cd.length > 0) {
        candle.setData(cd);
        if (showVolume) vol.setData(vd);
        chartRef.current?.timeScale().scrollToRealTime();
      }
    } catch(e) { console.warn('[TVChart] setData:', e.message); }
  }, [bars, showVolume]);

  // ── Clear price lines ──────────────────────────────────────────────────────
  const clearPriceLines = useCallback(() => {
    const candle = candleRef.current;
    if (!candle) return;
    priceLinesRef.current.forEach(pl => { try { candle.removePriceLine(pl); } catch {} });
    priceLinesRef.current = [];
  }, []);

  // ── Overlays: Fib + SMC ────────────────────────────────────────────────────
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle || lwcStatus !== 'ready') return;
    clearPriceLines();
    const lines = [];

    if (showFib && ew) {
      [
        { price:ew.fib382,   color:'#14b8a677', title:'Fib 0.382' },
        { price:ew.fib500,   color:'#3b82f677', title:'Fib 0.500' },
        { price:ew.fib618,   color:'#f59e0b88', title:'Fib 0.618 SL' },
        { price:ew.fib786,   color:'#ef444488', title:'Fib 0.786 SL=' },
        { price:ew.w3Target, color:'#22c55e88', title:'W3 TP' },
      ].filter(l => l.price > 0).forEach(l => {
        try {
          lines.push(candle.createPriceLine({
            price:l.price, color:l.color, lineWidth:1,
            lineStyle:2, axisLabelVisible:true, title:l.title,
          }));
        } catch {}
      });
    }

    if (showSMC && smcData) {
      [
        { price:smcData.obBear?.[0], color:'#ef444466', title:'OB Giảm Top' },
        { price:smcData.obBear?.[1], color:'#ef444433', title:'OB Giảm Bot', style:3 },
        { price:smcData.obBull?.[0], color:'#22c55e33', title:'OB Tăng Top', style:3 },
        { price:smcData.obBull?.[1], color:'#22c55e66', title:'OB Tăng Bot' },
        { price:smcData.liq,         color:'#f59e0b55', title:'Liquidity' },
      ].filter(l => l.price > 0).forEach(l => {
        try {
          lines.push(candle.createPriceLine({
            price:l.price, color:l.color, lineWidth:1,
            lineStyle:l.style||2, axisLabelVisible:true, title:l.title,
          }));
        } catch {}
      });
    }

    priceLinesRef.current = lines;
  }, [showFib, showSMC, ew, smcData, lwcStatus, clearPriceLines]);

  // ── Wyckoff markers ────────────────────────────────────────────────────────
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle || lwcStatus !== 'ready') return;

    if (!showWyckoff || !vsa?.bars?.length) {
      try { candle.setMarkers([]); markersRef.current = []; } catch {}
      return;
    }

    const colorMap = {
      SPRING:'#22c55e', UPTHRUST:'#ef4444',
      STOPPING_VOLUME:'#f59e0b', ABSORPTION_BULL:'#14b8a6',
      ABSORPTION_BEAR:'#f97316', NO_SUPPLY:'#22c55e', NO_DEMAND:'#ef4444',
    };
    const labelMap = {
      SPRING:'Spring', UPTHRUST:'UT', STOPPING_VOLUME:'SV',
      ABSORPTION_BULL:'AB↑', ABSORPTION_BEAR:'AB↓',
      NO_SUPPLY:'NS', NO_DEMAND:'ND',
    };

    const markers = vsa.bars
      .filter(b => b.ts && colorMap[b.vsa])
      .map(b => ({
        time:     Math.floor(b.ts / 1000),
        position: ['SPRING','ABSORPTION_BULL','NO_SUPPLY'].includes(b.vsa)
          ? 'belowBar' : 'aboveBar',
        color:    colorMap[b.vsa],
        shape:    ['SPRING','UPTHRUST'].includes(b.vsa) ? 'arrowUp' : 'circle',
        text:     labelMap[b.vsa] || b.vsa,
      }))
      .sort((a,b) => a.time - b.time);

    try {
      markersRef.current = markers;
      candle.setMarkers(markers);
    } catch {}
  }, [showWyckoff, vsa, lwcStatus]);

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position:'relative', width:'100%' }}>

      {/* Chart mount point */}
      <div
        ref={containerRef}
        style={{
          width:'100%', height:280,
          borderRadius:7, overflow:'hidden',
          background:'#060d18', display:'block',
          // Ẩn khi đang error để overlay hiện đúng
          visibility: lwcStatus==='error' ? 'hidden' : 'visible',
        }}
      />

      {/* Loading overlay */}
      {(isLoading || lwcStatus==='loading') && (
        <div style={{
          position:'absolute', inset:0,
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'#060d18dd', borderRadius:7, pointerEvents:'none',
        }}>
          <div style={{ color:'#5a7090', fontSize:11, textAlign:'center' }}>
            <div style={{ fontSize:24, marginBottom:8,
              animation:'spin 1s linear infinite', display:'inline-block' }}>
              ⟳
            </div>
            <div>
              {lwcStatus==='loading'
                ? 'Đang tải TradingView Charts...'
                : `Đang tải dữ liệu ${activeTF}...`}
            </div>
            <div style={{ fontSize:9, marginTop:4, color:'#3b82f6' }}>
              Thử CDN: unpkg → jsdelivr → cdnjs
            </div>
          </div>
        </div>
      )}

      {/* No data overlay */}
      {!isLoading && lwcStatus==='ready' && bars.length < 3 && (
        <div style={{
          position:'absolute', inset:0,
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          background:'#060d18cc', borderRadius:7, gap:8, pointerEvents:'none',
        }}>
          <span style={{ fontSize:24 }}>📊</span>
          <div style={{ color:'#5a7090', fontSize:10 }}>
            Chưa đủ dữ liệu {activeTF} ({bars.length}/5 bars)
          </div>
        </div>
      )}

      {/* Error overlay với Retry button */}
      {lwcStatus==='error' && (
        <div style={{
          position:'absolute', inset:0,
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center',
          background:'#060d18', borderRadius:7, gap:10,
          border:'1px solid #ef444433',
        }}>
          <span style={{ fontSize:28 }}>⚠️</span>
          <div style={{ color:'#ef4444', fontSize:11, fontWeight:600 }}>
            Không load được TradingView Charts
          </div>
          <div style={{ color:'#5a7090', fontSize:9, textAlign:'center',
            maxWidth:260, lineHeight:1.6 }}>
            {errorMsg || 'CDN timeout'}<br/>
            Kiểm tra kết nối internet hoặc thử lại.
          </div>
          <button onClick={handleRetry} style={{
            padding:'7px 18px', borderRadius:7, cursor:'pointer',
            background:'#3b82f618', border:'1px solid #3b82f6',
            color:'#3b82f6', fontSize:10, fontWeight:600,
          }}>
            🔄 Thử lại ({retryCount > 0 ? `lần ${retryCount+1}` : 'lần 1'})
          </button>
          <div style={{ fontSize:8, color:'#5a7090' }}>
            Hoặc cài npm: <code style={{ color:'#f59e0b' }}>npm i lightweight-charts</code>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}