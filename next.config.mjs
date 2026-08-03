/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      { source: '/login', destination: '/login.html' },
      { source: '/register', destination: '/register.html' },
      { source: '/dashboard', destination: '/dashboard.html' },
      { source: '/deposit', destination: '/deposit.html' },
      { source: '/withdraw', destination: '/withdraw.html' },
      { source: '/plans', destination: '/plans.html' },
      { source: '/mining', destination: '/mining.html' },
      { source: '/team', destination: '/team.html' },
      { source: '/profile', destination: '/profile.html' },
      { source: '/admin', destination: '/xpro-admin/dashboard.html' },
      { source: '/admin/login', destination: '/xpro-admin/login.html' },
    ];
  },
};

export default nextConfig;
