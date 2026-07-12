"use client"

import { useState, useEffect, useRef } from "react"
import { Settings, Copy, Check, Save, HelpCircle, Sparkles, Mail, Inbox, AlertTriangle, Zap, FileText, Users, Building2, TrendingUp, Upload, Trash2, Loader2, ImageOff } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useOrganization } from "@/lib/context/organization-context"
import { TutorialModal, resetTutorial } from "@/components/tutorial-modal"
import { CancellationModal } from "@/components/cancellation-modal"
import { PLANS, ADDONS, type PlanId } from "@/lib/pricing"

// ── Access code card ──────────────────────────────────────────────────────────
function AccessCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const tRoot = useTranslations("settings")
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-accent/5 border border-accent/20 rounded-xl">
      <div>
        <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-0.5">{tRoot("accessCode.label")}</p>
        <p className="text-xs text-muted-foreground">{tRoot("accessCode.hint")}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-2xl font-mono font-bold text-foreground tracking-widest bg-muted px-4 py-2 rounded-lg">{code}</span>
        <button type="button" onClick={copy} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ── Inbox email card ──────────────────────────────────────────────────────────
function InboxEmailCard({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const domain = process.env.NEXT_PUBLIC_INBOX_DOMAIN ?? "inbox.archivum.app"
  const address = `${token}@${domain}`
  const copy = () => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Inbox className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">Tu dirección de importación</p>
          </div>
          <p className="text-sm font-mono font-semibold text-foreground break-all">{address}</p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-card border border-border rounded-lg hover:bg-muted transition-colors"
        >
          {copied
            ? <><Check className="w-3.5 h-3.5 text-accent" /> Copiado</>
            : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
        </button>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
        <p className="font-semibold text-foreground">Cómo funciona:</p>
        <ol className="space-y-1.5 ml-4 list-decimal">
          <li>Reenvía facturas, recibos o albaranes a esta dirección desde tu correo corporativo.</li>
          <li>Pon esta dirección en copia (CC/BCC) cuando recibas documentos importantes.</li>
          <li>Configura una regla en tu correo para que reenvíe automáticamente los emails de proveedores específicos.</li>
        </ol>
        <p className="pt-1">Cualquier PDF o imagen adjunto se subirá automáticamente como un documento pendiente de procesar.</p>
      </div>
    </div>
  )
}

// ── Company logo card ──────────────────────────────────────────────────────────
const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }

