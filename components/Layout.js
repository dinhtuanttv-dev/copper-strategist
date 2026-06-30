import { useState, useEffect } from 'react';
import { getSession, getHunting, isOverlap } from '../lib/calculations';

// ─── Live Clock (fix hydration) ────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!now) {
    return (
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:18, fontWeight:800, color:'var(--cyan)',
          fontFamily:'var(--font-mono)', letterSpacing:2 }}>--:--:--</div>
        <div style={{ fontSize:9, color:'var(--muted)' }}>Đang tải...</div>
      </div>
    );
  }

  return (
    <div style={{ textAlign:'right' }}>
      <div style={{ fontSize:18, fontWeight:800, color:'var(--cyan)',
        fontFamily:'var(--font-mono)', letterSpacing:2 }}>
        {String(now.getHours()).padStart(2,'0')}:
        {String(now.getMinutes()).padStart(2,'0')}:
        {String(now.getSeconds()).padStart(2,'0')}
      </div>
      <div style={{ fontSize:9, color:'var(--muted)' }}>
        {now.toLocaleDateString('vi-VN', {
          weekday:'short', day:'2-digit', month:'2-digit', year:'numeric'
        })} · ICT
      </div>
    </div>
  );
}

// ─── Price Ticker ─────────────────────────────────────────────────────────────
function PriceTicker({ priceData }) {
  const up = (priceData?.comex_chg_pct || 0) >= 0;
  const items = [
    { label:'COMEX', value: priceData?.comex ? `$${priceData.comex.toFixed(3)}` : '–––',
      chg: priceData?.comex_chg_pct, col: up ? 'var(--green)' : 'var(--red)' },
    { label:'DXY',   value: priceData?.dxy   ? `${priceData.dxy}` : '–',      col:'var(--muted)' },
    { label:'LME',   value: priceData?.lme   ? `$${(priceData.lme/1000).toFixed(1)}k` : '–', col:'var(--blue)' },
    { label:'Cu/Au', value: priceData?.cu_gold_ratio ? `${priceData.cu_gold_ratio}` : '–', col:'var(--amber)' },
  ];
  return (
    <div style={{ background:'var(--card)', borderBottom:'1px solid var(--border)',
      padding:'5px 16px', display:'flex', gap:20, alignItems:'center', overflowX:'auto' }}>
      {items.map((item, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:5,
          fontSize:10, whiteSpace:'nowrap' }}>
          <span style={{ color:'var(--muted)' }}>{item.label}</span>
          <span style={{ fontWeight:700, color:item.col,
            fontFamily:'var(--font-mono)' }}>{item.value}</span>
          {item.chg !== undefined && (
            <span style={{ fontSize:9, color:item.col }}>
              {item.chg >= 0 ? '▲' : '▼'} {Math.abs(item.chg).toFixed(2)}%
            </span>
          )}
        </div>
      ))}
      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4 }}>
        <span style={{ width:5, height:5, borderRadius:'50%',
          background:'var(--green)', display:'inline-block',
          animation:'pulse 1.2s ease-in-out infinite' }}/>
        <span style={{ fontSize:9, color:'var(--green)' }}>LIVE</span>
      </div>
    </div>
  );
}

// ─── Sidebar Item ─────────────────────────────────────────────────────────────
function SidebarItem({ icon, label, active, badge, badgeCol, onClick }) {
  return (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:8, padding:'7px 10px',
      borderRadius:8, cursor:'pointer', marginBottom:2,
      background: active ? 'rgba(59,130,246,0.15)' : 'transparent',
      border: active ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
      transition:'all .15s',
    }}>
      <span style={{ fontSize:14, flexShrink:0 }}>{icon}</span>
      <span style={{ fontSize:11, fontWeight: active?700:400,
        color: active ? 'var(--blue)' : 'var(--muted)', flex:1 }}>{label}</span>
      {badge && (
        <span style={{ fontSize:8, padding:'1px 5px', borderRadius:4, fontWeight:700,
          background:(badgeCol||'var(--blue)')+'22',
          color: badgeCol||'var(--blue)' }}>{badge}</span>
      )}
    </div>
  );
}

