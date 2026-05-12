/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix workspace root detection
  outputFileTracingRoot: require('path').join(__dirname),

  // Increase header size limit to handle large Supabase auth cookies
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Add custom headers configuration
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
