// ─── Data flow: state s + weights → radarData[] cho RadarChart ────────────────
import { useMemo } from 'react';

/**
 * @param {object} s        - global state (comex, rsi_h4, cmex_stocks, tc_rc, mm_long...)
 * @param {number[]} weights - mảng 6 trọng số theo regime
 * @returns {{ radarData, wRaw }}
 */
export function useRadarData(s, weights) {
  const radarData = useMemo(() => [
    {
      label: 'Volume',
      score: Math.min(100, Math.round((s.vol_ma20_ratio || 1.42) * 50)),
    },
    {
      label: 'RSI H4',
      score: s.rsi_h4 || 68,
    },
    {
      label: 'Vật lý',
      score: (s.cmex_stocks || 9500) < 15000 ? 74 : 45,
    },
    {
      label: 'TC/RC',
      score: (s.tc_rc || 4) < 10 ? 70 : 35,
    },
    {
      label: 'COT',
      score: Math.min(99, Math.round(((s.mm_long || 64000) / 80000) * 85)),
    },
    {
      label: 'Liên TT',
      score: 60,
    },
  ], [s.vol_ma20_ratio, s.rsi_h4, s.cmex_stocks, s.tc_rc, s.mm_long]);

  const wRaw = useMemo(
    () => Math.round(radarData.reduce((acc, item, i) => acc + item.score * weights[i], 0)),
    [radarData, weights],
  );

  return { radarData, wRaw };
}