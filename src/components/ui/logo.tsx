export function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 400 400" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <path 
        d="M60 120 L340 120 L300 150 L225 150 L225 280 L200 310 L150 250 L175 220 L200 250 L200 150 L100 150 Z" 
        fill="white" 
      />
      <path 
        d="M245 170 L290 170 L290 280 L200 350 L160 300 L180 275 L200 295 L265 245 L265 170 Z" 
        fill="white" 
      />
    </svg>
  )
}
