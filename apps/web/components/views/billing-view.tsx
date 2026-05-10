"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  CreditCard, Users, FileText, CheckCircle2,
  AlertTriangle, XCircle, Clock, ChevronUp, ChevronDown, ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useOrganization } from "@/lib/context/organization-context"
import { useBilling } from "@/lib/hooks/use-billing"
import type { BillingStatus } from "@/lib/hooks/use-billing"

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
}

function daysLeft(iso: string | null) {
  if (!iso) return 0
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

function ProgressBar({ value, max, danger }: { value: number; max: number; danger?: boolean }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100))
  const isHigh = pct >= 80
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{value.toLocaleString("es-ES")} / {max.toLocaleString("es-ES")}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            danger && isHigh ? "bg-destructive" : isHigh ? "bg-amber-400" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: BillingStatus["subscriptionStatus"] }) {
  const configs: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    active:     { label: "Activa",        icon: CheckCircle2,   className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    trialing:   { label: "Prueba gratuita", icon: Clock,          className: "bg-blue-100 text-blue-700 border-blue-200" },
    past_due:   { label: "Pago pendiente", icon: AlertTriangle,  className: "bg-amber-100 text-amber-700 border-amber-200" },
    canceled:   { label: "Cancelada",     icon: XCircle,        className: "bg-muted text-muted-foreground border-border" },
    unpaid:     { label: "Impagada",      icon: XCircle,        className: "bg-destructive/10 text-destructive border-destructive/20" },
    incomplete: { label: "Incompleta",    icon: AlertTriangle,  className: "bg-amber-100 text-amber-700 border-amber-200" },
    paused:     { label: "Pausada",       icon: Clock,          className: "bg-muted text-muted-foreground border-border" },
  }
  const { label, icon: Icon, className } = configs[status] ?? configs.canceled
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border", className)}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  )
}