function LogoCard({ orgId, logoUrl, onUploaded }: { orgId: string; logoUrl: string | null; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    const ext = ALLOWED_LOGO_TYPES[file.type]
    if (!ext) { setError("Formato no soportado. Usa PNG, JPG o WEBP."); return }
    if (file.size > MAX_LOGO_BYTES) { setError("El archivo pesa más de 2MB."); return }

    setUploading(true)
    try {
      const supabase = createClient()
      const path = `${orgId}/logo.${ext}`
      const { error: upErr } = await supabase.storage
        .from("logos")
        .upload(path, file, { contentType: file.type, upsert: true })
      if (upErr) { setError(upErr.message); setUploading(false); return }

      const { data: pub } = supabase.storage.from("logos").getPublicUrl(path)
      // Cache-bust so the new logo shows immediately even at the same path
      const bustedUrl = `${pub.publicUrl}?v=${Date.now()}`

      const { error: dbErr } = await supabase.from("organizations")
        .update({ logo_url: bustedUrl }).eq("id", orgId)
      if (dbErr) { setError(dbErr.message); setUploading(false); return }

      onUploaded()
    } catch (e) {
      setError(String(e))
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    setError(null); setUploading(true)
    const supabase = createClient()
    const { error: dbErr } = await supabase.from("organizations").update({ logo_url: null }).eq("id", orgId)
    setUploading(false)
    if (dbErr) { setError(dbErr.message); return }
    onUploaded()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {logoUrl
            ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            : <ImageOff className="w-5 h-5 text-muted-foreground/50" />}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = "" }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-card border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {logoUrl ? "Cambiar logo" : "Subir logo"}
          </button>
          {logoUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">PNG, JPG o WEBP · máx. 2MB. Aparecerá en tus facturas.</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ── Settings section ──────────────────────────────────────────────────────────
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[220px_1fr] gap-8 py-8 border-b border-border last:border-0">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, type = "text", disabled }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground disabled:opacity-50"
      />
    </div>
  )
}

// ── Main settings view ────────────────────────────────────────────────────────
export function SettingsView() {
  const t = useTranslations("settings.organization")
  const tRoot = useTranslations("settings")
  const { currentOrg, refreshOrganization } = useOrganization()

  const [form, setForm] = useState({
    name:    currentOrg?.name ?? "",
    cif:     currentOrg?.cif ?? "",
    address: currentOrg?.address ?? "",
    city:    currentOrg?.city ?? "",
    country: currentOrg?.country ?? "",
    phone:   currentOrg?.phone ?? "",
    email:   currentOrg?.email ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [tutorialOpen, setTutorialOpen]         = useState(false)
  const [cancelModalOpen, setCancelModalOpen]   = useState(false)
  const [cancelSuccess, setCancelSuccess]       = useState(false)

  // Billing state
  const [billing, setBilling] = useState<{
    plan: PlanId
    status: string
    quotaPool: number
    docCount: number
    memberCount: number
    companyCount: number
    periodEnd: string | null
  } | null>(null)

  useEffect(() => {
    if (!currentOrg?.id) return
    const supabase = createClient()
    Promise.all([
      supabase.from("organizations")
        .select("subscription_plan, subscription_status, doc_quota_pool, document_count, current_period_end")
        .eq("id", currentOrg.id)
        .single(),
      supabase.from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", currentOrg.id),
      supabase.from("companies")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", currentOrg.id),
    ]).then(([{ data: org }, { count: members }, { count: companies }]) => {
      if (!org) return
      setBilling({
        plan: (org.subscription_plan ?? "free") as PlanId,
        status: org.subscription_status ?? "active",
        quotaPool: org.doc_quota_pool ?? 0,
        docCount: org.document_count ?? 0,
        memberCount: members ?? 0,
        companyCount: companies ?? 0,
        periodEnd: org.current_period_end ?? null,
      })
    })
  }, [currentOrg?.id])

  const set = (key: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [key]: v }))

  // Sync form when org loads asynchronously
  useEffect(() => {
    if (currentOrg) {
      setForm({
        name:    currentOrg.name ?? "",
        cif:     currentOrg.cif ?? "",
        address: currentOrg.address ?? "",
        city:    currentOrg.city ?? "",
        country: currentOrg.country ?? "",
        phone:   currentOrg.phone ?? "",
        email:   currentOrg.email ?? "",
      })
    }
  }, [currentOrg?.id])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentOrg) return
    setSaving(true); setSaved(false); setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from("organizations").update({
      name:    form.name.trim(),
      cif:     form.cif.trim() || null,
      address: form.address.trim() || null,
      city:    form.city.trim() || null,
      country: form.country.trim(),
      phone:   form.phone.trim() || null,
      email:   form.email.trim() || null,
    }).eq("id", currentOrg.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    await refreshOrganization()
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8 pb-6 border-b border-border">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6" />
          {tRoot("title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{tRoot("subtitle")}</p>
      </div>

      <form onSubmit={handleSave}>
        {(currentOrg as any)?.access_code && (
          <Section title={tRoot("sections.access")} description={tRoot("sections.accessDesc")}>
            <AccessCodeCard code={(currentOrg as any).access_code} />
          </Section>
        )}

        {(currentOrg as any)?.inbox_token && (
          <Section
            title="Importación por correo"
            description="Reenvía facturas a esta dirección y se importarán automáticamente."
          >
            <InboxEmailCard token={(currentOrg as any).inbox_token} />
          </Section>
        )}

        <Section title={tRoot("sections.identity")} description={tRoot("sections.identityDesc")}>
          <div className="space-y-5">
            {currentOrg && (
              <LogoCard
                orgId={currentOrg.id}
                logoUrl={currentOrg.logo_url ?? null}
                onUploaded={refreshOrganization}
              />
            )}
            <Field label={t("name")} value={form.name} onChange={set("name")} disabled={saving} />
            <Field label={t("cif")}  value={form.cif}  onChange={set("cif")}  disabled={saving} />
          </div>
        </Section>

        <Section title={tRoot("sections.contact")} description={tRoot("sections.contactDesc")}>
          <div className="space-y-4">
            <Field label={t("phone")} value={form.phone} onChange={set("phone")} disabled={saving} />
            <Field label={t("email")} value={form.email} onChange={set("email")} type="email" disabled={saving} />
          </div>
        </Section>

        <Section title={tRoot("sections.address")} description={tRoot("sections.addressDesc")}>
          <div className="space-y-4">
            <Field label={t("address")} value={form.address} onChange={set("address")} disabled={saving} />
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("city")}    value={form.city}    onChange={set("city")}    disabled={saving} />
              <Field label={t("country")} value={form.country} onChange={set("country")} disabled={saving} />
            </div>
          </div>
        </Section>

        {/* ── Billing / Plan ─────────────────────────────────────────────── */}
        <Section title="Plan y facturación" description="Tu suscripción actual, uso de cuota y opciones de mejora.">
          {billing ? (() => {
            const plan = PLANS[billing.plan]
            const monthlyDocs = plan.docsPerMonth
            const quotaUsedPercent = Math.min(100, Math.round(((monthlyDocs - billing.quotaPool) / monthlyDocs) * 100))
            const periodEndLabel = billing.periodEnd
              ? new Date(billing.periodEnd).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
              : null

            return (
              <div className="space-y-5">
                {/* Current plan badge */}
                <div className="flex items-center justify-between gap-4 p-4 border border-border rounded-xl bg-card">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Plan {plan.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {plan.price === 0 ? "Gratuito · para siempre" : `${plan.priceLabel}/mes`}
                        {periodEndLabel && ` · Próxima renovación: ${periodEndLabel}`}
                      </p>
                    </div>
                  </div>
                  <span className={cn(
                    "shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full",
                    billing.status === "active"
                      ? "bg-accent/10 text-accent"
                      : billing.status === "canceled"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-yellow-500/10 text-yellow-600"
                  )}>
                    {billing.status === "active" ? "Activo" : billing.status === "canceled" ? "Cancelado" : "Pendiente"}
                  </span>
                </div>

                {/* Quota bars */}
                <div className="space-y-3">
                  {/* Documents */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <FileText className="w-3.5 h-3.5" /> Documentos disponibles
                      </span>
                      <span className="text-muted-foreground">
                        {billing.quotaPool.toLocaleString("es-ES")} restantes de {monthlyDocs.toLocaleString("es-ES")} acumulados
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", quotaUsedPercent > 90 ? "bg-destructive" : "bg-primary")}
                        style={{ width: `${quotaUsedPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Members */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <Users className="w-3.5 h-3.5" /> Usuarios
                      </span>
                      <span className="text-muted-foreground">{billing.memberCount} activos</span>
                    </div>
                  </div>

                  {/* Companies */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <Building2 className="w-3.5 h-3.5" /> Empresas gestionadas
                      </span>
                      <span className="text-muted-foreground">{billing.companyCount} empresas</span>
                    </div>
                  </div>
                </div>

                {/* Upgrade options (only for free/starter) */}
                {billing.plan !== "pro" && (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-muted/40 border-b border-border">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-primary" /> Mejorar plan
                      </p>
                    </div>
                    <div className="divide-y divide-border">
                      {(Object.values(PLANS) as typeof PLANS[keyof typeof PLANS][]).filter(p => p.price > (plan.price)).map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{p.name} {p.badge && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">{p.badge}</span>}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{p.docsPerMonth.toLocaleString("es-ES")} docs/mes · {p.priceLabel}{p.price > 0 ? "/mes" : ""}</p>
                          </div>
                          <a
                            href={`mailto:hola@archivum.app?subject=Quiero mejorar al plan ${p.name}`}
                            className="shrink-0 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            Mejorar
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add-ons */}
                {billing.plan !== "free" && (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-muted/40 border-b border-border">
                      <p className="text-xs font-semibold text-foreground">Complementos disponibles</p>
                    </div>
                    <div className="divide-y divide-border">
                      {Object.values(ADDONS).map(addon => (
                        <div key={addon.label} className="flex items-center justify-between gap-4 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{addon.label}</p>
                            <p className="text-xs text-muted-foreground">{addon.sublabel}</p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-foreground">{addon.priceLabel}</span>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2.5 bg-muted/20 border-t border-border">
                      <p className="text-xs text-muted-foreground">Para adquirir complementos, contacta con <a href="mailto:hola@archivum.app" className="text-primary hover:underline">hola@archivum.app</a></p>
                    </div>
                  </div>
                )}
              </div>
            )
          })() : (
            <div className="h-24 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </Section>

        <Section title="Ayuda" description="Aprende cómo aprovechar Archivum al máximo.">
          <button
            type="button"
            onClick={() => { resetTutorial(); setTutorialOpen(true); }}
            className="flex items-center gap-3 w-full px-4 py-3 bg-card border border-border rounded-xl hover:border-primary/40 hover:bg-muted/40 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">Ver tutorial de bienvenida</p>
              <p className="text-xs text-muted-foreground">Repasa cómo funciona Archivum paso a paso.</p>
            </div>
            <HelpCircle className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        </Section>

        {/* Danger zone — cancel subscription */}
        <Section
          title="Zona de peligro"
          description="Acciones irreversibles. Léelas con atención antes de proceder."
        >
          <div className="border border-destructive/30 rounded-xl p-5 space-y-3 bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Cancelar suscripción</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Al cancelar perderás acceso a la subida, descarga y edición de documentos. Tienes 15 días para descargar todo antes de que la cuenta y sus datos sean eliminados.
                </p>
              </div>
            </div>
            {cancelSuccess ? (
              <p className="text-sm text-accent font-medium">
                ✓ Suscripción cancelada. Recibirás un correo de confirmación.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setCancelModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-destructive border border-destructive/40 rounded-lg hover:bg-destructive/10 transition-colors"
              >
                Cancelar mi suscripción
              </button>
            )}
          </div>
        </Section>

        <div className="flex items-center gap-3 pt-6">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? t("saving") : t("save")}
          </button>
          {saved  && <span className="flex items-center gap-1.5 text-sm text-accent"><Check className="w-4 h-4" /> {t("savedOk")}</span>}
          {error  && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </form>

      <TutorialModal open={tutorialOpen} onClose={() => setTutorialOpen(false)} />

      <CancellationModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={async () => {
          if (!currentOrg) return
          const supabase = createClient()
          // Call Stripe cancellation via an API route (Stripe integration handles the rest)
          await fetch("/api/billing/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orgId: currentOrg.id }),
          })
          setCancelModalOpen(false)
          setCancelSuccess(true)
        }}
      />
    </div>
  )
}
