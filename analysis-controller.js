// ════════════════════════════════════════════════════════════════════════════
// COPPER STRATEGIST — Analysis Controller v2
// EventBus 2-chiều: Drawing → AI → Chart → Log
// ════════════════════════════════════════════════════════════════════════════

// ─── 1. EventBus ─────────────────────────────────────────────────────────────
class EventBus {
  constructor() { this._listeners = {}; }

  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(h => h !== handler);
  }

  emit(event, payload) {
    (this._listeners[event] || []).forEach(h => {
      try { h(payload); } catch(e) { console.error(`[EventBus] "${event}":`, e); }
    });
  }
}

// ─── Event constants ──────────────────────────────────────────────────────────
export const EVENTS = {
  // Drawing lifecycle
  DRAWING_STARTED:      'drawing:started',     // user bắt đầu vẽ
  DRAWING_CONFIRMED:    'drawing:confirmed',   // user hoàn thành vẽ
  DRAWING_UPDATED:      'drawing:updated',
  DRAWING_DELETED:      'drawing:deleted',

  // Chart commands
  CHART_SET_DATA:       'chart:setData',
  CHART_RENDER_LAYER:   'chart:renderLayer',
  CHART_CLEAR_LAYER:    'chart:clearLayer',
  CHART_ADD_MARKER:     'chart:addMarker',
  CHART_CLEAR_MARKERS:  'chart:clearMarkers',
  AI_MARKER_RENDER:     'chart:aiMarkerRender', // AI → Chart

  // AI commands
  AI_ANALYZE_DRAWING:   'ai:analyzeDrawing',
  AI_ANALYZE_ZONE:      'ai:analyzeZone',
  AI_REFRESH_SIGNALS:   'ai:refreshSignals',

  // AI results
  AI_RESULT_READY:      'ai:resultReady',
  AI_SIGNAL_EMITTED:    'ai:signalEmitted',
  AI_LOG_ENTRY:         'ai:logEntry',

  // IM Heatmap
  IM_DATA_UPDATED:      'im:dataUpdated',

  // UI state
  TOGGLE_CHANGED:       'ui:toggleChanged',
  LAYER_TOGGLE_BATCH:   'ui:layerToggleBatch',
  DATA_UPDATED:         'data:updated',
};

// ════════════════════════════════════════════════════════════════════════════
// 2. ChartManager — vẽ thuần túy, không logic AI
// ════════════════════════════════════════════════════════════════════════════
export class ChartManager {
  constructor(container, bus) {
    this._bus       = bus;
    this._container = container;
    this._chart     = null;
    this._series    = {};
    this._layers    = {};
    this._markers   = [];
    this._unsubAll  = [];

    // Drawing state
    this._drawingTool    = null;
    this._drawingActive  = false;
    this._drawStart      = null;
    this._tempDrawing    = null;

    this._initChart();
    this._bindEvents();
  }

  // ── Init Lightweight Charts ────────────────────────────────────────────────
  _initChart() {
    const lwc = window.LightweightCharts;
    if (!lwc || !this._container) return;

    this._chart = lwc.createChart(this._container, {
      layout: {
        background: { type:'solid', color:'#060d18' },
        textColor:  '#5a7090',
        fontSize:   10,
      },
      grid: {
        vertLines: { color:'#0f1e30' },
        horzLines: { color:'#0f1e30' },
      },
      crosshair: {
        mode:     1,
        vertLine: { color:'#1e3a5f', labelBackgroundColor:'#1e3a5f' },
        horzLine: { color:'#1e3a5f', labelBackgroundColor:'#1e3a5f' },
      },
      rightPriceScale: { borderColor:'#0f1e30' },
      timeScale: {
        borderColor: '#0f1e30',
        timeVisible: true,
        fixRightEdge:true,
      },
      width:  this._container.clientWidth || 600,
      height: 320,
    });

    // Candle series
    this._series.candle = this._chart.addCandlestickSeries({
      upColor:          '#22c55e',
      downColor:        '#ef4444',
      borderUpColor:    '#22c55e',
      borderDownColor:  '#ef4444',
      wickUpColor:      '#22c55e88',
      wickDownColor:    '#ef444488',
      priceLineVisible: false,
    });

    // Volume histogram
    this._series.volume = this._chart.addHistogramSeries({
      priceFormat:    { type:'volume' },
      priceScaleId:   'vol',
      color:          '#3b82f620',
      priceLineVisible: false,
    });
    this._chart.priceScale('vol').applyOptions({
      scaleMargins: { top:0.82, bottom:0 },
    });

    // Resize observer
    this._ro = new ResizeObserver(entries => {
      for (const e of entries)
        this._chart?.applyOptions({ width: e.contentRect.width });
    });
    this._ro.observe(this._container);

    // Mouse events cho drawing
    this._bindMouseEvents();
  }

