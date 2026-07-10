// ─── React hook wrapping AnalysisController ────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react';
import { AnalysisController } from '../analysis-controller';

export function useAnalysisController(chartContainerRef) {
  const ctrlRef  = useRef(null);
  const [logs,    setLogs]    = useState([]);
  const [signals, setSignals] = useState([]);
  const [imData,  setIMData]  = useState(null);
  const [layers,  setLayers]  = useState({
    smc:true, wyckoff:true, fib:true, elliott:true,
    vsa:true, harmonic:false, ai_detection:true,
  });

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const tryInit = () => {
      if (!window.LightweightCharts) { setTimeout(tryInit, 300); return; }
      ctrlRef.current = new AnalysisController(
        chartContainerRef.current,
        entry  => setLogs(prev  => [entry,  ...prev].slice(0, 100)),
        signal => setSignals(prev => [signal, ...prev].slice(0, 30)),
        (layer, active, batch) => {
          if (batch) setLayers(prev => ({ ...prev, ...batch }));
          else if (layer) setLayers(prev => ({ ...prev, [layer]: active }));
        },
        data => setIMData(data),
      );
    };
    tryInit();
    return () => { ctrlRef.current?.destroy(); ctrlRef.current = null; };
  }, []);

  const setData        = useCallback((bars, state) => ctrlRef.current?.setData(bars, state), []);
  const toggleLayer    = useCallback((l, a)        => ctrlRef.current?.toggleLayer(l, a), []);
  const setDrawingTool = useCallback(tool           => ctrlRef.current?.setDrawingTool(tool), []);
  const notifyIMUpdate = useCallback(data           => ctrlRef.current?.notifyIMUpdate(data), []);
  const renderSMC      = useCallback((p, a)         => ctrlRef.current?.renderSMCLayer(p, a), []);
  const renderFib      = useCallback(ew             => ctrlRef.current?.renderFibLayer(ew), []);
  const renderWyckoff  = useCallback(bars           => ctrlRef.current?.renderWyckoffMarkers(bars), []);

  return {
    controller: ctrlRef,
    logs, signals, imData, layers,
    setData, toggleLayer, setDrawingTool,
    notifyIMUpdate, renderSMC, renderFib, renderWyckoff,
  };
}