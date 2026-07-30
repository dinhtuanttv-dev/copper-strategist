/**
 * components/CommandCenterTab.jsx
 * ─────────────────────────────────────────────────────────────
 * Tab "Tổng quan" mới. Component này KHÔNG tự fetch bất kỳ dữ liệu nào —
 * toàn bộ nhận qua props từ index.js, đúng 1 nguồn sự thật duy nhất với
 * các tab khác (TrendTab, FundamentalsTab, VerdictProElite).
 *
 * Props cần truyền từ index.js (xem hướng dẫn tích hợp cuối file):
 *   s, ti, mh, verdict, bias, sigLabel, sigCol, weights, stress,
 *   news, loadNews, fetchNews
 */
import { memo, useMemo, useState, useCallback } from 'react';
import { useMarketVerdict } from '../hooks/useMarketVerdict';

const COLORS = {
  green: '#1D9E75', red: '#E5484D', amber: '#BA7517', blue: '#378ADD',
  muted: 'var(--muted, #8B95A5)', card: 'var(--card, #131924)',
  card2: 'var(--card2, #1a212e)', border: 'var(--border, #232b3a)',
};

// ── Action banner ────────────────────────────────────────────────────
const ActionBanner = memo(function ActionBanner({ verdict, bias, sigLabel, sigCol, setup }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = [
      `COPPER SETUP — ${sigLabel}`,
      `Verdict: ${verdict?.final ?? '—'}/100 · Bias: ${bias ?? '—'}/100`,
      `Entry: $${setup.comex?.toFixed?.(3) ?? '—'}`,
      `SL: $${setup.sl ?? '—'}  TP1: $${setup.tp1 ?? '—'}  TP2: $${setup.tp2 ?? '—'}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard bị chặn trong 1 số môi trường — bỏ qua an toàn */ }
  }, [verdict, bias, sigLabel, setup]);

  return (
    <div style={{
      background: `${sigCol}18`, border: `2px solid ${sigCol}55`, borderRadius: 12,
      padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: sigCol }}>{sigLabel}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: sigCol }}>{verdict?.final ?? '—'}</span>
          <span style={{ fontSize: 12, color: COLORS.muted }}>/100 · Bias {bias ?? '—'}</span>
          <div style={{ flex: 1, minWidth: 60, height: 7, background: '#00000030', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${verdict?.final ?? 0}%`, height: '100%', background: sigCol }} />
          </div>
        </div>
      </div>
      <button
        onClick={handleCopy}
        style={{
          background: sigCol, color: '#08111a', border: 'none', borderRadius: 8,
          padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        {copied ? 'Đã chép ✓' : '📋 Chép setup lệnh'}
      </button>
    </div>
  );
});

// ── Driver breakdown ─────────────────────────────────────────────────
const DriverBreakdown = memo(function DriverBreakdown({ drivers, summary }) {
  if (!drivers?.length) return null;
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 8 }}>Phân rã động lực</div>
      <div style={{ fontSize: 11, color: 'var(--text, inherit)', marginBottom: 10, lineHeight: 1.6 }}>{summary}</div>
      {drivers.map((d) => {
        const barColor = d.contribution >= 0 ? COLORS.green : COLORS.red;
        return (
          <div key={d.id} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
              <span>{d.label}</span>
              <span style={{ color: barColor, fontWeight: 700 }}>
                {d.contribution >= 0 ? '+' : ''}{d.contribution}đ
              </span>
            </div>
            <div style={{ height: 6, background: '#00000030', borderRadius: 3 }}>
              <div style={{
                width: `${Math.min(100, Math.abs(d.contribution) * 4)}%`,
                height: '100%', background: barColor, borderRadius: 3,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
});

// ── Stress test kịch bản (minh hoạ — xem ghi chú cuối file) ─────────
const SensitivityMatrix = memo(function SensitivityMatrix({ scenarios }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 4 }}>Stress test kịch bản</div>
      <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 8 }}>Minh hoạ — chưa chạy lại pipeline tính điểm thật</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {scenarios.map((sc, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#00000020', borderRadius: 8, padding: '8px 10px',
          }}>
            <span style={{ fontSize: 12 }}>{sc.condition}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: sc.deltaScore >= 0 ? COLORS.green : COLORS.red }}>
              {sc.deltaScore >= 0 ? '+' : ''}{sc.deltaScore}đ
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

// ── Risk sizer — dùng SL/TP thật từ state s ──────────────────────────
const RiskSizer = memo(function RiskSizer({ comex, sl }) {
  const [balance, setBalance] = useState(20000);
  const riskPct = 0.015;
  const riskDollar = balance * riskPct;
  const slDistanceUsd = Math.abs((comex ?? 6.1) - (sl ?? 5.72)) * 25000; // 25,000 lb/hợp đồng COMEX
  const contracts = Math.max(1, Math.round(riskDollar / (slDistanceUsd || 1)));

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 10 }}>Quản lý rủi ro & kích thước vị thế</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 8, marginBottom: 12 }}>
        <Metric label="Rủi ro/lệnh" value={`${(riskPct * 100).toFixed(1)}%`} />
        <Metric label="Khối lượng" value={`${contracts} HĐ`} />
        <Metric label="Rủi ro $" value={`$${Math.round(riskDollar).toLocaleString()}`} color={COLORS.amber} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{ fontSize: 12, color: COLORS.muted, whiteSpace: 'nowrap' }}>Vốn tài khoản</label>
        <input
          type="range" min={1000} max={100000} step={500} value={balance}
          onChange={(e) => setBalance(Number(e.target.value))}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: 12, minWidth: 70, textAlign: 'right' }}>${balance.toLocaleString()}</span>
      </div>
    </div>
  );
});

