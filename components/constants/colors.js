// ─── Màu sắc dùng chung toàn bộ TrendTab ─────────────────────────────────────
export const C = {
  green:'#22c55e', red:'#ef4444', amber:'#f59e0b',
  blue:'#3b82f6',  teal:'#14b8a6', purple:'#8b5cf6',
  orange:'#f97316',cyan:'#06b6d4', muted:'#5a7090',
};

export const mono = { fontFamily:'monospace' };

// score → color
export const sc = v => v>=70 ? C.green : v>=50 ? C.amber : C.red;