import Link from 'next/link'
import { Logo } from '@/components/ui/logo'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
      <Logo className="h-14 w-14" />
      <h1 className="text-lg font-black uppercase tracking-widest">Página não encontrada</h1>
      <p className="text-sm text-zinc-500">O endereço pode ter mudado ou não existe mais.</p>
      <Link href="/" className="rounded-2xl bg-white px-6 py-3 text-xs font-black uppercase tracking-widest text-black">
        Voltar ao início
      </Link>
    </main>
  )
}
