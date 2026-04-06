/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdcssl.ibsrv.net',
        pathname: '/ibimg/**',
      },
    ],
  },
  /**
   * Rewrites (not redirects) so /favicon.ico returns 200 with icon bytes — many crawlers prefer that over 301.
   * Next serves /icon and /apple-icon from app/*.tsx
   */
  async rewrites() {
    return [
      { source: '/favicon.ico', destination: '/icon' },
      { source: '/apple-touch-icon.png', destination: '/apple-icon' },
    ]
  },
}

export default nextConfig
