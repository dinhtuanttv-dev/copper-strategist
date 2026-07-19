// hooks/useAnalysisController.js — ESModule export
import { useState, useCallback, useRef, useEffect } from 'react';

const DEFAULT_LAYERS = {
  smc:true, wyckoff:true, fib:true, elliott:true,
  vsa:true, harmonic:false, ai_detection:true,
};

export function useAnalysisController(chartRef) {
  const [logs,    setLogs]    = useState([]);
  const [layers,  setLayers]  = useState(DEFAULT_LAYERS);
  const [imData,  setImData]  = useState(null);
  const [signals, setSignals] = useState([]);

  const addLog = useCallback((message, type = 'info') => {
    setLogs(prev => {
      const entry = { message, type, timestamp: Date.now() };
      // Dedup — không thêm nếu message giống nhau trong 5s
      const recent = prev.slice(-3);
      const dup = recent.find(l =>
        l.message === message && Date.now() - l.timestamp < 5000
      );
      if (dup) return prev;
      return [entry, ...prev].slice(0, 50);
    });
  }, []);

  const toggleLayer = useCallback((key, value) => {
    setLayers(prev => ({ ...prev, [key]: value }));
  }, []);

  const setDrawingTool = useCallback((tool) => {
    if (tool) addLog(`Công cụ vẽ: ${tool}`, 'info');
  }, [addLog]);

  const notifyIMUpdate = useCallback((data) => {
    setImData(data);
    if (data?.signals) {
      const bullish = Object.entries(data.signals || {})
        .filter(([,v]) => v?.col === '#22c55e').map(([k]) => k);
      if (bullish.length > 0) {
        addLog(`IM hỗ trợ: ${bullish.join(', ')}`, 'im_impact');
      }
    }
  }, [addLog]);

  const renderFib    = useCallback(() => {}, []);
  const renderSMC    = useCallback(() => {}, []);
  const renderWyckoff = useCallback(() => {}, []);

  return {
    logs, signals, imData, layers,
    toggleLayer, setDrawingTool,
    notifyIMUpdate, addLog,
    renderFib, renderSMC, renderWyckoff,
  };
}

export default useAnalysisController;