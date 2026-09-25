import type { NextConfig } from "next";

const allowedDevOrigins = [
  process.env.REPLIT_DEV_DOMAIN,
  '*.riker.replit.dev',
  '*.replit.dev',
].filter((origin): origin is string => Boolean(origin));

const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
