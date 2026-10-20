/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Preview do Replit: o domínio é aninhado e não casa com um curinga simples.
  allowedDevOrigins: process.env.REPLIT_DEV_DOMAIN ? [process.env.REPLIT_DEV_DOMAIN] : [],
}

export default nextConfig
