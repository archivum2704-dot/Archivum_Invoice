"use client"

import { useState } from "react"
import {
  CreditCard, Users, FileText, Building2, CheckCircle2,
  AlertTriangle, XCircle, Clock, ChevronUp, ChevronDown,
  ExternalLink, HardDrive, Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useOrganization } from "@/lib/context/organization-context"
import { useBilling } from "@/lib/hooks/use-billing"
import type { BillingStatus } from "@/lib/hooks/use-billing"
import { PLANS, ADDONS } from "@/lib/pricing"

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
}
function daysLeft(iso: string | null) {
  return Math.max(0, Math.ceil(((new Date(iso ?? 0).getTime()) - Date.now()) / 86_400_000))
}

function StatusBadge({ status }: { status: BillingStatus["subscriptionStatus"] }) {
  const cfg: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
    active:     { label: "Activa",           icon: CheckCircle2,  cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    trialing:   { label: "Período de prueba",icon: Clock,         cls: "bg-blue-100 text-blue-700 border-blue-200" },
    past_due:   { label: "Pago pendiente",   icon: AlertTriangle, cls: "bg-amber-100 text-amber-700 border-amber-200" },
    canceled:   { label: "Cancelada",        icon: XCircle,       cls: "bg-muted text-muted-foreground border-border" },
    unpaid:     { label: "Impagada",         icon: XCircle,       cls: "bg-destructive/10 text-destructive border-destructive/20" },
    incomplete: { label: "Incompleta",       icon: AlertTriangle, cls: "bg-amber-100 text-amber-700 border-amber-200" },
    paused:     { label: "Pausada",          icon: Clock,         cls: "bg-muted text-muted-foreground border-border" },
  }
  const { label, icon: Icon, cls } = cfg[status] ?? cfg.canceled
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border", cls)}>
      <Icon className="w-3 h-3" />{label}
    </span>
  )
}

