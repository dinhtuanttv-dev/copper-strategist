/** @type {import('next').NextConfig} */
const nextConfig = {

  // ─── Bảo mật headers ─────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Strict-Transport-Security',  value: 'max-age=63072000; includeSubDomains' },
          { key: 'Referrer-Policy',            value: 'origin-when-cross-origin' },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Access-Control-Allow-Origin',  value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },

  // ─── Biến môi trường public (không để secret) ────────────────────────────────
  env: {
    APP_NAME:    'Copper Strategist',
    APP_VERSION: '3.0.0',
  },

  // ─── Tối ưu ──────────────────────────────────────────────────────────────────
  reactStrictMode:  true,
  poweredByHeader:  false,

  // ─── Turbopack (Next.js 16 mặc định) ─────────────────────────────────────────
  turbopack: {},

};

module.exports = nextConfig;