function Metric({ label, value, color }) {
  return (
    <div style={{ background: '#00000020', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, color: COLORS.muted }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: color || 'inherit' }}>{value}</div>
    </div>
  );
}

// ── News filter — khớp đúng shape thật của /api/news.js ──────────────
// item: { score, title, source, age, tags:['Supply','Urgent',...], direction:'bull'|'bear'|'neutral' }
const NewsFilter = memo(function NewsFilter({ news, loadNews, onRefresh }) {
  const allTags = useMemo(() => {
    const set = new Set();
    (news || []).forEach((n) => (n.tags || []).forEach((t) => set.add(t)));
    return [...set];
  }, [news]);

  const [active, setActive] = useState(new Set());

  const toggle = useCallback((tag) => {
    setActive((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    if (active.size === 0) return news || [];
    return (news || []).filter((n) => n.tags?.some((t) => active.has(t)));
  }, [news, active]);

  const dirColor = (d) => (d === 'bull' ? COLORS.green : d === 'bear' ? COLORS.red : COLORS.amber);

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: COLORS.muted }}>Smart news filter</div>
        <button onClick={onRefresh} disabled={loadNews} style={{
          fontSize: 10, padding: '3px 10px', borderRadius: 6, border: `1px solid ${COLORS.border}`,
          background: 'transparent', color: COLORS.muted, cursor: loadNews ? 'default' : 'pointer',
        }}>
          {loadNews ? '⟳ đang tải...' : '🔄 Cập nhật'}
        </button>
      </div>

      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => toggle(t)}
              style={{
                fontSize: 11, padding: '4px 12px', borderRadius: 999,
                border: `1px solid ${COLORS.border}`, cursor: 'pointer',
                background: active.has(t) ? `${COLORS.blue}33` : 'transparent',
                color: active.has(t) ? COLORS.blue : COLORS.muted,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
        {!filtered.length && (
          <div style={{ fontSize: 12, color: COLORS.muted }}>
            {news?.length ? 'Không có tin phù hợp bộ lọc.' : 'Chưa có tin — bấm Cập nhật.'}
          </div>
        )}
        {filtered.map((n, i) => (
          <div key={i} style={{ fontSize: 12, background: '#00000020', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
              <span style={{ flex: 1 }}>{n.title}</span>
              <span style={{ color: dirColor(n.direction), fontWeight: 700, flexShrink: 0 }}>
                {n.direction === 'bull' ? '🟢' : n.direction === 'bear' ? '🔴' : '🟡'}
              </span>
            </div>
            <div style={{ fontSize: 10, color: COLORS.muted }}>{n.source} · {n.age}</div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ── Main component ──────────────────────────────────────────────────
export default function CommandCenterTab({
  s, ti, mh, verdict, bias, sigLabel, sigCol, weights, stress,
  news, loadNews, fetchNews,
}) {
  const { drivers, summary, confidence } = useMarketVerdict({
    pk1Score: ti?.pk1Score,
    pk2Score: mh?.pk2Score,
    dxyChg: s?.dxy_chg,
    fearGreed: s?.fear_greed,
    blackSwanRisk: stress?.bsRisk,
    weights,
  });

  const scenarios = useMemo(() => ([
    { condition: 'DXY vượt 105', deltaScore: -15 },
    { condition: 'Tồn kho LME giảm 5%', deltaScore: 10 },
    { condition: 'FOMC diều hâu bất ngờ', deltaScore: -12 },
  ]), []);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <ActionBanner
        verdict={verdict} bias={bias} sigLabel={sigLabel} sigCol={sigCol}
        setup={{ comex: s?.comex, sl: s?.sl, tp1: s?.tp1, tp2: s?.tp2 }}
      />

      <div style={{ fontSize: 10, color: COLORS.muted }}>Độ tin cậy phân rã: {confidence}</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
        <DriverBreakdown drivers={drivers} summary={summary} />
        <SensitivityMatrix scenarios={scenarios} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
        <RiskSizer comex={s?.comex} sl={s?.sl} />
        <NewsFilter news={news} loadNews={loadNews} onRefresh={fetchNews} />
      </div>
    </div>
  );
}
