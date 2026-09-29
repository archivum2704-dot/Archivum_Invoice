"use client"

import { Store, AlertTriangle } from "lucide-react"
import { principalOptions, type ClientLike } from "@/lib/client-checks"

const selectCls = "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"

/**
 * "Establecimiento de…" — files a client under a principal that has the same
 * CIF/NIF (another shop, office or branch of the same taxpayer). Picking one
 * copies its CIF, which the form then locks: an establishment always carries
 * its principal's. Shared by both web client forms so the rule lives once.
 */
export function EstablishmentField({ existing, selfId, value, onChange, disabled, hasEstablishments }: {
  existing: ClientLike[]
  selfId?: string | null
  value: string
  /** Receives the principal (or null for "none"). */
  onChange: (principal: ClientLike | null) => void
  disabled?: boolean
  /** A client that already has establishments must stay principal. */
  hasEstablishments?: boolean
}) {
  const options = principalOptions(existing, selfId)
  if (hasEstablishments) {
    return <p className="text-[11px] text-muted-foreground">Cliente principal con establecimientos: no puede ser a su vez establecimiento de otro.</p>
  }
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
        <Store className="w-3.5 h-3.5" /> Establecimiento de
      </label>
      <select value={value} disabled={disabled || options.length === 0}
        onChange={e => onChange(options.find(o => o.id === e.target.value) ?? null)}
        className={selectCls}>
        <option value="">Ninguno — es un cliente principal</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}{o.cif ? ` · ${o.cif}` : ""}</option>)}
      </select>
      <p className="text-[11px] text-muted-foreground mt-1">
        {value
          ? "Otro local o delegación del mismo cliente: mismo CIF/NIF, con su propia dirección de facturación."
          : "Para un segundo local o delegación del mismo cliente (mismo CIF/NIF, otra dirección)."}
      </p>
    </div>
  )
}

/** Blocking notice for a CIF already used by a principal, with the way out. */
export function CifTakenNotice({ message, principal, onMakeEstablishment }: {
  message: string
  principal: ClientLike
  onMakeEstablishment: () => void
}) {
  return (
    <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-2.5 py-2 space-y-2">
      <p className="flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {message}</p>
      <button type="button" onClick={onMakeEstablishment}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border border-border text-foreground font-medium hover:bg-muted transition-colors">
        <Store className="w-3.5 h-3.5" /> Crear como establecimiento de «{principal.name}»
      </button>
    </div>
  )
}
