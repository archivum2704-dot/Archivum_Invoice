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

  const [extraUsers, setExtraUsers]     = useState(0)
  const [extraDocs,  setExtraDocs]      = useState(0)
  const [saving, setSaving]             = useState(false)
  const [redirecting, setRedirecting]   = useState<"checkout" | "portal" | null>(null)
  const [addonMsg, setAddonMsg]         = useState<string | null>(null)
  // Plan selected but not yet purchased — lets the user configure extras before checkout
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null)

  const isActive      = billing?.subscriptionStatus === "active" || billing?.subscriptionStatus === "trialing"
  const addonsChanged = extraUsers > 0 || extraDocs > 0

  const currentPlanId = billing?.plan ?? "free"
  const currentPlan   = PLANS[currentPlanId as keyof typeof PLANS] ?? PLANS.free
  // Already-contracted quantities (read-only, shown as info)
  const contractedUsers = billing?.extraUsersQuantity ?? 0
  const contractedDocs  = billing?.extraDocsQuantity  ?? 0

  // Plan the user has selected to purchase (not yet active)
  const pendingPlan = pendingPlanId ? PLANS[pendingPlanId as keyof typeof PLANS] : null

  // Which plan to use for cost calculations
  const displayPlan = pendingPlan ?? currentPlan

  // Monthly cost = base plan + ALL users (existing + new)
  const baseCost     = displayPlan.price
  const usersCost    = (contractedUsers + extraUsers) * ADDONS.extraUser.price
  const totalCost    = baseCost + usersCost
  const newUsersCost = extraUsers * ADDONS.extraUser.price

  // Extras panel is shown when active (manage existing) OR when user picked a plan to buy
  const showExtras = isActive || pendingPlanId !== null

  async function handleCheckout(planId: string, withExtraUsers = 0, withExtraDocs = 0) {
    setRedirecting("checkout")
    const res  = await fetch("/api/billing/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgId: currentOrg?.id,
        planId,
        extraUsers: withExtraUsers,
        extraDocs:  withExtraDocs,
      }),
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
      // Send accumulated total (existing + what user is adding now)
      body: JSON.stringify({
        orgId: currentOrg?.id,
        extraUsers: contractedUsers + extraUsers,
        extraDocs:  contractedDocs  + extraDocs,
      }),
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
                  <>
                    {isActive ? (
                      /* Already subscribed: go straight to checkout/portal for plan change */
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
                    ) : pendingPlanId === plan.id ? (
                      /* This plan is selected — show deselect option */
                      <button
                        onClick={() => { setPendingPlanId(null); setExtraUsers(0); setExtraDocs(0) }}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
                      >
                        ✓ Seleccionado — cambiar
                      </button>
                    ) : (
                      /* Select this plan (shows extras panel below) */
                      <button
                        onClick={() => { setPendingPlanId(plan.id); setExtraUsers(0); setExtraDocs(0) }}
                        disabled={!!redirecting}
                        className={cn(
                          "w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60",
                          isUpgrade
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-muted text-foreground hover:bg-muted/80 border border-border",
                        )}
                      >
                        {isUpgrade ? `Mejorar a ${plan.name}` : `Cambiar a ${plan.name}`}
                      </button>
                    )}
                  </>
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
        {isOrgAdmin && showExtras && (
          <div className="bg-card border border-border rounded-2xl p-6 flex flex-col">
            <div className="mb-5">
              <p className="text-sm font-semibold text-foreground">
                {pendingPlan ? `Extras para el plan ${pendingPlan.name}` : "Extras"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {pendingPlan
                  ? "Añade usuarios o bonos de documentos a tu nuevo plan. Opcional."
                  : "Amplía tus límites en cualquier momento. Los cambios se prorratean."}
              </p>
            </div>

            {/* Already contracted — read-only info (only for active subscriptions) */}
            {isActive && (contractedUsers > 0 || contractedDocs > 0) && (
              <div className="mb-4 px-3 py-2.5 bg-muted/50 rounded-xl text-xs text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground text-[11px] uppercase tracking-wide mb-1">Actualmente contratado</p>
                {contractedUsers > 0 && <p>· {contractedUsers} usuario{contractedUsers !== 1 ? "s" : ""} adicional{contractedUsers !== 1 ? "es" : ""}</p>}
                {contractedDocs > 0 && <p>· {contractedDocs} bono{contractedDocs !== 1 ? "s" : ""} de documentos</p>}
              </div>
            )}

            <div className="flex-1">
              <AddonStepper
                label={ADDONS.extraUser.label}
                sublabel={ADDONS.extraUser.sublabel}
                value={extraUsers}
                onChange={setExtraUsers}
                price={ADDONS.extraUser.priceLabel}
              />
              <AddonStepper
                label={ADDONS.extraDocs.label}
                sublabel={ADDONS.extraDocs.sublabel}
                value={extraDocs}
                onChange={setExtraDocs}
                price={ADDONS.extraDocs.priceLabel}
              />
            </div>

            {/* Cost summary */}
            {(addonsChanged || pendingPlan) && (
              <div className="mt-4 pt-4 border-t border-border space-y-1.5 text-sm">

                {/* Plan line — only when buying a new plan */}
                {pendingPlan && (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Resumen del pedido</p>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Plan {pendingPlan.name}</span>
                      <span>{pendingPlan.price.toFixed(2).replace(".", ",")} €/mes</span>
                    </div>
                  </>
                )}

                {/* Recurring extras */}
                {extraUsers > 0 && (
                  <>
                    {!pendingPlan && (
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {isActive ? "Cambio recurrente" : "Recurrente / mes"}
                      </p>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>
                        {isActive
                          ? `+${extraUsers} usuario${extraUsers !== 1 ? "s" : ""} nuevo${extraUsers !== 1 ? "s" : ""}`
                          : `${extraUsers} usuario${extraUsers !== 1 ? "s" : ""} extra`}
                      </span>
                      <span>+{newUsersCost.toFixed(2).replace(".", ",")} €/mes</span>
                    </div>
                  </>
                )}

                {/* Total monthly */}
                {(pendingPlan || extraUsers > 0) && (
                  <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border">
                    <span>{pendingPlan ? "Total mensual" : "Nuevo total mensual"}</span>
                    <span>{totalCost.toFixed(2).replace(".", ",")} €</span>
                  </div>
                )}

                {/* One-time doc bonos */}
                {extraDocs > 0 && (() => {
                  const oneTimeCost = extraDocs * ADDONS.extraDocs.price
                  return (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pt-3">Pago único (hoy)</p>
                      <div className="flex justify-between text-muted-foreground">
                        <span>{extraDocs} bono{extraDocs !== 1 ? "s" : ""} × 250 docs</span>
                        <span>{oneTimeCost.toFixed(2).replace(".", ",")} €</span>
                      </div>
                      <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border">
                        <span>Total a cobrar hoy</span>
                        <span className="text-primary">{oneTimeCost.toFixed(2).replace(".", ",")} €</span>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}

            {/* Action buttons */}
            {pendingPlan ? (
              /* Pre-checkout: go to Stripe with selected plan + extras */
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => handleCheckout(pendingPlan.id, extraUsers, extraDocs)}
                  disabled={!!redirecting}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {redirecting === "checkout" ? "Redirigiendo..." : `Contratar plan ${pendingPlan.name}`}
                </button>
                <button
                  onClick={() => { setPendingPlanId(null); setExtraUsers(0); setExtraDocs(0) }}
                  className="px-4 py-2.5 border border-border text-sm rounded-xl hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : addonsChanged && isActive ? (
              /* Active subscription: save addon changes */
              <div className="mt-4 flex items-center gap-2">
                <button onClick={handleSaveAddons} disabled={saving}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors">
                  {saving ? "Aplicando cambios..." : "Confirmar y aplicar"}
                </button>
                <button
                  onClick={() => { setExtraUsers(0); setExtraDocs(0); setAddonMsg(null) }}
                  className="px-4 py-2.5 border border-border text-sm rounded-xl hover:bg-muted transition-colors">
                  Cancelar
                </button>
              </div>
            ) : addonsChanged && !isActive && !pendingPlan ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Selecciona un plan de pago para activar estos extras.
              </p>
            ) : null}

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
