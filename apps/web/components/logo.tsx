import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  showText?: boolean
  /** Use on dark backgrounds — inverts the SVG to white */
  invert?: boolean
  className?: string
  textClassName?: string
}

export function Logo({ size = 36, showText = true, invert = false, className, textClassName }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Image
        src="/logo.svg"
        alt="Archivum"
        width={size}
        height={size}
        className="shrink-0"
        style={invert ? { filter: 'brightness(0) invert(1)' } : undefined}
        priority
      />
      {showText && (
        <span className={cn('font-semibold tracking-tight', textClassName)}>
          Archivum
        </span>
      )}
    </div>
  )
}
