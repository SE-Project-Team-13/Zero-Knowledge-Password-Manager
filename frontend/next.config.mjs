/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://www.google.com https://*.gstatic.com; connect-src 'self' https: http://localhost:3001;"
          }
        ]
      }
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.google.com',
        pathname: '/s2/favicons/**',
      },
      {
        protocol: 'https',
        hostname: '*.gstatic.com',
        pathname: '/**',
      },
    ],
  },
  transpilePackages: ["@password-manager/crypto-engine"],
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-native-quick-crypto": false,
      "react-native-argon2": false,
    }
    return config
  },
}

export default nextConfig
