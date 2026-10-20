import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton rounded-2xl', className)} />
}

// Esqueleto genérico de tela em bento: título + blocos.
export function PageSkeleton({ label = 'Carregando' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <Skeleton className="h-4 w-28 rounded-lg" />
      <Skeleton className="h-9 w-3/4 rounded-xl" />
      <Skeleton className="h-52 rounded-[2rem]" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
      <Skeleton className="h-24 rounded-3xl" />
      <span className="sr-only">{label}...</span>
    </div>
  )
}
