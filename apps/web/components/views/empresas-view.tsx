"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import {
  Building2, Search, Plus, FileText, MoreHorizontal, ChevronRight,
  MapPin, Phone, Mail, X, Pencil, Trash2, PauseCircle, PlayCircle, Eye,
  LayoutGrid, List,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useOrganization } from "@/lib/context/organization-context"
import { useCompanies } from "@/lib/hooks/use-companies"
import { useBilling } from "@/lib/hooks/use-billing"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Coachmark } from "@/components/coachmark"

const AVATAR_COLORS = ["bg-blue-500", "bg-emerald-600", "bg-violet-600", "bg-orange-500", "bg-rose-600"]

// Sentinel for the "no sector" filter chip / group
const NO_SECTOR = "__no_sector__"

function SectorChip({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn("text-[10px] tabular-nums", active ? "text-primary-foreground/75" : "text-muted-foreground/60")}>
          {count}
        </span>
      )}
    </button>
  )
}

type CompanyForm = { name: string; cif: string; sector: string; address: string; postal_code: string; city: string; province: string; phone: string; email: string }

// ── Shared company form modal ─────────────────────────────────────────────────
function CompanyModal({
  orgId, initial, knownSectors = [], onClose, onSaved,
}: {
  orgId: string
  initial?: { id: string } & CompanyForm
  knownSectors?: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const t       = useTranslations("companies")
  const tCommon = useTranslations("common")
  const isEdit  = !!initial

  const [form, setForm] = useState<CompanyForm>(
    initial ?? { name: "", cif: "", sector: "", address: "", postal_code: "", city: "", province: "", phone: "", email: "" }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const set = (k: keyof CompanyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true); setError(null)
    const supabase = createClient()

    const payload = {
      name:        form.name.trim(),
      cif:         form.cif.trim()         || null,
      sector:      form.sector.trim()      || null,
      address:     form.address.trim()     || null,
      postal_code: form.postal_code.trim() || null,
      city:        form.city.trim()        || null,
      province:    form.province.trim()    || null,
      phone:       form.phone.trim()       || null,
      email:       form.email.trim()       || null,
    }

    const { error: err } = isEdit
      ? await supabase.from("companies").update(payload).eq("id", initial!.id)
      : await supabase.from("companies").insert({ ...payload, organization_id: orgId, is_active: true })

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
    onClose()
  }

  const inputCls = "w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {isEdit ? t("editCompany") : t("addCompany")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t("addCompanyHint")}</p>
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
              <input list="company-sectors" placeholder="Construcción" value={form.sector} onChange={set("sector")} disabled={saving} className={inputCls} />
              <datalist id="company-sectors">
                {knownSectors.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("fields.address")}</label>
            <input placeholder="Calle Mayor 1" value={form.address} onChange={set("address")} disabled={saving} className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("fields.postalCode")}</label>
              <input placeholder="28001" value={form.postal_code} onChange={set("postal_code")} disabled={saving} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("fields.city")}</label>
              <input placeholder="Madrid" value={form.city} onChange={set("city")} disabled={saving} className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("fields.province")}</label>
              <input placeholder="Madrid" value={form.province} onChange={set("province")} disabled={saving} className={inputCls} />
            </div>
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
              {saving ? tCommon("saving") : isEdit ? tCommon("saveChanges") : t("createCompany")}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
              {tCommon("cancel")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Upgrade modal ─────────────────────────────────────────────────────────────
function UpgradeModal({ onClose, isFreePlan }: { onClose: () => void; isFreePlan: boolean }) {
  const router = useRouter()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <h2 className="text-base font-semibold text-foreground mb-1">
          {isFreePlan ? "Límite del plan gratuito" : "Límite de clientes alcanzado"}
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          {isFreePlan
            ? "El plan gratuito incluye 1 cliente. Actualiza al plan Pro para gestionar hasta 20 clientes, o añade clientes extra a partir de 2 €/cliente/mes."
            : "Has alcanzado el límite de clientes de tu plan. Añade clientes extra desde Facturación a partir de 2 €/cliente/mes."}
        </p>
        <div className="space-y-2">
          {isFreePlan && (
            <button
              onClick={() => { router.push("/configuracion/billing"); onClose() }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
            >
              Ver planes — 7 días gratis
            </button>
          )}
          <button
            onClick={() => { router.push("/configuracion/billing"); onClose() }}
            className={cn(
              "w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border transition-colors",
              isFreePlan ? "border-border text-foreground hover:bg-muted" : "bg-primary text-primary-foreground border-transparent hover:bg-primary/90"
            )}
          >
            {isFreePlan ? "Añadir clientes extra" : "Gestionar clientes extra"}
          </button>
          <button onClick={onClose} className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function EmpresasView() {
  const t       = useTranslations("companies")
  const tCommon = useTranslations("common")
  const tHints  = useTranslations("coachmarks")

  const [search,       setSearch]       = useState("")
  const [selectedSector, setSelectedSector] = useState<string | null>(null)
  const [viewMode,     setViewMode]     = useState<"grid" | "list">("grid")
  const [showCreate,   setShowCreate]   = useState(false)
  const [showUpgrade,  setShowUpgrade]  = useState(false)
  const [editTarget,   setEditTarget]   = useState<null | { id: string } & CompanyForm>(null)
  const [openMenuId,   setOpenMenuId]   = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)

  const { currentOrg } = useOrganization()
  const { companies, loading, mutate } = useCompanies(currentOrg?.id ?? null)
  const { billing } = useBilling(currentOrg?.id ?? null)

  const maxCompanies  = billing?.maxCompanies ?? 1
  const isFreePlan    = !billing?.hasSubscription
  const atLimit       = companies.length >= maxCompanies

  function handleAddClick() {
    if (atLimit) { setShowUpgrade(true); return }
    setShowCreate(true)
  }

  // Remember the chosen layout across visits
  useEffect(() => {
    const saved = localStorage.getItem("clientes-view-mode")
    if (saved === "grid" || saved === "list") setViewMode(saved)
  }, [])
  const changeViewMode = (mode: "grid" | "list") => {
    setViewMode(mode)
    localStorage.setItem("clientes-view-mode", mode)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setOpenMenuId(null)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setOpenMenuId(null)
    const supabase = createClient()
    await supabase.from("companies").update({ is_active: !currentActive }).eq("id", id)
    await mutate()
  }

  const handleDelete = async (id: string, name: string) => {
    setOpenMenuId(null)
    if (!confirm(t("deleteCompanyConfirm"))) return
    const supabase = createClient()
    await supabase.from("companies").delete().eq("id", id)
    await mutate()
  }

  const empresas = companies.map((company, index) => ({
    id:          company.id,
    name:        company.name,
    cif:         company.cif    ?? "",
    sector:      company.sector ?? "",
    address:     company.address     ?? "",
    postal_code: company.postal_code ?? "",
    city:        company.city   ?? "",
    province:    company.province ?? "",
    phone:       company.phone  ?? "",
    email:       company.email  ?? "",
    isActive:    company.is_active ?? true,
    docs:      company.doc_count,
    color:     AVATAR_COLORS[index % AVATAR_COLORS.length],
    initials:  company.name.split(" ").slice(0, 2).map((w: string) => w[0] ?? "").join(""),
  }))

  // Distinct sectors present (for filter chips + datalist)
  const sectors = useMemo(
    () =>
      Array.from(new Set(empresas.map(e => e.sector.trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b)),
    [empresas],
  )
  const hasNoSector = useMemo(() => empresas.some(e => !e.sector.trim()), [empresas])
  const countBySector = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of empresas) {
      const k = e.sector.trim() || NO_SECTOR
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [empresas])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return empresas.filter(e => {
      const matchesSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.cif.toLowerCase().includes(q) ||
        e.sector.toLowerCase().includes(q) ||
        e.city.toLowerCase().includes(q)
      const matchesSector =
        !selectedSector ||
        (selectedSector === NO_SECTOR ? !e.sector.trim() : e.sector.trim() === selectedSector)
      return matchesSearch && matchesSector
    })
  }, [empresas, search, selectedSector])

  // Divide into sections per sector when no single sector is selected
  const groups = useMemo(() => {
    if (selectedSector !== null || sectors.length === 0) return null
    const m = new Map<string, typeof filtered>()
    for (const e of filtered) {
      const k = e.sector.trim() || NO_SECTOR
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(e)
    }
    return Array.from(m.keys())
      .sort((a, b) => (a === NO_SECTOR ? 1 : b === NO_SECTOR ? -1 : a.localeCompare(b)))
      .map(k => ({ key: k, label: k === NO_SECTOR ? t("noSector") : k, items: m.get(k)! }))
  }, [filtered, selectedSector, sectors, t])

  type EmpresaCard = (typeof empresas)[number]

  const renderMenu = (empresa: EmpresaCard) => (
    <div className="relative shrink-0">
      <button
        onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === empresa.id ? null : empresa.id) }}
        className={cn(
          "p-1.5 rounded-lg transition-all",
          openMenuId === empresa.id
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {openMenuId === empresa.id && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
          {/* Ver documentos */}
          <Link
            href={`/biblioteca?empresa=${empresa.id}`}
            onClick={() => setOpenMenuId(null)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            {t("viewDocuments")}
          </Link>

          {/* Editar */}
          <button
            onClick={() => {
              setOpenMenuId(null)
              setEditTarget({
                id:          empresa.id,
                name:        empresa.name,
                cif:         empresa.cif,
                sector:      empresa.sector,
                address:     empresa.address,
                postal_code: empresa.postal_code,
                city:        empresa.city,
                province:    empresa.province,
                phone:       empresa.phone,
                email:       empresa.email,
              })
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            {tCommon("edit")}
          </button>

          {/* Suspender / Reactivar */}
          <button
            onClick={() => handleToggleActive(empresa.id, empresa.isActive)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            {empresa.isActive
              ? <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
              : <PlayCircle  className="w-3.5 h-3.5 text-emerald-500" />
            }
            {empresa.isActive ? t("suspend") : t("reactivate")}
          </button>

          <div className="border-t border-border" />

          {/* Eliminar */}
          <button
            onClick={() => handleDelete(empresa.id, empresa.name)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/8 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t("deleteCompany")}
          </button>
        </div>
      )}
    </div>
  )

  const renderCard = (empresa: EmpresaCard) => (
            <div
              key={empresa.id}
              className={cn(
                "bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow relative",
                !empresa.isActive && "opacity-60"
              )}
            >
              {/* Suspended banner */}
              {!empresa.isActive && (
                <div className="absolute top-0 inset-x-0 h-1 bg-amber-500" />
              )}
              {empresa.isActive && <div className="h-1.5 bg-primary" />}

              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0", empresa.color)}>
                      {empresa.initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground text-sm leading-tight">{empresa.name}</h3>
                        {!empresa.isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                            {t("suspended")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("fields.cif")}: {empresa.cif || "—"}</p>
                    </div>
                  </div>

                  {/* ··· menu */}
                  {renderMenu(empresa)}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{empresa.city || "—"} · {empresa.sector || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{empresa.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{empresa.email || "—"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-1.5 text-sm">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-foreground">{empresa.docs}</span>
                    <span className="text-muted-foreground">{t("docs")}</span>
                  </div>
                  {empresa.cif && (
                    <p className="text-xs text-muted-foreground font-mono">{empresa.cif}</p>
                  )}
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
  )

  const renderRow = (empresa: EmpresaCard) => (
    <div
      key={empresa.id}
      className={cn(
        "flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors first:rounded-t-xl last:rounded-b-xl",
        !empresa.isActive && "opacity-60"
      )}
    >
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0", empresa.color)}>
        {empresa.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{empresa.name}</p>
          {!empresa.isActive && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              {t("suspended")}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {empresa.city || "—"} · {empresa.sector || "—"}
        </p>
      </div>
      <span className="hidden sm:block w-28 shrink-0 text-xs text-muted-foreground font-mono truncate">{empresa.cif || "—"}</span>
      <span className="hidden lg:block w-48 shrink-0 text-xs text-muted-foreground truncate">{empresa.email || "—"}</span>
      <span className="hidden md:block w-32 shrink-0 text-xs text-muted-foreground truncate">{empresa.phone || "—"}</span>
      <span className="hidden sm:flex items-center gap-1.5 w-16 shrink-0 justify-end text-sm">
        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-semibold text-foreground tabular-nums">{empresa.docs}</span>
      </span>
      {renderMenu(empresa)}
    </div>
  )

  return (
    <div className="p-8">
      {/* Upgrade modal */}
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} isFreePlan={isFreePlan} />}

      {/* Create modal */}
      {showCreate && currentOrg && (
        <CompanyModal
          orgId={currentOrg.id}
          knownSectors={sectors}
          onClose={() => setShowCreate(false)}
          onSaved={() => mutate()}
        />
      )}

      {/* Edit modal */}
      {editTarget && currentOrg && (
        <CompanyModal
          orgId={currentOrg.id}
          initial={editTarget}
          knownSectors={sectors}
          onClose={() => setEditTarget(null)}
          onSaved={() => mutate()}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("subtitle", { count: empresas.length })}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn(
            "text-xs font-medium px-3 py-1.5 rounded-full border",
            atLimit ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-muted text-muted-foreground border-border"
          )}>
            {t("limitCounter", { current: companies.length, max: maxCompanies })}
          </span>
          <div className="flex items-center bg-card border border-border rounded-lg p-0.5">
            <button
              onClick={() => changeViewMode("grid")}
              title={t("viewGrid")}
              aria-label={t("viewGrid")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => changeViewMode("list")}
              title={t("viewList")}
              aria-label={t("viewList")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9 py-2 text-sm bg-card border border-border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label={tCommon("clear")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button ref={addBtnRef} onClick={handleAddClick} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />{t("addCompany")}
          </button>
        </div>
      </div>

      {/* Sector filter chips */}
      {sectors.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-6">
          <SectorChip label={t("allSectors")} count={empresas.length} active={selectedSector === null} onClick={() => setSelectedSector(null)} />
          {sectors.map(s => (
            <SectorChip key={s} label={s} count={countBySector.get(s) ?? 0} active={selectedSector === s} onClick={() => setSelectedSector(s)} />
          ))}
          {hasNoSector && (
            <SectorChip label={t("noSector")} count={countBySector.get(NO_SECTOR) ?? 0} active={selectedSector === NO_SECTOR} onClick={() => setSelectedSector(NO_SECTOR)} />
          )}
        </div>
      )}

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
            {(search || selectedSector) ? t("noResults") : t("noCompanies")}
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            {(search || selectedSector) ? t("noResultsHint") : ""}
          </p>
          {!search && !selectedSector && currentOrg && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" /> {t("addFirstCompany")}
            </button>
          )}
        </div>
      ) : (
        <div ref={menuRef} className="space-y-8">
          {(groups ?? [{ key: "__all__", label: "", items: filtered }]).map(g => (
            <div key={g.key}>
              {g.label && (
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-foreground">{g.label}</h2>
                  <span className="text-xs text-muted-foreground tabular-nums">{g.items.length}</span>
                </div>
              )}
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {g.items.map(renderCard)}
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl divide-y divide-border/60">
                  {g.items.map(renderRow)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* First-time hint */}
      {companies.length === 0 && !loading && (
        <Coachmark
          id="empresas-create-first"
          targetRef={addBtnRef}
          title={tHints("empresasCreateFirst.title")}
          description={tHints("empresasCreateFirst.description")}
          placement="bottom"
        />
      )}
    </div>
  )
}
