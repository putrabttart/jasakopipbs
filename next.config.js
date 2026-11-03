/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.kopikenangan.com' },
    ],
  },
};

module.exports = nextConfig;
