/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Ignora erros estritos de tipo do TypeScript durante o build na Vercel
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignora regras estritas de linter durante o build
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