// ── Addon stepper ─────────────────────────────────────────────────────────────
function AddonStepper({
  label, sublabel, value, onChange, price, disabled,
}: {
  label: string; sublabel: string; value: number; onChange: (v: number) => void
  price: string; disabled: boolean
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-primary">{price}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange(Math.max(0, value - 1))}
            disabled={disabled || value === 0}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
          <button
            onClick={() => onChange(value + 1)}
            disabled={disabled}
            className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function BillingView() {
  const router = useRouter()
  const { currentOrg, isOrgAdmin } = useOrganization()
  const { billing, loading, mutate } = useBilling(currentOrg?.id ?? null)

  const [extraUsers, setExtraUsers] = useState<number | null>(null)
  const [extraDocs,  setExtraDocs]  = useState<number | null>(null)
  const [saving, setSaving]         = useState(false)
  const [redirecting, setRedirecting] = useState<"checkout" | "portal" | null>(null)
  const [addonMsg, setAddonMsg]     = useState<string | null>(null)

  // Initialise steppers from server data on first load
  const effectiveExtraUsers = extraUsers ?? billing?.extraUsersQuantity ?? 0
  const effectiveExtraDocs  = extraDocs  ?? billing?.extraDocsQuantity  ?? 0

  const isActive = billing?.subscriptionStatus === 'active' || billing?.subscriptionStatus === 'trialing'
  const addonsChanged = billing
    ? effectiveExtraUsers !== billing.extraUsersQuantity || effectiveExtraDocs !== billing.extraDocsQuantity
    : false

  // Monthly cost breakdown
  const baseCost    = 10
  const usersCost   = effectiveExtraUsers * 2
  const docsCost    = effectiveExtraDocs  * 5
  const totalCost   = baseCost + usersCost + docsCost

  async function handleCheckout() {
    setRedirecting("checkout")
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: currentOrg?.id }),
    })
    const data = await res.json()
    setRedirecting(null)
    if (data.url) {
      window.location.href = data.url
    } else if (data.error === "already_subscribed") {
      handlePortal()
    }
  }

  async function handlePortal() {
    setRedirecting("portal")
    const res = await fetch("/api/billing/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: currentOrg?.id }),
    })
    const data = await res.json()
    setRedirecting(null)
    if (data.url) window.location.href = data.url
  }

  async function handleSaveAddons() {
    setSaving(true)
    setAddonMsg(null)
    const res = await fetch("/api/billing/update-addons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: currentOrg?.id, extraUsers: effectiveExtraUsers, extraDocs: effectiveExtraDocs }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.ok) {
      setAddonMsg("Cambios aplicados correctamente. El ajuste proporcional se facturará de inmediato.")
      await mutate()
    } else {
      setAddonMsg(`Error: ${data.error}`)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="w-6 h-6" />
          Facturación y Plan
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gestiona tu suscripción y límites de uso</p>
      </div>

      {/* Plans grid */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Free plan */}
        <div className={cn(
          "bg-card border rounded-2xl overflow-hidden",
          !billing?.hasSubscription ? "border-primary ring-2 ring-primary/20" : "border-border opacity-70"
        )}>
          <div className="p-5 border-b border-border">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-foreground">Plan Gratuito</p>
              {!billing?.hasSubscription && (
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-primary/10 text-primary rounded-full border border-primary/20">Plan actual</span>
              )}
            </div>
            <p className="text-2xl font-bold text-foreground">0 € <span className="text-sm font-normal text-muted-foreground">/ mes</span></p>
            <p className="text-xs text-muted-foreground mt-1">Sin tarjeta de crédito. Para siempre.</p>
          </div>
          <ul className="px-5 py-4 space-y-2.5 text-sm text-muted-foreground">
            {["1 usuario", "20 documentos", "Todas las funcionalidades"].map(f => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro plan */}
        <div className={cn(
          "bg-card border rounded-2xl overflow-hidden",
          billing?.hasSubscription ? "border-primary ring-2 ring-primary/20" : "border-border"
        )}>
          <div className="p-5 border-b border-border">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-foreground">Archivum Pro</p>
              {billing?.hasSubscription
                ? <StatusBadge status={billing.subscriptionStatus} />
                : <span className="text-[10px] font-semibold px-2 py-0.5 bg-muted text-muted-foreground rounded-full border border-border">Recomendado</span>
              }
            </div>
            <p className="text-2xl font-bold text-foreground">{totalCost} € <span className="text-sm font-normal text-muted-foreground">/ mes</span></p>
            <p className="text-xs text-muted-foreground mt-1">
              {billing?.subscriptionStatus === 'trialing'
                ? `Prueba activa — quedan ${daysLeft(billing.trialEndsAt)} días`
                : billing?.currentPeriodEnd
                  ? `Próxima renovación: ${formatDate(billing.currentPeriodEnd)}`
                  : "7 días de prueba gratis · sin compromiso"}
            </p>
          </div>
          <ul className="px-5 py-4 space-y-2.5 text-sm text-muted-foreground">
            {[
              "5 usuarios incluidos (+2 €/usuario/mes)",
              "500 documentos (+5 €/pack de 200 docs)",
              "Todas las funcionalidades",
              "Soporte prioritario",
            ].map(f => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          {isOrgAdmin && (
            <div className="px-5 pb-5">
              {!billing?.hasSubscription ? (
                <button
                  onClick={handleCheckout}
                  disabled={!!redirecting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {redirecting === "checkout" ? "Redirigiendo..." : "Suscribirse — 7 días gratis"}
                </button>
              ) : (
                <button
                  onClick={handlePortal}
                  disabled={!!redirecting}
                  className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border text-foreground text-sm font-medium rounded-xl hover:bg-muted disabled:opacity-60 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {redirecting === "portal" ? "Redirigiendo..." : "Gestionar pago y facturas"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Usage */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
        <p className="text-sm font-semibold text-foreground">Uso actual</p>
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Usuarios</span>
            </div>
            <ProgressBar
              value={billing?.memberCount ?? 0}
              max={billing?.maxUsers ?? 5}
              danger
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Documentos</span>
            </div>
            <ProgressBar
              value={billing?.documentCount ?? 0}
              max={billing?.maxDocs ?? 500}
              danger
            />
          </div>
        </div>
      </div>

      {/* Add-ons */}
      {isOrgAdmin && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-foreground">Extras</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Amplía tus límites en cualquier momento. Los cambios se prorratean en la próxima factura.
            </p>
          </div>

          <AddonStepper
            label="Usuarios adicionales"
            sublabel="+1 usuario por unidad"
            value={effectiveExtraUsers}
            onChange={(v) => setExtraUsers(v)}
            price="2 € / usuario / mes"
            disabled={false}
          />
          <AddonStepper
            label="Pack de documentos"
            sublabel="+200 documentos por pack"
            value={effectiveExtraDocs}
            onChange={(v) => setExtraDocs(v)}
            price="5 € / pack / mes"
            disabled={false}
          />

          {/* Cost summary */}
          <div className="mt-4 pt-4 border-t border-border space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Plan base</span><span>10 €</span>
            </div>
            {usersCost > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{effectiveExtraUsers} usuario{effectiveExtraUsers !== 1 ? "s" : ""} extra</span>
                <span>{usersCost} €</span>
              </div>
            )}
            {docsCost > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{effectiveExtraDocs} pack{effectiveExtraDocs !== 1 ? "s" : ""} de documentos</span>
                <span>{docsCost} €</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border">
              <span>Total / mes</span><span>{totalCost} €</span>
            </div>
          </div>

          {addonsChanged && billing?.hasSubscription && isActive && (
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSaveAddons}
                disabled={saving}
                className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                onClick={() => { setExtraUsers(billing.extraUsersQuantity); setExtraDocs(billing.extraDocsQuantity) }}
                className="px-4 py-2 border border-border text-sm rounded-xl hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
          {addonsChanged && !billing?.hasSubscription && (
            <p className="mt-4 text-xs text-muted-foreground">
              Suscríbete al plan base para activar estos extras.
            </p>
          )}
          {addonsChanged && billing?.hasSubscription && !isActive && (
            <p className="mt-4 text-xs text-muted-foreground">
              Tu suscripción no está activa. Reactívala para aplicar cambios.
            </p>
          )}
          {addonMsg && (
            <p className={cn("mt-3 text-xs", addonMsg.startsWith("Error") ? "text-destructive" : "text-emerald-600")}>
              {addonMsg}
            </p>
          )}
        </div>
      )}

      {/* Base plan summary */}
      <div className="bg-muted/40 border border-border rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-3">Plan Base — 10 € / mes</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {[
            "5 usuarios incluidos",
            "500 documentos almacenados",
            "Gestión de carpetas y permisos",
            "Exportación CSV y Excel",
            "14 días de prueba gratuita",
          ].map(item => (
            <li key={item} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
