"use client"

import Link from "next/link"

/**
 * Casillas de aceptación (aviso legal, anexo III). Ninguna va premarcada, y la
 * de comunicaciones comerciales va aparte y es voluntaria.
 */
export function LegalConsentCheckbox({ checked, onChange, disabled }: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary" />
      <span>
        He leído y acepto el <Link href="/terminos" target="_blank" className="text-primary underline">Aviso legal y las Condiciones de uso y de contratación</Link> y
        el <Link href="/encargo-tratamiento" target="_blank" className="text-primary underline">Contrato de encargo del tratamiento</Link>, y
        he leído la <Link href="/privacidad" target="_blank" className="text-primary underline">Política de privacidad</Link>.
      </span>
    </label>
  )
}

export function MarketingConsentCheckbox({ checked, onChange, disabled }: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary" />
      <span>Deseo recibir comunicaciones comerciales sobre productos, servicios y novedades de Archivum (opcional).</span>
    </label>
  )
}
