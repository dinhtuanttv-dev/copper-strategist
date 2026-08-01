/**
 * components/CommandCenterTab.jsx (bản 3 — nối pipeline dữ liệu thật)
 * ─────────────────────────────────────────────────────────────
 * Props từ index.js: s, ti, mh, verdict, bias, sigLabel, sigCol,
 * weights, stress, bsEvents, news, loadNews, fetchNews.
 *
 * Radar chu kỳ giá & Session Heatmap giờ đọc useSessionStats():
 *   - dataReady=false (chưa đủ MIN_DAYS ngày dữ liệu) → hiện banner
 *     "đang tích luỹ dữ liệu Xn/7 ngày", KHÔNG hiện số minh hoạ giả
 *     (tránh lặp lại lỗi hiển thị số bịa như NaN trước đó).
 *   - dataReady=true → hiện số thật từ sessionReturns/weekdayReturns.
 */
import { memo, useMemo, useState, useCallback } from 'react';
import { useMarketVerdict } from '../hooks/useMarketVerdict';
import { useSessionStats } from '../hooks/useSessionStats';
import TradingViewWidget from './TradingViewWidget';

function safeNum(v, fallback = 0) { return Number.isFinite(v) ? v : fallback; }

function Card({ children, glow, style = {} }) {
  return (
    <div style={{
      background: 'var(--card)', border: `1px solid ${glow || 'var(--border)'}`,
      borderRadius: 12, padding: '13px 15px',
      boxShadow: glow ? `0 0 20px ${glow}15` : 'none', ...style,
    }}>{children}</div>
  );
}

const ActionBanner = memo(function ActionBanner({ verdict, bias, sigLabel, sigCol, setup }) {
  const [copied, setCopied] = useState(false);
  const finalOk = Number.isFinite(verdict?.final);
  const biasOk = Number.isFinite(bias);

  const handleCopy = useCallback(async () => {
    const text = [
      `COPPER SETUP — ${sigLabel}`,
      `Verdict: ${finalOk ? verdict.final : '—'}/100 · Bias: ${biasOk ? bias : '—'}/100`,
      `Entry: $${setup.comex?.toFixed?.(3) ?? '—'}`,
      `SL: $${setup.sl ?? '—'}  TP1: $${setup.tp1 ?? '—'}  TP2: $${setup.tp2 ?? '—'}`,
    ].join('\n');
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { /* bỏ qua nếu clipboard bị chặn */ }
  }, [verdict, bias, sigLabel, setup, finalOk, biasOk]);

  return (
    <Card glow={sigCol}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: sigCol, marginBottom: 8 }}>{sigLabel}</div>
          {!finalOk && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9, color: 'var(--red,#E5484D)', background: 'rgba(229,72,77,0.12)', borderRadius: 5, padding: '3px 8px', marginBottom: 6 }}>
              ⚠️ Verdict đang lỗi tính toán (NaN) — xem tab Verdict
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 32, fontWeight: 800, color: sigCol, lineHeight: 1 }}>{finalOk ? verdict.final : '—'}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>/100 · Bias {biasOk ? bias : '—'}</span>
          </div>
          <div style={{ background: 'var(--border)', borderRadius: 5, height: 8, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ width: `${finalOk ? Math.max(0, Math.min(100, verdict.final)) : 0}%`, height: '100%', background: sigCol }} />
          </div>
        </div>
        <button onClick={handleCopy} style={{ background: `${sigCol}22`, border: `1px solid ${sigCol}`, color: sigCol, borderRadius: 7, padding: '8px 15px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {copied ? '✅ Đã chép' : '📋 Chép setup lệnh'}
        </button>
      </div>
    </Card>
  );
});

