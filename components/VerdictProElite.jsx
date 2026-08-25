// components/VerdictProElite.jsx — Main component, kết nối tất cả
import { useEffect, useMemo, useState } from 'react';
import { useVerdictEngine } from '../hooks/useVerdictEngine';

// Sub-components (tách riêng file trong thực tế — import ở đây)
import { RegimeCard } from './verdict/RegimeCard';
import { ConvictionMeterCard } from './verdict/ConvictionMeterCard';
import { TradeReadinessCard } from './verdict/TradeReadinessCard';
import { PreEventAlert } from './verdict/PreEventAlert';
import { ScenarioCard } from './verdict/ScenarioCard';
import { EventImpactCard } from './verdict/EventImpactCard';
import { SensitivityMatrixCard } from './verdict/SensitivityMatrixCard';
import { BlackSwanTimelineCard } from './verdict/BlackSwanTimelineCard';
import { CopperIntelCard } from './verdict/CopperIntelCard';
import { SmartNewsCard } from './verdict/SmartNewsCard';
import { PositionSizingCard } from './verdict/PositionSizingCard';
import { SmartMoneyCard } from './verdict/SmartMoneyCard';
import { SeasonalCard } from './verdict/SeasonalCard';

const C = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  blue:'#3b82f6', teal:'#14b8a6', purple:'#8b5cf6',
  cyan:'#06b6d4', muted:'#5a7090', bg:'#060d18', bg2:'#0a1520', grid:'#1e3050',
};

