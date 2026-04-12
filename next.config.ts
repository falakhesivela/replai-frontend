import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api-proxy/:path*',
        destination: 'https://replai-15400059963.us-central1.run.app/:path*',
      },
    ]
  },
};

export default nextConfig;