const DriverBreakdown = memo(function DriverBreakdown({ drivers, summary }) {
  if (!drivers?.length) return null;
  return (
    <Card>
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>📊 PHÂN RÃ ĐỘNG LỰC</div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.6 }}>{summary}</div>
      {drivers.map((d) => {
        const bar = d.contribution >= 0 ? '#1D9E75' : '#E5484D';
        return (
          <div key={d.id} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
              <span style={{ color: 'var(--muted)' }}>{d.label}</span>
              <span style={{ color: bar, fontWeight: 700 }}>{d.contribution >= 0 ? '+' : ''}{d.contribution}đ</span>
            </div>
            <div style={{ background: 'var(--border)', borderRadius: 5, height: 6, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.abs(d.contribution) * 4)}%`, height: '100%', background: bar }} />
            </div>
          </div>
        );
      })}
    </Card>
  );
});

const BlackSwanTimeline = memo(function BlackSwanTimeline({ bsEvents }) {
  const sorted = useMemo(() => [...(bsEvents || [])].sort((a, b) => (b.impact || 0) - (a.impact || 0)), [bsEvents]);
  return (
    <Card glow="#BA7517">
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>🦢 BLACK SWAN</div>
      {!sorted.length && <div style={{ fontSize: 10, color: 'var(--muted)' }}>Chưa có dữ liệu.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map((e, i) => {
          const col = e.col || (e.impact > 70 ? '#E5484D' : e.impact > 50 ? '#FF8C42' : '#BA7517');
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${col}12`, border: `1px solid ${col}33`, borderRadius: 8, padding: '7px 10px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: col }}>{e.region}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{e.event}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: col }}>{e.impact}</div>
                <div style={{ fontSize: 8, color: 'var(--muted)', textTransform: 'uppercase' }}>{e.bsType}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
});

const SESSION_LABELS = { asia: 'Châu Á', london: 'London', new_york: 'New York', overlap: 'L-NY overlap' };

// ── Radar chu kỳ giá — dùng dữ liệu thật khi dataReady, fallback rõ nhãn khi chưa đủ ──
const CycleRadar = memo(function CycleRadar({ sessionReturns, dataReady, distinctDays, minDaysRequired }) {
  if (!dataReady) {
    return (
      <Card>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>📈 CHU KỲ GIÁ THEO PHIÊN</div>
        <div style={{ fontSize: 11, color: 'var(--amber,#BA7517)', background: 'rgba(186,117,23,0.12)', borderRadius: 6, padding: '8px 10px' }}>
          ⏳ Đang tích luỹ dữ liệu: {distinctDays}/{minDaysRequired} ngày. Radar sẽ hiện số thật khi đủ dữ liệu.
        </div>
      </Card>
    );
  }
  const entries = Object.entries(sessionReturns);
  return (
    <Card>
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>📈 CHU KỲ GIÁ THEO PHIÊN (dữ liệu thật, {distinctDays} ngày)</div>
      {entries.map(([session, ret]) => (
        <div key={session} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
          <span>{SESSION_LABELS[session] || session}</span>
          <span style={{ color: ret >= 0 ? '#1D9E75' : '#E5484D', fontWeight: 700 }}>{ret >= 0 ? '+' : ''}{ret.toFixed(2)}%</span>
        </div>
      ))}
    </Card>
  );
});

const SensitivityMatrix = memo(function SensitivityMatrix({ scenarios }) {
  return (
    <Card>
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 3 }}>⚗️ STRESS TEST KỊCH BẢN</div>
      <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 8 }}>Minh hoạ — chưa chạy lại pipeline tính điểm thật</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {scenarios.map((sc, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card2)', borderRadius: 8, padding: '8px 10px' }}>
            <span style={{ fontSize: 11 }}>{sc.condition}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: sc.deltaScore >= 0 ? '#1D9E75' : '#E5484D' }}>{sc.deltaScore >= 0 ? '+' : ''}{sc.deltaScore}đ</span>
          </div>
        ))}
      </div>
    </Card>
  );
});

const RiskSizer = memo(function RiskSizer({ comex, sl }) {
  const [balance, setBalance] = useState(20000);
  const riskPct = 0.015;
  const riskDollar = balance * riskPct;
  const slDistanceUsd = Math.abs(safeNum(comex, 6.1) - safeNum(sl, 5.72)) * 25000;
  const contracts = Math.max(1, Math.round(riskDollar / (slDistanceUsd || 1)));
  return (
    <Card>
      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10 }}>💰 QUẢN LÝ RỦI RO</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(90px,1fr))', gap: 8, marginBottom: 12 }}>
        <Metric label="Rủi ro/lệnh" value={`${(riskPct * 100).toFixed(1)}%`} />
        <Metric label="Khối lượng" value={`${contracts} HĐ`} />
        <Metric label="Rủi ro $" value={`$${Math.round(riskDollar).toLocaleString()}`} color="#BA7517" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Vốn tài khoản</label>
        <input type="range" min={1000} max={100000} step={500} value={balance} onChange={(e) => setBalance(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontSize: 11, minWidth: 65, textAlign: 'right' }}>${balance.toLocaleString()}</span>
      </div>
    </Card>
  );
});

