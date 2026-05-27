import type { NextConfig } from "next";

const API_PROXY_URL = process.env.API_PROXY_URL ?? 'http://127.0.0.1:8000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: `${API_PROXY_URL}/:path*`,
      },
    ]
  },
};

export default nextConfig;