  // ── Mouse events → Drawing coords ─────────────────────────────────────────
  _bindMouseEvents() {
    if (!this._container) return;

    this._container.addEventListener('mousedown', e => {
      if (!this._drawingTool) return;
      this._drawingActive = true;
      const rect  = this._container.getBoundingClientRect();
      const x     = e.clientX - rect.left;
      const y     = e.clientY - rect.top;
      const coord = this._chart?.timeScale().coordinateToTime(x);
      const price = this._series.candle?.coordinateToPrice(y);
      this._drawStart = { time:coord, price, x, y };
      this._bus.emit(EVENTS.DRAWING_STARTED, {
        tool:  this._drawingTool,
        start: this._drawStart,
      });
    });

    this._container.addEventListener('mouseup', e => {
      if (!this._drawingActive || !this._drawStart) return;
      this._drawingActive = false;
      const rect  = this._container.getBoundingClientRect();
      const x     = e.clientX - rect.left;
      const y     = e.clientY - rect.top;
      const coord = this._chart?.timeScale().coordinateToTime(x);
      const price = this._series.candle?.coordinateToPrice(y);
      const end   = { time:coord, price, x, y };

      // Emit completed drawing
      this._bus.emit(EVENTS.DRAWING_CONFIRMED, {
        tool: this._drawingTool,
        start: this._drawStart,
        end,
        priceRange: {
          from: Math.min(this._drawStart.price||0, price||0),
          to:   Math.max(this._drawStart.price||0, price||0),
        },
        timeRange: {
          from: this._drawStart.time,
          to:   coord,
        },
      });
      this._drawStart = null;
    });
  }

  // ── Bind EventBus events ───────────────────────────────────────────────────
  _bindEvents() {
    const unsubs = [
      this._bus.on(EVENTS.CHART_SET_DATA,     ({ bars })          => this._setData(bars)),
      this._bus.on(EVENTS.CHART_RENDER_LAYER, ({ layer, items })  => this._renderLayer(layer, items)),
      this._bus.on(EVENTS.CHART_CLEAR_LAYER,  ({ layer })         => this._clearLayer(layer)),
      this._bus.on(EVENTS.CHART_ADD_MARKER,   ({ markers })       => this._addMarkers(markers)),
      this._bus.on(EVENTS.CHART_CLEAR_MARKERS,()                  => this._clearAllMarkers()),
      this._bus.on(EVENTS.AI_MARKER_RENDER,   (data)              => this._renderAIMarker(data)),
    ];
    this._unsubAll.push(...unsubs);
  }

  // ── Set OHLCV data ─────────────────────────────────────────────────────────
  _setData(bars) {
    if (!this._series.candle || !bars?.length) return;
    const candles = bars
      .filter(b => b.ts && b.comex)
      .map(b => ({
        time:  Math.floor(b.ts / 1000),
        open:  b.open  || b.comex,
        high:  b.high  || b.comex * 1.005,
        low:   b.low   || b.comex * 0.995,
        close: b.comex,
      }))
      .sort((a, b) => a.time - b.time);

    const volumes = bars
      .filter(b => b.ts)
      .map(b => ({
        time:  Math.floor(b.ts / 1000),
        value: b.vol || 0,
        color: (b.comex >= (b.open || b.comex)) ? '#22c55e22' : '#ef444422',
      }))
      .sort((a, b) => a.time - b.time);

    this._series.candle.setData(candles);
    this._series.volume.setData(volumes);
    this._chart?.timeScale().scrollToRealTime();
  }

  // ── Render overlay layer ───────────────────────────────────────────────────
  _renderLayer(layer, items) {
    this._clearLayer(layer);
    this._layers[layer] = [];
    items.forEach(item => {
      if (item.type === 'priceline') {
        const pl = this._series.candle.createPriceLine({
          price:            item.price,
          color:            item.color || '#5a7090',
          lineWidth:        item.width || 1,
          lineStyle:        item.style || 2,
          axisLabelVisible: item.label !== false,
          title:            item.title || '',
        });
        this._layers[layer].push({ kind:'priceline', ref:pl });
      }
    });
  }

