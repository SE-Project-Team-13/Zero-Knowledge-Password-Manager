/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@password-manager/crypto-engine"],
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
}

export default nextConfig
