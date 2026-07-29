// components/verdict/shared.js — Shared style helpers dùng chung mọi card
export const cardStyle = (C, glowColor) => ({
  background: C.bg,
  border: `1px solid ${glowColor ? glowColor+'55' : C.grid}`,
  borderRadius: 10,
  padding: '10px 12px',
  boxShadow: glowColor ? `0 0 12px ${glowColor}10` : 'none',
});

export const lblStyle = (C) => ({
  fontSize: 10, fontWeight: 500, letterSpacing: '.07em',
  textTransform: 'uppercase', color: C.muted, marginBottom: 7,
  display: 'flex', alignItems: 'center', gap: 5,
});

export const barWrap = (C) => ({
  height: 4, background: C.grid, borderRadius: 2, overflow: 'hidden',
});

export const metricBox = (C) => ({
  background: C.bg2, border: `0.5px solid ${C.grid}`, borderRadius: 7, padding: '7px 9px',
});