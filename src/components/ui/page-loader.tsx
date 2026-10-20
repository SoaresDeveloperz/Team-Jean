import { LoaderCircle } from 'lucide-react'

export function PageLoader({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-24 text-zinc-500">
      <LoaderCircle className="h-8 w-8 animate-spin" aria-hidden="true" />
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </div>
  )
}