  _clearLayer(layer) {
    (this._layers[layer] || []).forEach(item => {
      if (item.kind === 'priceline') {
        try { this._series.candle.removePriceLine(item.ref); } catch {}
      }
    });
    this._layers[layer] = [];
  }

  // ── Markers ────────────────────────────────────────────────────────────────
  _addMarkers(newMarkers) {
    if (!this._series.candle) return;
    this._markers = [...this._markers, ...newMarkers]
      .sort((a, b) => a.time - b.time);
    try { this._series.candle.setMarkers(this._markers); } catch {}
  }

  _clearAllMarkers() {
    this._markers = [];
    try { this._series.candle.setMarkers([]); } catch {}
  }

  // ── AI Marker Render (từ AIEngine qua EventBus) ────────────────────────────
  _renderAIMarker({ type, price, time, confidence, label, color }) {
    const isBuy   = type === 'buy' || type === 'demand';
    const markerColor = color || (isBuy ? '#22c55e' : '#ef4444');
    const ts      = time || Math.floor(Date.now() / 1000);

    // Marker pin trên chart
    this._addMarkers([{
      time:     ts,
      position: isBuy ? 'belowBar' : 'aboveBar',
      color:    markerColor,
      shape:    isBuy ? 'arrowUp' : 'arrowDown',
      text:     `${label || (isBuy ? 'AI Buy' : 'AI Sell')} · ${confidence || '?'}%`,
    }]);

    // Price line tại mức AI confirm
    if (price) {
      const pl = this._series.candle.createPriceLine({
        price,
        color:            markerColor + '88',
        lineWidth:        1,
        lineStyle:        3,
        axisLabelVisible: true,
        title:            `AI ${isBuy ? 'Demand' : 'Supply'} · ${confidence}%`,
      });
      if (!this._layers.ai_markers) this._layers.ai_markers = [];
      this._layers.ai_markers.push({ kind:'priceline', ref:pl });
    }
  }