// ─── Main Layout (fix hydration) ───────────────────────────────────────────────
export default function Layout({ children, tab, onTabChange, priceData, verdict }) {
  const [mounted, setMounted]   = useState(false);
  const [theme, setTheme]       = useState('dark');
  const [session, setSession]   = useState('asia');
  const [hunting, setHunting]   = useState({ active:false });
  const [overlap, setOverlap]   = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // ─── Chỉ chạy ở client sau khi mount ──────────────────────
  useEffect(() => {
    setMounted(true);
    const tick = () => {
      setSession(getSession());
      setHunting(getHunting());
      setOverlap(isOverlap());
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  const TABS = [
    { id:0, icon:'📡', label:'Tổng quan',           badge: null },
    { id:1, icon:'🌊', label:'Xu hướng & Mô hình',  badge: null },
    { id:2, icon:'📦', label:'Nền tảng & Dòng tiền', badge: null },
    { id:3, icon:'🏁', label:'Verdict',               badge: verdict ? `${verdict.final}` : null, badgeCol: verdict?.verdictCol },
    { id:4, icon:'🌏', label:'Kế hoạch phiên',       badge: null },
  ];

  const sessionInfo = {
    asia:    { label:'🌏 Á',  col:'var(--cyan)'   },
    europe:  { label:'🌍 Âu', col:'var(--purple)' },
    us:      { label:'🌎 Mỹ', col:'var(--orange)' },
  }[session];

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>

      {/* ── Top Header ── */}
      <div style={{ background:'var(--card)', borderBottom:'1px solid var(--border)',
        padding:'8px 16px', display:'flex', alignItems:'center',
        justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={() => setCollapsed(p => !p)} style={{
            background:'transparent', border:'none', color:'var(--muted)',
            fontSize:16, cursor:'pointer', padding:'2px 4px' }}>
            {collapsed ? '☰' : '✕'}
          </button>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:'var(--cyan)',
              letterSpacing:1 }}>⚡ COPPER STRATEGIST</div>
            <div style={{ fontSize:8, color:'var(--muted)' }}>v3.0 · 2026</div>
          </div>
        </div>

        {/* Session + alerts — chỉ render sau khi mounted */}
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          {mounted && overlap && (
            <span style={{ fontSize:9, padding:'2px 8px', borderRadius:5, fontWeight:700,
              background:'var(--orange)22', border:'1px solid var(--orange)55',
              color:'var(--orange)', animation:'glow 1.4s ease-in-out infinite' }}>
              ⚡ OVERLAP
            </span>
          )}
          {mounted && hunting.active && (
            <span style={{ fontSize:9, padding:'2px 8px', borderRadius:5, fontWeight:700,
              background:hunting.col+'22', border:`1px solid ${hunting.col}55`,
              color:hunting.col, animation:'pulse 1.2s ease-in-out infinite' }}>
              🎯 KILL ZONE {hunting.session}
            </span>
          )}
          {mounted && (
            <span style={{ fontSize:9, padding:'2px 8px', borderRadius:5,
              background:sessionInfo.col+'18', color:sessionInfo.col,
              border:`1px solid ${sessionInfo.col}33` }}>
              {sessionInfo.label}
            </span>
          )}
        </div>

        {/* Clock + theme */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <LiveClock />
          <button onClick={toggleTheme} style={{ background:'var(--card2)',
            border:'1px solid var(--border)', borderRadius:6,
            padding:'4px 8px', fontSize:14, cursor:'pointer' }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* ── Price Ticker ── */}
      <PriceTicker priceData={priceData} />

      {/* ── Body: Sidebar + Content ── */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* Sidebar */}
        {!collapsed && (
          <div style={{ width:200, background:'var(--card)', borderRight:'1px solid var(--border)',
            padding:'10px 8px', flexShrink:0, overflowY:'auto' }}>

            <div style={{ fontSize:9, fontWeight:500, color:'var(--muted)',
              textTransform:'uppercase', letterSpacing:'.07em',
              padding:'4px 6px', marginBottom:4 }}>Phân tích</div>

            {TABS.map(t => (
              <SidebarItem key={t.id} icon={t.icon} label={t.label}
                active={tab === t.id} badge={t.badge} badgeCol={t.badgeCol}
                onClick={() => onTabChange(t.id)} />
            ))}

            <div style={{ fontSize:9, fontWeight:500, color:'var(--muted)',
              textTransform:'uppercase', letterSpacing:'.07em',
              padding:'4px 6px', margin:'12px 0 4px' }}>Dữ liệu</div>

            <SidebarItem icon="📅" label="Lịch kinh tế" badge="3" badgeCol="var(--amber)"
              onClick={() => onTabChange(2)} />
            <SidebarItem icon="🦢" label="Black Swan"
              badge={verdict?.final < 40 ? '⚠️' : null} badgeCol="var(--red)"
              onClick={() => onTabChange(2)} />
            <SidebarItem icon="📰" label="Tin tức"      onClick={() => onTabChange(0)} />

            {/* Verdict mini */}
            {verdict && (
              <div style={{ margin:'12px 4px 0', background:verdict.verdictCol+'14',
                border:`1px solid ${verdict.verdictCol}44`, borderRadius:8,
                padding:'8px 10px', textAlign:'center' }}>
                <div style={{ fontSize:8, color:'var(--muted)', marginBottom:2 }}>VERDICT</div>
                <div style={{ fontSize:22, fontWeight:800, color:verdict.verdictCol,
                  lineHeight:1 }}>{verdict.final}</div>
                <div style={{ fontSize:9, color:verdict.verdictCol,
                  marginTop:2 }}>{verdict.verdictLabel}</div>
              </div>
            )}
          </div>
        )}

        {/* Main content */}
        <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}