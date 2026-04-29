"use client"

import { useState, useEffect } from "react"
import { Settings, Copy, Check, Save } from "lucide-react"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { useOrganization } from "@/lib/context/organization-context"

// ── Access code card ──────────────────────────────────────────────────────────
function AccessCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex items-center justify-between gap-4 p-4 bg-accent/5 border border-accent/20 rounded-xl">
      <div>
        <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-0.5">Código de empresa</p>
        <p className="text-xs text-muted-foreground">Comparte este código con tus usuarios para que puedan iniciar sesión</p>
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
          Configuración
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gestiona los datos y preferencias de tu organización</p>
      </div>

      <form onSubmit={handleSave}>
        {(currentOrg as any)?.access_code && (
          <Section title="Acceso" description="Código que tus usuarios necesitan para iniciar sesión.">
            <AccessCodeCard code={(currentOrg as any).access_code} />
          </Section>
        )}

        <Section title="Identidad" description="Nombre e identificación fiscal de tu organización.">
          <div className="space-y-4">
            <Field label={t("name")} value={form.name} onChange={set("name")} disabled={saving} />
            <Field label={t("cif")}  value={form.cif}  onChange={set("cif")}  disabled={saving} />
          </div>
        </Section>

        <Section title="Contacto" description="Datos de contacto de la organización.">
          <div className="space-y-4">
            <Field label={t("phone")} value={form.phone} onChange={set("phone")} disabled={saving} />
            <Field label={t("email")} value={form.email} onChange={set("email")} type="email" disabled={saving} />
          </div>
        </Section>

        <Section title="Dirección" description="Dirección fiscal o de operaciones.">
          <div className="space-y-4">
            <Field label={t("address")} value={form.address} onChange={set("address")} disabled={saving} />
            <div className="grid grid-cols-2 gap-4">
              <Field label={t("city")}    value={form.city}    onChange={set("city")}    disabled={saving} />
              <Field label={t("country")} value={form.country} onChange={set("country")} disabled={saving} />
            </div>
          </div>
        </Section>

        <div className="flex items-center gap-3 pt-6">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? t("saving") : t("save")}
          </button>
          {saved  && <span className="flex items-center gap-1.5 text-sm text-accent"><Check className="w-4 h-4" /> Guardado correctamente</span>}
          {error  && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </form>
    </div>
  )
}