export default function VerdictProElite({ s, ew, vsa, wyckoff, mh, verdict, atr, blackSwans = [] }) {
  const engine = useVerdictEngine({ s, ew, vsa, wyckoff, mh, verdict, atr, blackSwans });

  const {
    rawData, loading, error, refresh,
    regime, conviction, scenarios, copperIntel, scoredNews,
    crossAssetCorr, optionsIntel, readiness, positionSizing,
    smartMoneyDivergence, seasonal,
  } = engine;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sự kiện tiếp theo có impact cao — dùng cho Pre-Event Alert
  const nextHighEvent = useMemo(() => {
    const calendar = rawData?.calendar;
    if (!calendar) return null;
    const events = Array.isArray(calendar.events) ? calendar.events : [];
    const providerEvent = events
      .map(event => {
        const timestamp = Number(event.timestamp);
        if (!Number.isFinite(timestamp)) return null;
        return { ...event, minutesUntil: (timestamp - now) / 60000 };
      })
      .filter(Boolean)
      .filter(e => e.impact === 'high' && e.minutesUntil >= 0 && e.minutesUntil < 180)
      .sort((a, b) => a.minutesUntil - b.minutesUntil)[0];
    if (providerEvent) return providerEvent;
    if (calendar.source !== 'fallback') return null;
    const fallbackEvent = events.find(event => event.impact === 'high' && event.isFallback);
    return fallbackEvent ? { ...fallbackEvent, estimated: true } : null;
  }, [rawData?.calendar, now]);

  return (
    <div style={{ display:'grid', gap:8, width:'100%', boxSizing:'border-box' }}>

      {/* ── TOP BAR ── */}
      <div style={{ background:C.bg, border:`1px solid ${C.grid}`, borderRadius:10, padding:'8px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:7,
              background:`linear-gradient(135deg,${C.cyan},${C.blue})`,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>⚡</div>
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:'#e2e8f0' }}>VERDICT PRO ELITE</div>
              <div style={{ fontSize:9, color:C.muted }}>COMEX HG=F · Tổng hợp tất cả tab · Real-time</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:16 }}>
            <span style={{ fontSize:18, fontWeight:500, color:C.green, fontFamily:'monospace' }}>
              ${(s?.comex || 6.265).toFixed(3)}
            </span>
            <span style={{ fontSize:11, color:C.green }}>▲ {(s?.comex_chg_pct || 2.19).toFixed(2)}%</span>
            {loading && <span style={{ fontSize:10, color:C.amber }}>⟳ đang cập nhật...</span>}
          </div>
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginLeft:'auto' }}>
            <Pill icon="ti-wave-sine" color={C.purple} label={`Xu hướng · pk1=${ew?.score || 0}`} />
            <Pill icon="ti-building-bank" color={C.teal} label={`Nền tảng · pk2=${mh?.pk2Score || 0}`} />
            <Pill icon="ti-refresh" color={C.green} label={rawData ? '2 phút trước' : 'Đang tải'} />
            <button onClick={refresh} style={{
              fontSize:10, padding:'2px 10px', borderRadius:4, cursor:'pointer',
              border:`0.5px solid ${C.grid}`, background:'transparent', color:C.muted,
            }}>↺ Làm mới</button>
          </div>
        </div>
      </div>

      {/* ── PRE-EVENT ALERT (chỉ hiện nếu có sự kiện trong 3h) ── */}
      {nextHighEvent && <PreEventAlert event={nextHighEvent} atr={atr} comex={s?.comex} C={C} />}

      {/* ── ROW A: Regime + Conviction + Readiness ── */}
      <div style={{ display:'grid', gridTemplateColumns:'150px 1fr 1fr', gap:8 }}>
        <RegimeCard regime={regime} C={C} />
        <ConvictionMeterCard conviction={conviction} scenarios={scenarios} C={C} />
        <TradeReadinessCard readiness={readiness} C={C} />
      </div>

      {/* ── ROW B: 3 Kịch bản thị trường ── */}
      <div style={{
        background:C.grid, borderRadius:7, padding:'5px 10px', fontSize:10,
        fontWeight:500, letterSpacing:'.06em', color:C.muted,
        display:'flex', alignItems:'center', gap:5, border:`0.5px solid ${C.grid}`,
      }}>
        📊 3 kịch bản thị trường — dữ liệu thực từ CME · CFTC · FRED · LME · SHFE
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        <ScenarioCard type="bull" data={scenarios?.bull} C={C} />
        <ScenarioCard type="base" data={scenarios?.base} C={C} />
        <ScenarioCard type="bear" data={scenarios?.bear} C={C} />
      </div>

      {/* ── ROW C: Event Impact + Sensitivity Matrix / Black Swan ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <EventImpactCard calendar={rawData?.calendar} comex={s?.comex} atr={atr} C={C} />
        <div style={{ display:'grid', gap:8 }}>
          <SensitivityMatrixCard C={C} />
          <BlackSwanTimelineCard blackSwans={blackSwans} C={C} />
        </div>
      </div>

      {/* ── ROW D: Copper Intel + Smart News + Position Sizing ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
        <CopperIntelCard copperIntel={copperIntel} C={C} />
        <SmartNewsCard news={scoredNews} C={C} />
        <div style={{ display:'grid', gap:8 }}>
          <PositionSizingCard positionSizing={positionSizing} optionsIntel={optionsIntel} C={C} />
        </div>
      </div>

      {/* ── ROW E: TIER 3 — Behavioral & Timing Edge ── */}
      <div style={{
        background:C.grid, borderRadius:7, padding:'5px 10px', fontSize:10,
        fontWeight:500, letterSpacing:'.06em', color:C.muted,
        display:'flex', alignItems:'center', gap:5, border:`0.5px solid ${C.grid}`,
      }}>
        🎯 Tầng 3 — Lợi thế hành vi &amp; timing
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <SmartMoneyCard divergence={smartMoneyDivergence} C={C} />
        <SeasonalCard seasonal={seasonal} C={C} />
      </div>

      {/* Footer */}
      <div style={{ textAlign:'center', fontSize:9, color:C.grid, padding:'4px 0' }}>
        Nguồn miễn phí: CME Group · CFTC · FRED · LME · SHFE · Reuters · Bloomberg · Caixin ·
        Google Trends · Baltic Exchange · NBS China — cập nhật mỗi 5 phút
        {error && <span style={{ color:C.red, marginLeft:8 }}>⚠ {error}</span>}
      </div>
    </div>
  );
}

// ─── Shared Pill component ────────────────────────────────────────────────────
function Pill({ icon, color, label }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:3, fontSize:10, fontWeight:500,
      padding:'2px 8px', borderRadius:4, whiteSpace:'nowrap',
      background:`${color}18`, color, border:`0.5px solid ${color}44`,
    }}>{label}</span>
  );
}