import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    staleTimes: {
      dynamic: 0
    }
  },
  turbopack: {
    root: path.resolve(import.meta.dirname, '../../')
  }
}

export default nextConfig
