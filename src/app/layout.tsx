import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Barlow_Condensed } from 'next/font/google'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'
import { MotionProvider } from '@/components/motion/MotionProvider'
import { ToastProvider } from '@/components/ui/toast'
import './globals.css'

// Fonte condensada de placar para títulos e números grandes (classe font-display).
// O texto corrido continua na fonte do sistema: mais leve e nativa no celular.
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  display: 'swap',
  variable: '--font-barlow-condensed',
})

const APP_ICON = 'https://iqoiyqjndyvcputmllwq.supabase.co/storage/v1/object/public/assets/icon-512.png'

export const metadata: Metadata = {
  title: { default: 'Team Jean', template: '%s · Team Jean' },
  description: 'Consultoria Esportiva',
  applicationName: 'Team Jean',
  manifest: '/manifest.json',
  icons: { apple: APP_ICON },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Team Jean',
  },
  formatDetection: { telephone: false },
}

// O zoom do usuário fica liberado (acessibilidade). O zoom automático do iOS ao
// focar inputs é evitado pela fonte de 16px nos campos (globals.css).
// viewportFit "cover" + env(safe-area-inset-*) acomodam o notch no modo app.
export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={barlowCondensed.variable}>
      <body className="bg-black text-white antialiased">
        <MotionProvider>
          <ToastProvider>{children}</ToastProvider>
        </MotionProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
