/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Crawlers and iOS often request these paths; Next serves /icon and /apple-icon from app/*.tsx */
  async redirects() {
    return [
      { source: '/favicon.ico', destination: '/icon', permanent: true },
      { source: '/apple-touch-icon.png', destination: '/apple-icon', permanent: true },
    ]
  },
};

export default nextConfig;
