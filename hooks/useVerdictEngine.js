// hooks/useVerdictEngine.js — Orchestration hook, kết nối data + calculations
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchAllVerdictData } from '../lib/verdictData';
import {
  detectMarketRegime, calcConvictionMeter, calcTradeReadiness,
  build3Scenarios, calcCopperIntelligence, scoreNewsRelevance,
  calcSmartMoneyDivergence, getSeasonalContext, calcOptionsIntelligence,
  calcCrossAssetCorrelation, calcPositionSizing,
} from '../lib/verdictCalculations';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 phút — không tốn phí API, đủ nhanh

export function useVerdictEngine({ s, ew, vsa, wyckoff, mh, verdict, atr, blackSwans }) {
  const [rawData, setRawData]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const pollRef = useRef(null);

  // ── Fetch tất cả nguồn dữ liệu (song song, không block nhau) ──────────────
  const fetchData = useCallback(async (force = false) => {
    if (!force && lastFetch && Date.now() - lastFetch < 30000) return; // debounce 30s
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllVerdictData(s);
      setRawData(data);
      setLastFetch(Date.now());
    } catch (e) {
      setError(e.message);
      console.error('[useVerdictEngine] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [s, lastFetch]);

  // ── Initial fetch + polling ──────────────────────────────────────────────
  useEffect(() => {
    fetchData(true);
    pollRef.current = setInterval(() => fetchData(false), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, []); // chỉ chạy 1 lần khi mount

  // ── Regime Detector ───────────────────────────────────────────────────────
  const regime = useMemo(() => detectMarketRegime({
    dxyChg: s?.dxy_chg, fearGreed: s?.fear_greed, cuGoldRatio: s?.cu_gold_ratio,
  }), [s?.dxy_chg, s?.fear_greed, s?.cu_gold_ratio]);

  // ── Conviction Meter ──────────────────────────────────────────────────────
  const conviction = useMemo(() => calcConvictionMeter({
    ew, vsa, wyckoff, mh,
  }), [ew, vsa, wyckoff, mh]);

  // ── Trade Readiness Checklist ─────────────────────────────────────────────
  const readiness = useMemo(() => calcTradeReadiness({
    verdict, ew, vsa, wyckoff,
    lme: rawData?.lme,
    calendar: rawData?.calendar,
    cot: rawData?.cot,
  }), [verdict, ew, vsa, wyckoff, rawData]);

  // ── 3 Kịch bản thị trường ─────────────────────────────────────────────────
  const scenarios = useMemo(() => build3Scenarios({
    comex: s?.comex, ew, vsa, wyckoff, verdict,
    calendar: rawData?.calendar, blackSwans, atr,
  }), [s?.comex, ew, vsa, wyckoff, verdict, rawData, blackSwans, atr]);

  // ── Copper Intelligence ───────────────────────────────────────────────────
  const copperIntel = useMemo(() => calcCopperIntelligence({
    shanghaiPremium: rawData?.price?.shanghai_premium,
    shfeLmeRatio:    rawData?.price?.shfe_lme_ratio,
    tcRc:            rawData?.price?.tc_rc,
    scrapSpread:     rawData?.price?.scrap_spread,
    googleTrends:    rawData?.trends,
  }), [rawData]);

  // ── Smart News Filter (NLP scoring) ───────────────────────────────────────
  const scoredNews = useMemo(() => {
    const items = rawData?.news?.items || [];
    return items
      .map(item => ({ ...item, ...scoreNewsRelevance(item.title) }))
      .filter(item => item.score >= 4)
      .sort((a, b) => b.score - a.score);
  }, [rawData?.news]);

  // ── TIER 3: Behavioral & Timing Edge ──────────────────────────────────────
  const smartMoneyDivergence = useMemo(() =>
    calcSmartMoneyDivergence(rawData?.cot), [rawData?.cot]);

  const seasonal = useMemo(() =>
    getSeasonalContext(new Date().getMonth() + 1), []);

  const optionsIntel = useMemo(() => calcOptionsIntelligence({
    putCallRatio: rawData?.price?.put_call_ratio,
    ivSkew: rawData?.price?.iv_skew,
    maxPain: rawData?.price?.max_pain,
    gammaExposure: rawData?.price?.gamma_exposure,
  }), [rawData?.price]);

  const crossAssetCorr = useMemo(() =>
    calcCrossAssetCorrelation(), []);

  const positionSizing = useMemo(() => calcPositionSizing({
    winRate: 0.62, // TODO: tính từ trade history khi có
    riskReward: scenarios?.base?.rr || 2.4,
    atr, avgAtr: 0.09,
    portfolioValue: s?.portfolio_value || 14200,
    openCorrelatedPositions: 0, // TODO: từ portfolio state
  }), [scenarios, atr, s?.portfolio_value]);

  return {
    // Data state
    rawData, loading, error, lastFetch,
    refresh: () => fetchData(true),

    // Tier 1: Intelligence
    regime, conviction, scenarios, copperIntel, scoredNews,
    crossAssetCorr, optionsIntel,

    // Tier 2: Risk
    readiness, positionSizing,

    // Tier 3: Behavioral
    smartMoneyDivergence, seasonal,
  };
}

export default useVerdictEngine;