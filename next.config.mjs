// Cabeçalhos básicos de segurança em todas as respostas (páginas, rotas,
// sw.js e manifest). Só a diretiva frame-ancestors da CSP: o app não pode ser
// aberto dentro de outro site (clickjacking). A câmera fica liberada só para o
// próprio app ("Tirar foto agora" usa <input capture>); microfone e
// localização ficam desligados.
// No preview do Replit (só desenvolvimento) o app abre dentro de um iframe do
// próprio Replit: lá os dois cabeçalhos de iframe ficam de fora.
const framingHeaders = process.env.REPLIT_DEV_DOMAIN
  ? []
  : [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    ]
const securityHeaders = [
  ...framingHeaders,
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Preview do Replit: o domínio é aninhado e não casa com um curinga simples.
  allowedDevOrigins: process.env.REPLIT_DEV_DOMAIN ? [process.env.REPLIT_DEV_DOMAIN] : [],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
