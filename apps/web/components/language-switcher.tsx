'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const locales = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
]

interface LanguageSwitcherProps {
  variant?: 'sidebar' | 'light'
  dropdownDirection?: 'up' | 'down'
}

export function LanguageSwitcher({ variant = 'sidebar', dropdownDirection = 'up' }: LanguageSwitcherProps) {
  const t = useTranslations('language')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const setLocale = (locale: string) => {
    document.cookie = `locale=${locale}; path=/; max-age=31536000; SameSite=Lax`
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        title={t('label')}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
          variant === 'sidebar'
            ? 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        <Globe className="h-4 w-4" />
      </button>

      {open && (
        <div className={cn(
          'absolute right-0 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden min-w-[130px]',
          dropdownDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
        )}>
          {locales.map(l => (
            <button
              key={l.code}
              onClick={() => setLocale(l.code)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-popover-foreground hover:bg-muted transition-colors text-left"
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
