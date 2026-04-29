"use client"

import { useState } from "react"
import { Building2, Search, Plus, FileText, MoreHorizontal, ChevronRight, MapPin, Phone, Mail, X } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useOrganization } from "@/lib/context/organization-context"
import { useCompanies } from "@/lib/hooks/use-companies"
import { createClient } from "@/lib/supabase/client"

const AVATAR_COLORS = ["bg-blue-500", "bg-emerald-600", "bg-violet-600", "bg-orange-500", "bg-rose-600"]

// ── Create company modal ──────────────────────────────────────────────────────
function CreateCompanyModal({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: () => void }) {
  const t = useTranslations("companies")
  const [form, setForm] = useState({ name: "", cif: "", sector: "", city: "", phone: "", email: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true); setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.from("companies").insert({
      organization_id: orgId,
      name: form.name.trim(),
      cif: form.cif.trim() || null,
      sector: form.sector.trim() || null,
      city: form.city.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      is_active: true,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onCreated()
    onClose()
  }

  const inputCls = "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("addCompany")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Añade los datos de la empresa o cliente</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("fields.name")} *</label>
            <input required placeholder="Construcciones García SL" value={form.name} onChange={set("name")} disabled={saving} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("fields.cif")}</label>
              <input placeholder="B12345678" value={form.cif} onChange={set("cif")} disabled={saving} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("fields.sector")}</label>
              <input placeholder="Construcción" value={form.sector} onChange={set("sector")} disabled={saving} className={inputCls} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("fields.city")}</label>
            <input placeholder="Madrid" value={form.city} onChange={set("city")} disabled={saving} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("fields.phone")}</label>
              <input placeholder="+34 600 000 000" value={form.phone} onChange={set("phone")} disabled={saving} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("fields.email")}</label>
              <input type="email" placeholder="info@empresa.es" value={form.email} onChange={set("email")} disabled={saving} className={inputCls} />
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={saving || !form.name.trim()}
              className="flex-1 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? "Guardando..." : "Crear empresa"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function EmpresasView() {
  const t = useTranslations("companies")
  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const { currentOrg } = useOrganization()
  const { companies, loading, mutate } = useCompanies(currentOrg?.id ?? null)

  const empresas = companies.map((company, index) => ({
    id: company.id,
    name: company.name,
    cif: company.cif,
    sector: company.sector || "General",
    city: company.city || "—",
    phone: company.phone || "—",
    email: company.email || "—",
    docs: 0,
    total: `${company.total_invoiced.toFixed(2)} €`,
    color: AVATAR_COLORS[index % AVATAR_COLORS.length],
    initials: company.name.split(" ").slice(0, 2).map((w: string) => w[0]).join(""),
  }))

  const filtered = empresas.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.cif.toLowerCase().includes(search.toLowerCase()) ||
      e.sector.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      {showCreate && currentOrg && (
        <CreateCompanyModal
          orgId={currentOrg.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => mutate()}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("subtitle", { count: empresas.length })}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />{t("addCompany")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
          <p className="text-muted-foreground text-sm">{t("loading")}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <p className="text-base font-semibold text-foreground mb-1">
            {search ? "Sin resultados" : "No hay empresas todavía"}
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            {search ? "Prueba con otro término de búsqueda" : t("noCompanies")}
          </p>
          {!search && currentOrg && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> Añadir primera empresa
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {filtered.map((empresa) => (
            <div key={empresa.id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow group">
              <div className="h-1.5 bg-primary" />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold", empresa.color)}>
                      {empresa.initials}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-sm leading-tight">{empresa.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("fields.cif")}: {empresa.cif}</p>
                    </div>
                  </div>
                  <button className="p-1 rounded hover:bg-muted transition-colors">
                    <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{empresa.city} · {empresa.sector}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{empresa.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{empresa.email}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-1.5 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-foreground">{empresa.docs}</span>
                    <span className="text-muted-foreground">{t("docs")}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{t("totalBilled")}</p>
                    <p className="text-sm font-semibold text-foreground">{empresa.total}</p>
                  </div>
                </div>
              </div>

              <div className="px-5 pb-4">
                <Link
                  href={`/biblioteca?empresa=${empresa.id}`}
                  className="flex items-center justify-center gap-2 w-full py-2 text-xs font-medium text-accent border border-accent/30 rounded-lg hover:bg-accent/5 transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  {t("viewDocuments")}
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
