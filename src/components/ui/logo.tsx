import { cn } from '@/lib/cn'

export function Logo({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-8 w-8', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d="M60 120 L340 120 L300 150 L225 150 L225 280 L200 310 L150 250 L175 220 L200 250 L200 150 L100 150 Z"
        fill="white"
      />
      <path d="M245 170 L290 170 L290 280 L200 350 L160 300 L180 275 L200 295 L265 245 L265 170 Z" fill="white" />
    </svg>
  )
}
