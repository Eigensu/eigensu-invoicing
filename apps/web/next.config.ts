import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
  transpilePackages: ['@eigensu/core', '@eigensu/db'],
  devIndicators: false,
}

export default nextConfig