function ProgressBar({ value, max, danger }: { value: number; max: number; danger?: boolean }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100))
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{value.toLocaleString("es-ES")} / {max.toLocaleString("es-ES")}</span>
        <span className={cn(pct >= 80 ? (danger ? "text-destructive" : "text-amber-600") : "")}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", pct >= 80 ? (danger ? "bg-destructive" : "bg-amber-400") : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function AddonStepper({ label, sublabel, value, onChange, price }: {
  label: string; sublabel: string; value: number; onChange: (v: number) => void; price: string
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-primary">{price}</span>
        <div className="flex items-center border border-border rounded-lg overflow-hidden">
          <button onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0}
            className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums border-x border-border">{value}</span>
          <button onClick={() => onChange(value + 1)}
            className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function BillingView() {
  const { currentOrg, isOrgAdmin } = useOrganization()
  const { billing, loading, mutate } = useBilling(currentOrg?.id ?? null)

  const [extraUsers, setExtraUsers] = useState<number | null>(null)
  const [extraDocs,  setExtraDocs]  = useState<number | null>(null)
  const [saving, setSaving]           = useState(false)
  const [redirecting, setRedirecting] = useState<"checkout" | "portal" | null>(null)
  const [addonMsg, setAddonMsg]       = useState<string | null>(null)

  const effectiveExtraUsers = extraUsers ?? billing?.extraUsersQuantity ?? 0
  const effectiveExtraDocs  = extraDocs  ?? billing?.extraDocsQuantity  ?? 0

  const isActive      = billing?.subscriptionStatus === "active" || billing?.subscriptionStatus === "trialing"
  const addonsChanged = billing
    ? effectiveExtraUsers !== billing.extraUsersQuantity || effectiveExtraDocs !== billing.extraDocsQuantity
    : false

  const currentPlanId = billing?.plan ?? "free"
  const currentPlan   = PLANS[currentPlanId as keyof typeof PLANS] ?? PLANS.free
  const baseCost      = currentPlan.price
  const usersCost     = effectiveExtraUsers * ADDONS.extraUser.price
  const totalCost     = baseCost + usersCost

  async function handleCheckout(planId: string) {
    setRedirecting("checkout")
    const res  = await fetch("/api/billing/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: currentOrg?.id, planId }),
    })
    const data = await res.json()
    setRedirecting(null)
    if (data.url) window.location.href = data.url
    else if (data.error === "already_subscribed") handlePortal()
  }

  async function handlePortal() {
    setRedirecting("portal")
    const res  = await fetch("/api/billing/portal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: currentOrg?.id }),
    })
    const data = await res.json()
    setRedirecting(null)
    if (data.url) window.location.href = data.url
  }

  async function handleSaveAddons() {
    setSaving(true); setAddonMsg(null)
    const res  = await fetch("/api/billing/update-addons", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: currentOrg?.id, extraUsers: effectiveExtraUsers, extraDocs: effectiveExtraDocs }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.ok) { setAddonMsg("Cambios aplicados. El ajuste proporcional se facturará de inmediato."); await mutate() }
    else setAddonMsg(`Error: ${data.error}`)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )

  return (
    <div className="p-8 space-y-8 max-w-6xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="w-6 h-6" /> Facturación y Plan
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gestiona tu suscripción y límites de uso</p>
      </div>

      {/* ── Plan cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Object.values(PLANS).map(plan => {
          const isCurrent = plan.id === currentPlanId
          const isPaid    = plan.price > 0
          const isUpgrade = plan.price > currentPlan.price

          return (
            <div key={plan.id} className={cn(
              "relative bg-card border rounded-2xl flex flex-col overflow-hidden transition-shadow",
              isCurrent
                ? "border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]"
                : "border-border hover:border-primary/40 hover:shadow-sm",
            )}>
              {/* Top ribbon */}
              {plan.highlight && !isCurrent && (
                <div className="bg-primary text-primary-foreground text-[10px] font-bold tracking-widest uppercase text-center py-1 px-3">
                  MÁS POPULAR
                </div>
              )}
              {isCurrent && (
                <div className="bg-primary/10 border-b border-primary/20 text-primary text-[10px] font-bold tracking-widest uppercase text-center py-1 px-3 flex items-center justify-center gap-1.5">
                  <Zap className="w-3 h-3" /> Plan actual
                </div>
              )}

              {/* Header */}
              <div className="p-5 pb-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <p className="text-base font-bold text-foreground">{plan.name}</p>
                  {isCurrent && billing?.subscriptionStatus && isPaid && (
                    <StatusBadge status={billing.subscriptionStatus} />
                  )}
                </div>

                {/* Price */}
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-3xl font-extrabold text-foreground tracking-tight">
                    {plan.price === 0 ? "0" : plan.priceLabel.replace(" €", "")}
                  </span>
                  {plan.price > 0
                    ? <span className="text-sm text-muted-foreground mb-0.5">€/mes</span>
                    : <span className="text-sm font-medium text-muted-foreground mb-0.5">€ · gratis</span>
                  }
                </div>

                {/* Renewal / trial info */}
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {isCurrent && billing?.subscriptionStatus === "trialing"
                    ? `Prueba activa — quedan ${daysLeft(billing.trialEndsAt)} días`
                    : isCurrent && billing?.currentPeriodEnd && isPaid
                      ? `Renueva ${formatDate(billing.currentPeriodEnd)}`
                      : isPaid
                        ? "Sin permanencia"
                        : "Sin tarjeta · para siempre"}
                </p>
              </div>

              {/* Key stats */}
              <div className="mx-5 mb-4 grid grid-cols-3 gap-2">
                <div className="bg-muted/60 rounded-xl p-2.5 text-center">
                  <Users className="w-3.5 h-3.5 mx-auto mb-0.5 text-muted-foreground" />
                  <p className="text-sm font-bold text-foreground">{plan.users}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">usuario{plan.users !== 1 ? "s" : ""}</p>
                </div>
                <div className="bg-muted/60 rounded-xl p-2.5 text-center">
                  <FileText className="w-3.5 h-3.5 mx-auto mb-0.5 text-muted-foreground" />
                  <p className="text-sm font-bold text-foreground">{plan.docsPerMonth}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">docs/mes</p>
                </div>
                <div className="bg-muted/60 rounded-xl p-2.5 text-center">
                  <HardDrive className="w-3.5 h-3.5 mx-auto mb-0.5 text-muted-foreground" />
                  <p className="text-sm font-bold text-foreground">{plan.storageGB}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">GB</p>
                </div>
              </div>

              {/* Feature list */}
              <ul className="px-5 pb-4 space-y-1.5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className={cn("w-3.5 h-3.5 shrink-0 mt-px", isCurrent || plan.highlight ? "text-primary" : "text-emerald-500")} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="p-4 pt-2">
                {isOrgAdmin && !isCurrent && isPaid && (
                  <button
                    onClick={() => handleCheckout(plan.id)}
                    disabled={!!redirecting}
                    className={cn(
                      "w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60",
                      isUpgrade
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-foreground hover:bg-muted/80 border border-border",
                    )}
                  >
                    {redirecting === "checkout" ? "Redirigiendo..." : isUpgrade ? `Mejorar a ${plan.name}` : `Cambiar a ${plan.name}`}
                  </button>
                )}
                {isOrgAdmin && isCurrent && isPaid && (
                  <button
                    onClick={handlePortal}
                    disabled={!!redirecting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors disabled:opacity-60"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {redirecting === "portal" ? "Redirigiendo..." : "Gestionar facturación"}
                  </button>
                )}
                {isCurrent && !isPaid && (
                  <div className="py-2.5 text-center text-xs text-muted-foreground">Plan gratuito activo</div>
                )}
                {!isOrgAdmin && !isCurrent && isPaid && (
                  <div className="py-2.5 text-center text-xs text-muted-foreground">Solo el administrador puede cambiar el plan</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Uso + Extras en dos columnas ──────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Uso actual */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <p className="text-sm font-semibold text-foreground">Uso actual</p>

          <div className="space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <Users className="w-4 h-4 text-muted-foreground" /> Usuarios
              </span>
              <span className="text-xs text-muted-foreground">máx. {billing?.maxUsers ?? "—"}</span>
            </div>
            <ProgressBar value={billing?.memberCount ?? 0} max={billing?.maxUsers ?? 1} danger />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <FileText className="w-4 h-4 text-muted-foreground" /> Documentos (pool anual)
              </span>
              <span className="text-xs text-muted-foreground">disponibles</span>
            </div>
            <ProgressBar value={billing?.documentCount ?? 0} max={billing?.maxDocs ?? 250} danger />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm text-foreground">
                <Building2 className="w-4 h-4 text-muted-foreground" /> Empresas
              </span>
              <span className="text-xs text-muted-foreground">máx. {billing?.maxCompanies ?? "—"}</span>
            </div>
            <ProgressBar value={billing?.companyCount ?? 0} max={billing?.maxCompanies ?? 20} />
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            {[
              { label: "Plan", value: currentPlan.name },
              { label: "Docs/mes", value: currentPlan.docsPerMonth.toLocaleString("es-ES") },
              { label: "Almacenamiento", value: `${currentPlan.storageGB} GB` },
            ].map(s => (
              <div key={s.label} className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-sm font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Extras */}
        {isOrgAdmin && (
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col">
            <div className="mb-5">
              <p className="text-sm font-semibold text-foreground">Extras</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Amplía tus límites en cualquier momento. Los cambios se prorratean.
              </p>
            </div>

            <div className="flex-1">
              <AddonStepper
                label={ADDONS.extraUser.label}
                sublabel={ADDONS.extraUser.sublabel}
                value={effectiveExtraUsers}
                onChange={setExtraUsers}
                price={ADDONS.extraUser.priceLabel}
              />
              <AddonStepper
                label={ADDONS.extraDocs.label}
                sublabel={ADDONS.extraDocs.sublabel}
                value={effectiveExtraDocs}
                onChange={setExtraDocs}
                price={ADDONS.extraDocs.priceLabel}
              />
            </div>

            {/* Cost summary */}
            {(() => {
              const oneTimeCost = effectiveExtraDocs * ADDONS.extraDocs.price
              return (
                <div className="mt-4 pt-4 border-t border-border space-y-1.5 text-sm">
                  {/* Monthly lines */}
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recurrente / mes</p>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Plan {currentPlan.name}</span>
                    <span>{currentPlan.price === 0 ? "0 €" : `${currentPlan.priceLabel}/mes`}</span>
                  </div>
                  {usersCost > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{effectiveExtraUsers} usuario{effectiveExtraUsers !== 1 ? "s" : ""} extra</span>
                      <span>{usersCost.toFixed(2).replace(".", ",")} €/mes</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border">
                    <span>Total mensual</span>
                    <span>{totalCost === 0 ? "Gratis" : `${totalCost.toFixed(2).replace(".", ",")} €`}</span>
                  </div>

                  {/* One-time lines */}
                  {effectiveExtraDocs > 0 && (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pt-3">Pago único (hoy)</p>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{effectiveExtraDocs} bono{effectiveExtraDocs !== 1 ? "s" : ""} × 250 docs</span>
                        <span>{oneTimeCost.toFixed(2).replace(".", ",")} €</span>
                      </div>
                      <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border">
                        <span>Total a cobrar hoy</span>
                        <span className="text-primary">{oneTimeCost.toFixed(2).replace(".", ",")} €</span>
                      </div>
                    </>
                  )}
                </div>
              )
            })()}

            {/* Action button — visible siempre que haya cambios y el plan esté activo */}
            {addonsChanged && !isActive && (
              <p className="mt-3 text-xs text-muted-foreground">
                {billing?.hasSubscription
                  ? "Tu suscripción no está activa. Reactívala para aplicar cambios."
                  : "Suscríbete a un plan de pago para activar estos extras."}
              </p>
            )}
            {addonsChanged && isActive && (
              <div className="mt-4 flex items-center gap-2">
                <button onClick={handleSaveAddons} disabled={saving}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {saving ? "Aplicando cambios..." : "Confirmar y aplicar"}
                </button>
                <button
                  onClick={() => { setExtraUsers(billing!.extraUsersQuantity); setExtraDocs(billing!.extraDocsQuantity) }}
                  className="px-4 py-2.5 border border-border text-sm rounded-xl hover:bg-muted transition-colors">
                  Cancelar
                </button>
              </div>
            )}
            {addonMsg && (
              <p className={cn("mt-3 text-xs", addonMsg.startsWith("Error") ? "text-destructive" : "text-emerald-600")}>
                {addonMsg}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