function Metric({ label, value, color }) {
  return (
    <div style={{ background: 'var(--card2)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 8, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: color || 'inherit' }}>{value}</div>
    </div>
  );
}

const NewsFilter = memo(function NewsFilter({ news, loadNews, onRefresh }) {
  const allTags = useMemo(() => { const set = new Set(); (news || []).forEach((n) => (n.tags || []).forEach((t) => set.add(t))); return [...set]; }, [news]);
  const [active, setActive] = useState(new Set());
  const toggle = useCallback((tag) => { setActive((prev) => { const next = new Set(prev); next.has(tag) ? next.delete(tag) : next.add(tag); return next; }); }, []);
  const filtered = useMemo(() => { if (active.size === 0) return news || []; return (news || []).filter((n) => n.tags?.some((t) => active.has(t))); }, [news, active]);
  const dirColor = (d) => (d === 'bull' ? '#1D9E75' : d === 'bear' ? '#E5484D' : '#BA7517');
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700 }}>📰 SMART NEWS FILTER</div>
        <button onClick={onRefresh} disabled={loadNews} style={{ fontSize: 9, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: loadNews ? 'default' : 'pointer' }}>
          {loadNews ? '⟳ đang tải...' : '🔄 Cập nhật'}
        </button>
      </div>
      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {allTags.map((t) => (
            <button key={t} onClick={() => toggle(t)} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--border)', cursor: 'pointer', background: active.has(t) ? '#378ADD33' : 'transparent', color: active.has(t) ? '#378ADD' : 'var(--muted)' }}>{t}</button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
        {!filtered.length && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{news?.length ? 'Không có tin phù hợp bộ lọc.' : 'Chưa có tin — bấm Cập nhật.'}</div>}
        {filtered.map((n, i) => (
          <div key={i} style={{ fontSize: 11, background: 'var(--card2)', borderRadius: 8, padding: '7px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
              <span style={{ flex: 1 }}>{n.title}</span>
              <span style={{ color: dirColor(n.direction), flexShrink: 0 }}>{n.direction === 'bull' ? '🟢' : n.direction === 'bear' ? '🔴' : '🟡'}</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--muted)' }}>{n.source} · {n.age}</div>
          </div>
        ))}
      </div>
    </Card>
  );
});

export default function CommandCenterTab({ s, ti, mh, verdict, bias, sigLabel, sigCol, weights, stress, bsEvents, news, loadNews, fetchNews }) {
  const { drivers, summary, confidence } = useMarketVerdict({
    pk1Score: ti?.pk1Score, pk2Score: mh?.pk2Score, dxyChg: s?.dxy_chg,
    fearGreed: s?.fear_greed, blackSwanRisk: stress?.bsRisk, weights,
  });
  const sessionStats = useSessionStats();

  const scenarios = useMemo(() => ([
    { condition: 'DXY vượt 105', deltaScore: -15 },
    { condition: 'Tồn kho LME giảm 5%', deltaScore: 10 },
    { condition: 'FOMC diều hâu bất ngờ', deltaScore: -12 },
  ]), []);

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <ActionBanner verdict={verdict} bias={bias} sigLabel={sigLabel} sigCol={sigCol}
        setup={{ comex: s?.comex, sl: s?.sl, tp1: s?.tp1, tp2: s?.tp2 }} />

      <div style={{ fontSize: 9, color: 'var(--muted)' }}>Độ tin cậy phân rã: {confidence}</div>

      <Card>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>📊 BIỂU ĐỒ GIÁ — TRADINGVIEW</div>
        <TradingViewWidget symbol="COMEX:HG1!" height={360} />
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10 }}>
        <DriverBreakdown drivers={drivers} summary={summary} />
        <BlackSwanTimeline bsEvents={bsEvents} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10 }}>
        <CycleRadar
          sessionReturns={sessionStats.sessionReturns}
          dataReady={sessionStats.dataReady}
          distinctDays={sessionStats.distinctDays}
          minDaysRequired={sessionStats.minDaysRequired}
        />
        <SensitivityMatrix scenarios={scenarios} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10 }}>
        <RiskSizer comex={s?.comex} sl={s?.sl} />
        <NewsFilter news={news} loadNews={loadNews} onRefresh={fetchNews} />
      </div>
    </div>
  );
}