  // ── Drawing tool control ───────────────────────────────────────────────────
  setDrawingTool(tool) {
    this._drawingTool   = tool;
    this._drawingActive = false;
    if (this._container) {
      this._container.style.cursor = tool ? 'crosshair' : 'default';
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  destroy() {
    this._unsubAll.forEach(fn => fn());
    this._ro?.disconnect();
    this._chart?.remove();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 3. DrawingManager
// ════════════════════════════════════════════════════════════════════════════
export class DrawingManager {
  constructor(bus) {
    this._bus      = bus;
    this._drawings = {};
    this._counter  = 0;
    this._unsubAll = [];

    this._bindEvents();
  }

  _bindEvents() {
    // Lắng nghe drawing confirmed từ ChartManager
    const unsub = this._bus.on(EVENTS.DRAWING_CONFIRMED, (data) => {
      this._registerDrawing(data);
    });
    this._unsubAll.push(unsub);
  }

  _registerDrawing({ tool, start, end, priceRange, timeRange }) {
    const id = `drawing_${++this._counter}_${Date.now()}`;
    const drawing = {
      id,
      type:        tool,    // 'trendline' | 'rectangle' | 'fibonacci'
      priceRange,
      timeRange,
      start,
      end,
      createdAt:   Date.now(),
    };
    this._drawings[id] = drawing;
    return id;
  }

  addDrawing(type, priceRange, timeRange, metadata = {}) {
    const id = `drawing_${++this._counter}_${Date.now()}`;
    const drawing = { id, type, priceRange, timeRange, metadata, createdAt:Date.now() };
    this._drawings[id] = drawing;
    this._bus.emit(EVENTS.DRAWING_CONFIRMED, { tool:type, priceRange, timeRange, drawing });
    return id;
  }

  deleteDrawing(id) {
    const drawing = this._drawings[id];
    if (!drawing) return;
    delete this._drawings[id];
    this._bus.emit(EVENTS.DRAWING_DELETED, { id, drawing });
  }

  getAll() { return Object.values(this._drawings); }
  clearAll() { Object.keys(this._drawings).forEach(id => this.deleteDrawing(id)); }

  destroy() {
    this._unsubAll.forEach(fn => fn());
    this.clearAll();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 4. AIEngine — phân tích, emit kết quả vào Log + Chart
// ════════════════════════════════════════════════════════════════════════════
export class AIEngine {
  constructor(bus, analysisState = {}) {
    this._bus      = bus;
    this._state    = analysisState;
    this._queue    = [];
    this._busy     = false;
    this._unsubAll = [];
    this._bindEvents();
  }

  updateState(newState) {
    this._state = { ...this._state, ...newState };
  }

  _bindEvents() {
    const unsubs = [
      // Khi user bắt đầu vẽ → log ngay "đang phân tích"
      this._bus.on(EVENTS.DRAWING_STARTED, ({ tool }) => {
        this._log(
          `User Drawing Detected (${tool}). AI analyzing confluence...`,
          'analyzing'
        );
      }),

      // Khi vẽ xong → phân tích đầy đủ
      this._bus.on(EVENTS.AI_ANALYZE_DRAWING, ({ drawing }) => {
        this._enqueue(() => this._analyzeDrawing(drawing));
      }),

      // Zone analysis
      this._bus.on(EVENTS.AI_ANALYZE_ZONE, ({ zone }) => {
        this._enqueue(() => this._analyzeZone(zone));
      }),

      // Refresh toàn bộ
      this._bus.on(EVENTS.AI_REFRESH_SIGNALS, () => {
        this._enqueue(() => this._refreshAllSignals());
      }),

      // IM data → AI đánh giá tác động
      this._bus.on(EVENTS.IM_DATA_UPDATED, (imData) => {
        this._evaluateIMImpact(imData);
      }),
    ];
    this._unsubAll.push(...unsubs);
  }

  // ── Queue ──────────────────────────────────────────────────────────────────
  _enqueue(task) {
    this._queue.push(task);
    if (!this._busy) this._processQueue();
  }

  async _processQueue() {
    if (!this._queue.length) { this._busy = false; return; }
    this._busy = true;
    const task = this._queue.shift();
    try { await task(); } catch(e) { console.error('[AIEngine]', e); }
    this._processQueue();
  }

  // ── Log helper ─────────────────────────────────────────────────────────────
  _log(message, type = 'info', metadata = {}) {
    this._bus.emit(EVENTS.AI_LOG_ENTRY, {
      timestamp: Date.now(),
      message,
      type,       // 'info'|'analyzing'|'signal_buy'|'signal_sell'|'confirm'|'warn'|'im_impact'
      metadata,
    });
  }

  // ── Phân tích drawing ──────────────────────────────────────────────────────
  async _analyzeDrawing(drawing) {
    const { ew, vsa, wyckoff, activeTF } = this._state;
    const cu   = this._state.currentPrice || 6.07;
    const from = drawing.priceRange?.from || cu;
    const to   = drawing.priceRange?.to   || cu;

    const prompts = {
      rectangle: `User vẽ ${drawing.type} zone từ $${from.toFixed(3)} đến $${to.toFixed(3)}.
Bối cảnh: COMEX $${cu.toFixed(3)} | Elliott ${ew?.label||'W?'} | VSA ${vsa?.meta?.short||'N/A'} | Wyckoff ${wyckoff?.label||'?'} | TF ${activeTF}.
Hãy xác nhận đây là Demand Zone hay Supply Zone, độ tin cậy %, và hành động.
Trả lời ONLY JSON: {"type":"demand|supply","confidence":<int>,"action":"<string>","reason":"<Vietnamese>","refined_from":<float>,"refined_to":<float>}`,

      trendline: `User vẽ Trendline từ $${from.toFixed(3)} đến $${to.toFixed(3)} trên TF ${activeTF}.
Elliott ${ew?.label||'W?'} | VSA ${vsa?.meta?.short||'N/A'}.
Xác nhận là Support hay Resistance, độ tin cậy.
Trả lời ONLY JSON: {"type":"support|resistance","confidence":<int>,"break_level":<float>,"action":"<Vietnamese>"}`,

      fibonacci: `User đánh dấu Fib zone $${from.toFixed(3)}–$${to.toFixed(3)} TF ${activeTF}.
Wyckoff ${wyckoff?.sub||'?'} | Elliott W${ew?.wave||'?'}.
Trả lời ONLY JSON: {"is_prz":<bool>,"confidence":<int>,"nearest_fib":"<string>","action":"<Vietnamese>"}`,
    };

    const prompt = prompts[drawing.type] || prompts.rectangle;

    try {
      const result = await this._callClaude(prompt);
      if (!result) return;

      this._bus.emit(EVENTS.AI_RESULT_READY, {
        source:    'drawing_analysis',
        drawingId: drawing.id,
        result,
      });

      const isBuy      = result.type==='demand' || result.type==='support';
      const confidence = result.confidence || 0;
      const sigType    = isBuy ? 'signal_buy' : 'signal_sell';
      const emoji      = isBuy ? '🟢' : '🔴';

      // Emit marker về Chart qua EventBus
      if (confidence >= 60) {
        this._bus.emit(EVENTS.AI_MARKER_RENDER, {
          type:       isBuy ? 'buy' : 'sell',
          price:      result.refined_from || from,
          time:       Math.floor(Date.now() / 1000),
          confidence: result.confidence,
          label:      result.type?.toUpperCase(),
          color:      isBuy ? '#22c55e' : '#ef4444',
        });

        this._bus.emit(EVENTS.AI_SIGNAL_EMITTED, {
          type:    sigType,
          price:   from,
          confidence,
          action:  result.action,
          drawingId: drawing.id,
        });
      }

      // Log entry
      const logType = confidence >= 70 ? sigType : 'info';
      this._log(
        `${emoji} ${result.type?.toUpperCase()} Zone · $${from.toFixed(3)}–$${to.toFixed(3)} · Confirmed by VSA ${vsa?.meta?.short||''} & Elliott ${ew?.label||''} · ${confidence}%`,
        logType,
        { result, drawing }
      );

      if (result.action) {
        this._log(`→ ${result.action}`, 'info');
      }

    } catch(e) {
      this._log(`❌ Lỗi phân tích: ${e.message}`, 'warn');
    }
  }

  // ── Zone analysis ──────────────────────────────────────────────────────────
  async _analyzeZone({ priceFrom, priceTo, zoneType }) {
    const { ew, vsa, activeTF } = this._state;
    const cu = this._state.currentPrice || 6.07;

    const prompt = `SMC phát hiện ${zoneType} zone $${priceFrom.toFixed(3)}–$${priceTo.toFixed(3)}.
COMEX $${cu.toFixed(3)} | Elliott ${ew?.label||'?'} | VSA ${vsa?.meta?.short||'?'} | TF ${activeTF}.
Trả lời ONLY JSON: {"strength":<int>,"confirmed":<bool>,"refined_from":<float>,"refined_to":<float>,"note":"<Vietnamese>"}`;

    try {
      const result = await this._callClaude(prompt);
      if (!result) return;

      if (result.confirmed && result.strength >= 65) {
        this._bus.emit(EVENTS.AI_MARKER_RENDER, {
          type:       zoneType === 'Supply' ? 'sell' : 'buy',
          price:      result.refined_from || priceFrom,
          time:       Math.floor(Date.now() / 1000),
          confidence: result.strength,
          label:      `AI ${zoneType}`,
          color:      zoneType === 'Supply' ? '#ef4444' : '#22c55e',
        });

        this._log(
          `✅ ${zoneType} Zone Confirmed · $${(result.refined_from||priceFrom).toFixed(3)}–$${(result.refined_to||priceTo).toFixed(3)} · Strength ${result.strength}%`,
          'confirm',
          { result }
        );
        if (result.note) this._log(`→ ${result.note}`, 'info');
      }
    } catch(e) {
      this._log(`❌ Zone error: ${e.message}`, 'warn');
    }
  }

  // ── Refresh all signals ────────────────────────────────────────────────────
  async _refreshAllSignals() {
    const { ew, vsa, wyckoff, activeTF } = this._state;
    const cu = this._state.currentPrice || 6.07;
    this._log(`⟳ Quét tín hiệu ${activeTF}...`, 'analyzing');

    const prompt = `Phân tích COMEX Copper ${activeTF}: $${cu.toFixed(3)} | Elliott ${ew?.label||'?'} | VSA ${vsa?.meta?.label||'?'} | Wyckoff ${wyckoff?.label||'?'}.
Liệt kê 3 tín hiệu quan trọng nhất.
Trả lời ONLY JSON array: [{"signal":"<Vietnamese>","type":"buy|sell|watch","price":<float>,"confidence":<int>}]`;

    try {
      const results = await this._callClaude(prompt, true);
      if (!Array.isArray(results)) return;
      results.forEach(r => {
        const e = r.type==='buy'?'🟢':r.type==='sell'?'🔴':'🟡';
        const t = r.type==='buy'?'signal_buy':r.type==='sell'?'signal_sell':'info';
        this._log(`${e} ${r.signal} · $${r.price?.toFixed(3)||'–'} · ${r.confidence}%`, t, r);
      });
    } catch(e) {
      this._log(`❌ Refresh error: ${e.message}`, 'warn');
    }
  }

  // ── IM Impact evaluation ───────────────────────────────────────────────────
  _evaluateIMImpact(imData) {
    const assets  = imData?.assets || {};
    const signals = imData?.signals || {};
    const impacts = [];

    // DXY impact
    const dxy = assets.DXY;
    if (dxy?.chg > 0.3) {
      impacts.push(`⚠️ DXY +${dxy.chg.toFixed(1)}% → áp lực giảm Cu (tương quan -0.75)`);
    } else if (dxy?.chg < -0.3) {
      impacts.push(`✅ DXY ${dxy.chg.toFixed(1)}% → hỗ trợ tăng Cu`);
    }

    // CN50 impact (TQ stocks)
    const cn50 = assets.CN50;
    if (cn50?.chg > 0.5) {
      impacts.push(`✅ Shanghai +${cn50.chg.toFixed(1)}% → cầu TQ tăng → Cu tăng`);
    } else if (cn50?.chg < -0.5) {
      impacts.push(`⚠️ Shanghai ${cn50.chg.toFixed(1)}% → cầu TQ giảm`);
    }

    // SHFE Copper
    const shfe = assets.SHFE;
    if (shfe?.chg > 0.5) {
      impacts.push(`✅ SHFE Cu +${shfe.chg.toFixed(1)}% → leading indicator bullish`);
    } else if (shfe?.chg < -0.5) {
      impacts.push(`⚠️ SHFE Cu ${shfe.chg.toFixed(1)}% → leading indicator bearish`);
    }

    // XAG, PLAT cross-signal
    const xag  = assets.XAG;
    const plat = assets.PLAT;
    if (xag?.chg > 0 && plat?.chg > 0) {
      impacts.push(`✅ XAG + PLAT đồng thuận tăng → industrial metals bullish`);
    }

    // Emit tất cả IM impacts vào log
    impacts.forEach(msg => this._log(msg, 'im_impact'));
  }

  // ── Claude API call ────────────────────────────────────────────────────────
  async _callClaude(prompt, expectArray = false) {
    const r = await fetch('/api/claude', {
      method:  'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5',
        max_tokens: 400,
        messages:   [{ role:'user', content:prompt }],
      }),
    });
    if (!r.ok) throw new Error(`Claude HTTP ${r.status}`);
    const d    = await r.json();
    const text = (d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    const pat  = expectArray ? /\[[\s\S]*?\]/ : /\{[\s\S]*?\}/;
    const m    = text.match(pat);
    return m ? JSON.parse(m[0]) : null;
  }

  destroy() {
    this._unsubAll.forEach(fn => fn());
    this._queue = [];
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 5. AnalysisController — điều phối tất cả
// ════════════════════════════════════════════════════════════════════════════
export class AnalysisController {
  constructor(chartContainer, onLogUpdate, onSignalUpdate, onToggleLayer, onIMUpdate) {
    this._bus     = new EventBus();
    this._chart   = new ChartManager(chartContainer, this._bus);
    this._drawing = new DrawingManager(this._bus);
    this._ai      = new AIEngine(this._bus, {});

    this._onLogUpdate    = onLogUpdate    || (() => {});
    this._onSignalUpdate = onSignalUpdate || (() => {});
    this._onToggleLayer  = onToggleLayer  || (() => {});
    this._onIMUpdate     = onIMUpdate     || (() => {});

    this._activeLayers = {
      smc:true, wyckoff:true, fib:true, elliott:true, vsa:true, harmonic:false,
      ai_detection:true,
    };

    this._bindControllerEvents();
  }

  _bindControllerEvents() {
    // Drawing confirmed → AI analyze
    this._bus.on(EVENTS.DRAWING_CONFIRMED, ({ tool, priceRange, timeRange }) => {
      if (!this._activeLayers.ai_detection) return;
      this._bus.emit(EVENTS.AI_ANALYZE_DRAWING, {
        drawing: { id:`d_${Date.now()}`, type:tool, priceRange, timeRange },
      });
    });

    // AI result → Chart (AI_MARKER_RENDER handled by ChartManager directly)
    this._bus.on(EVENTS.AI_RESULT_READY, ({ source, result }) => {
      if (source === 'zone_analysis' && result?.confirmed && result?.refined_from) {
        const isBuy = result.zoneType !== 'Supply';
        const items = [
          { type:'priceline', price:result.refined_from, color:isBuy?'#22c55e77':'#ef444477', title:'AI Top', style:2 },
          { type:'priceline', price:result.refined_to,   color:isBuy?'#22c55e55':'#ef444455', title:'AI Bot', style:3 },
        ];
        this._bus.emit(EVENTS.CHART_RENDER_LAYER, { layer:'ai_refined', items });
      }
    });

    // AI signal → React state
    this._bus.on(EVENTS.AI_SIGNAL_EMITTED, s => this._onSignalUpdate(s));

    // AI log → React state
    this._bus.on(EVENTS.AI_LOG_ENTRY, entry => this._onLogUpdate(entry));

    // Toggle → Chart layers
    this._bus.on(EVENTS.TOGGLE_CHANGED, ({ layer, active }) => {
      this._activeLayers[layer] = active;
      if (!active) this._bus.emit(EVENTS.CHART_CLEAR_LAYER, { layer });
      this._onToggleLayer(layer, active);
    });

    // Batch toggle
    this._bus.on(EVENTS.LAYER_TOGGLE_BATCH, ({ layers }) => {
      Object.entries(layers).forEach(([layer, active]) => {
        this._activeLayers[layer] = active;
        if (!active) this._bus.emit(EVENTS.CHART_CLEAR_LAYER, { layer });
      });
      this._onToggleLayer(null, null, layers);
    });

    // Data updated
    this._bus.on(EVENTS.DATA_UPDATED, ({ bars, analysisState }) => {
      this._bus.emit(EVENTS.CHART_SET_DATA, { bars });
      this._ai.updateState({
        ...analysisState,
        currentPrice: bars?.[bars.length-1]?.comex,
      });
      if (this._activeLayers.ai_detection) {
        setTimeout(() => this._bus.emit(EVENTS.AI_REFRESH_SIGNALS, {}), 500);
      }
    });

    // IM data updated
    this._bus.on(EVENTS.IM_DATA_UPDATED, data => {
      this._onIMUpdate(data);
    });
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  setData(bars, analysisState) {
    this._bus.emit(EVENTS.DATA_UPDATED, { bars, analysisState });
  }

  toggleLayer(layer, active) {
    this._bus.emit(EVENTS.TOGGLE_CHANGED, { layer, active });
  }

  toggleBatch(layers) {
    this._bus.emit(EVENTS.LAYER_TOGGLE_BATCH, { layers });
  }

  setDrawingTool(tool) {
    this._chart.setDrawingTool(tool);
  }

  addUserDrawing(type, priceRange, timeRange, meta = {}) {
    return this._drawing.addDrawing(type, priceRange, timeRange, meta);
  }

  deleteDrawing(id) {
    this._drawing.deleteDrawing(id);
  }

  notifyIMUpdate(imData) {
    this._bus.emit(EVENTS.IM_DATA_UPDATED, imData);
  }

  renderSMCLayer(currentPrice, atr = 0.12) {
    if (!this._activeLayers.smc) return;
    const items = [
      { type:'priceline', price:currentPrice+atr*1.8, color:'#ef444488', title:'OB Giảm Top' },
      { type:'priceline', price:currentPrice+atr*1.0, color:'#ef444466', title:'OB Giảm Bot', style:3 },
      { type:'priceline', price:currentPrice-atr*1.0, color:'#22c55e66', title:'OB Tăng Top', style:3 },
      { type:'priceline', price:currentPrice-atr*2.0, color:'#22c55e88', title:'OB Tăng Bot' },
      { type:'priceline', price:currentPrice-atr*2.5, color:'#f59e0b77', title:'Liquidity', style:2 },
    ];
    this._bus.emit(EVENTS.CHART_RENDER_LAYER, { layer:'smc', items });
    if (this._activeLayers.ai_detection) {
      this._bus.emit(EVENTS.AI_ANALYZE_ZONE, {
        zone: { priceFrom:currentPrice+atr*1.0, priceTo:currentPrice+atr*1.8, zoneType:'Supply' },
      });
    }
  }

  renderFibLayer(ew) {
    if (!this._activeLayers.fib || !ew) return;
    const items = [
      { type:'priceline', price:ew.fib382, color:'#14b8a677', title:'Fib 0.382' },
      { type:'priceline', price:ew.fib500, color:'#3b82f677', title:'Fib 0.500' },
      { type:'priceline', price:ew.fib618, color:'#f59e0b77', title:'Fib 0.618' },
      { type:'priceline', price:ew.fib786, color:'#ef444477', title:'Fib 0.786' },
    ].filter(i => i.price > 0);
    this._bus.emit(EVENTS.CHART_RENDER_LAYER, { layer:'fib', items });
  }

  renderWyckoffMarkers(vsaBars) {
    if (!this._activeLayers.wyckoff || !vsaBars?.length) return;
    const colorMap = {
      SPRING:'#22c55e', UPTHRUST:'#ef4444',
      STOPPING_VOLUME:'#f59e0b', ABSORPTION_BULL:'#14b8a6', ABSORPTION_BEAR:'#f97316',
    };
    const labelMap = { SPRING:'Spring', UPTHRUST:'UT', STOPPING_VOLUME:'SV',
      ABSORPTION_BULL:'AB↑', ABSORPTION_BEAR:'AB↓' };
    const markers = vsaBars
      .filter(b => b.ts && colorMap[b.vsa])
      .map(b => ({
        time:     Math.floor(b.ts / 1000),
        position: ['SPRING','ABSORPTION_BULL'].includes(b.vsa) ? 'belowBar' : 'aboveBar',
        color:    colorMap[b.vsa],
        shape:    ['SPRING','UPTHRUST'].includes(b.vsa) ? 'arrowUp' : 'circle',
        text:     labelMap[b.vsa],
      }));
    if (markers.length)
      this._bus.emit(EVENTS.CHART_ADD_MARKER, { markers });
  }

  destroy() {
    this._chart.destroy();
    this._drawing.destroy();
    this._ai.destroy();
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 6. useAnalysisController — React hook
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useCallback } from 'react';

export function useAnalysisController(chartContainerRef) {
  const ctrlRef  = useRef(null);
  const [logs,    setLogs]    = useState([]);
  const [signals, setSignals] = useState([]);
  const [imData,  setIMData]  = useState(null);
  const [layers,  setLayers]  = useState({
    smc:true, wyckoff:true, fib:true, elliott:true, vsa:true,
    harmonic:false, ai_detection:true,
  });

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const tryInit = () => {
      if (!window.LightweightCharts) { setTimeout(tryInit, 200); return; }
      ctrlRef.current = new AnalysisController(
        chartContainerRef.current,
        entry   => setLogs(prev => [entry, ...prev].slice(0, 100)),
        signal  => setSignals(prev => [signal, ...prev].slice(0, 30)),
        (layer, active, batch) => {
          if (batch) setLayers(prev => ({ ...prev, ...batch }));
          else if (layer) setLayers(prev => ({ ...prev, [layer]: active }));
        },
        data    => setIMData(data),
      );
    };
    tryInit();
    return () => { ctrlRef.current?.destroy(); ctrlRef.current = null; };
  }, []);

  const setData = useCallback((bars, state) => {
    ctrlRef.current?.setData(bars, state);
  }, []);

  const toggleLayer = useCallback((layer, active) => {
    ctrlRef.current?.toggleLayer(layer, active);
  }, []);

  const setDrawingTool = useCallback(tool => {
    ctrlRef.current?.setDrawingTool(tool);
  }, []);

  const notifyIMUpdate = useCallback(data => {
    ctrlRef.current?.notifyIMUpdate(data);
  }, []);

  const renderSMC = useCallback((price, atr) => {
    ctrlRef.current?.renderSMCLayer(price, atr);
  }, []);

  const renderFib = useCallback(ew => {
    ctrlRef.current?.renderFibLayer(ew);
  }, []);

  const renderWyckoff = useCallback(vsaBars => {
    ctrlRef.current?.renderWyckoffMarkers(vsaBars);
  }, []);

  return {
    controller: ctrlRef,
    logs, signals, imData, layers,
    setData, toggleLayer, setDrawingTool,
    notifyIMUpdate, renderSMC, renderFib, renderWyckoff,
  };
}