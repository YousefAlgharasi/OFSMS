// Backend used by the /api and /local-files dev proxy below (override with BACKEND_URL)
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ofsms-documents.s3.amazonaws.com',
      },
    ],
  },

  allowedDevOrigins: ['192.168.1.130', '192.168.43.199', '*.trycloudflare.com'],

  // The service worker must always be fetched fresh so updates reach the phones
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/offline.html',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: '/local-files/:path*',
        destination: `${BACKEND_URL}/local-files/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
