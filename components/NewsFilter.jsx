/**
 * components/NewsFilter.jsx — bản premium, tách riêng khỏi CommandCenterTab
 * ─────────────────────────────────────────────────────────────
 * NÂNG CẤP THIẾT KẾ (so với bản list phẳng cũ):
 *   - Card viền rõ, hover nổi nhẹ
 *   - Badge chiều hướng màu (xanh/đỏ/vàng) thay vì chấm tròn đơn sắc
 *   - Thanh độ liên quan (score/10) khi mở rộng
 *   - Phân tích AI + link "Đọc bài gốc" khi bấm mở rộng
 *   - Tag pill lọc theo chủ đề (dùng tags đã chuẩn hoá thành mảng từ API)
 *
 * Props: news (mảng), loadNews (bool), onRefresh (fn)
 * Không đổi props/interface — dùng thay thế 100% component NewsFilter cũ
 * trong CommandCenterTab.jsx, chỉ cần import và bỏ định nghĩa inline cũ.
 */
import { memo, useMemo, useState, useCallback } from 'react';
import { useNewsDetail } from '../hooks/useNewsDetail';

const DIR_META = {
  bull: { color: '#1D9E75', bg: 'rgba(29,158,117,0.12)', icon: '▲', label: 'Tích cực' },
  bear: { color: '#E5484D', bg: 'rgba(229,72,77,0.12)', icon: '▼', label: 'Tiêu cực' },
  neutral: { color: '#BA7517', bg: 'rgba(186,117,23,0.12)', icon: '●', label: 'Trung lập' },
};

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--card, #131924)', border: '1px solid var(--border, #232b3a)',
      borderRadius: 12, padding: '13px 15px', ...style,
    }}>{children}</div>
  );
}

export default memo(function NewsFilter({ news, loadNews, onRefresh }) {
  const allTags = useMemo(() => {
    const set = new Set();
    (news || []).forEach((n) => (Array.isArray(n.tags) ? n.tags : []).forEach((t) => set.add(t)));
    return [...set];
  }, [news]);

  const [active, setActive] = useState(new Set());
  const [expanded, setExpanded] = useState(null);
  const { details, fetchDetail } = useNewsDetail();

  const toggleTag = useCallback((tag) => {
    setActive((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const list = news || [];
    if (active.size === 0) return list;
    return list.filter((n) => Array.isArray(n.tags) && n.tags.some((t) => active.has(t)));
  }, [news, active]);

  const handleExpand = useCallback((title) => {
    setExpanded((prev) => (prev === title ? null : title));
    fetchDetail(title);
  }, [fetchDetail]);

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>📰 SMART NEWS FILTER</div>
        <button onClick={onRefresh} disabled={loadNews} style={{
          fontSize: 10, padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border, #232b3a)',
          background: loadNews ? 'transparent' : 'rgba(55,138,221,0.12)',
          color: loadNews ? 'var(--muted, #8B95A5)' : '#378ADD',
          cursor: loadNews ? 'default' : 'pointer', fontWeight: 600,
        }}>
          {loadNews ? '⟳ Đang tải...' : '🔄 Cập nhật'}
        </button>
      </div>

      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {allTags.map((t) => (
            <button key={t} onClick={() => toggleTag(t)} style={{
              fontSize: 10, padding: '4px 12px', borderRadius: 999,
              border: `1px solid ${active.has(t) ? '#378ADD' : 'var(--border, #232b3a)'}`,
              background: active.has(t) ? 'rgba(55,138,221,0.18)' : 'transparent',
              color: active.has(t) ? '#378ADD' : 'var(--muted, #8B95A5)',
              cursor: 'pointer', fontWeight: 600,
            }}>{t}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
        {!filtered.length && (
          <div style={{ fontSize: 11, color: 'var(--muted, #8B95A5)', padding: '12px 0', textAlign: 'center' }}>
            {news?.length ? 'Không có tin phù hợp bộ lọc.' : 'Chưa có tin — bấm Cập nhật.'}
          </div>
        )}

        {filtered.map((n, i) => {
          const isOpen = expanded === n.title;
          const detail = details[n.title];
          const dir = DIR_META[n.direction] || DIR_META.neutral;
          const confidencePct = Math.round(Math.min(10, Math.max(0, n.score || 0)) * 10);

          return (
            <div key={i} style={{
              background: 'var(--card2, #1a212e)', borderRadius: 10,
              border: `1px solid ${isOpen ? dir.color + '55' : 'var(--border, #232b3a)'}`,
              padding: '11px 13px', transition: 'border-color .15s ease',
            }}>
              <div
                onClick={() => handleExpand(n.title)}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}
              >
                <span style={{
                  flexShrink: 0, marginTop: 2, fontSize: 11, fontWeight: 700, color: dir.color,
                  background: dir.bg, borderRadius: 6, padding: '2px 6px', minWidth: 20, textAlign: 'center',
                }}>{dir.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.4, color: 'var(--text, #E8ECF1)' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted, #8B95A5)', marginTop: 4 }}>
                    {n.source} · {n.age}
                  </div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 10, color: 'var(--muted, #8B95A5)', marginTop: 2 }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </div>

              {isOpen && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border, #232b3a)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 9, color: 'var(--muted, #8B95A5)', whiteSpace: 'nowrap' }}>Độ liên quan</span>
                    <div style={{ flex: 1, height: 5, background: 'var(--border, #232b3a)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${confidencePct}%`, height: '100%', background: '#378ADD' }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#378ADD', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {n.score?.toFixed(1)}/10
                    </span>
                  </div>

                  {detail?.loading && (
                    <div style={{ fontSize: 10, color: 'var(--muted, #8B95A5)' }}>⟳ Đang phân tích...</div>
                  )}
                  {detail?.analysis && (
                    <>
                      <div style={{ fontSize: 9, color: 'var(--muted, #8B95A5)', marginBottom: 4 }}>
                        Phân tích AI (1 nguồn — Gemini){detail.fromCache ? ' · từ cache' : ''}
                      </div>
                      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text, #E8ECF1)' }}>
                        {detail.analysis}
                      </div>
                    </>
                  )}
                  {detail?.error && (
                    <div style={{ fontSize: 10, color: '#E5484D' }}>Không phân tích được: {detail.error}</div>
                  )}

                  {n.link && (
                    <a href={n.link} target="_blank" rel="noopener noreferrer" style={{
                      display: 'inline-block', marginTop: 8, fontSize: 10, color: '#378ADD', textDecoration: 'none',
                    }}>
                      Đọc bài gốc ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
});
