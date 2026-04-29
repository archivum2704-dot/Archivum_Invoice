"use client"

import { useState } from "react"
import {
  Users, Building2, Shield, Trash2, ChevronDown,
  UserPlus, CheckSquare, Square, X, Settings, Copy, Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase/client"
import { useOrganization } from "@/lib/context/organization-context"
import { useMembers, useMemberCompanyAccess, type OrgMember } from "@/lib/hooks/use-members"
import { useCompanies } from "@/lib/hooks/use-companies"
import type { OrgRole } from "@/lib/supabase/types"

const ROLE_COLORS: Record<OrgRole, string> = {
  owner:  "bg-accent/10 text-accent border-accent/20",
  admin:  "bg-primary/10 text-primary border-primary/20",
  member: "bg-muted text-foreground border-border",
  viewer: "bg-muted text-muted-foreground border-border",
}

// ── Company access panel for a single member ────────────────────────────────
function CompanyAccessPanel({
  member,
  orgId,
  onClose,
}: {
  member: OrgMember
  orgId: string
  onClose: () => void
}) {
  const t = useTranslations("settings.members")
  const { companies } = useCompanies(orgId)
  const { access, mutate } = useMemberCompanyAccess(orgId, member.user_id)

  const name = member.profile
    ? `${member.profile.first_name ?? ""} ${member.profile.last_name ?? ""}`.trim() || member.profile.email
    : member.user_id

  const hasAccess = (companyId: string) => access.some((a) => a.company_id === companyId)

  const toggleCompany = async (companyId: string) => {
    const supabase = createClient()
    if (hasAccess(companyId)) {
      await supabase
        .from("company_user_access")
        .delete()
        .eq("organization_id", orgId)
        .eq("user_id", member.user_id)
        .eq("company_id", companyId)
    } else {
      await supabase.from("company_user_access").insert({
        organization_id: orgId,
        user_id: member.user_id,
        company_id: companyId,
        can_upload: true,
        can_edit: false,
        can_delete: false,
      })
    }
    mutate()
  }

  const togglePermission = async (companyId: string, field: "can_upload" | "can_edit" | "can_delete") => {
    const supabase = createClient()
    const current = access.find((a) => a.company_id === companyId)
    if (!current) return
    await supabase
      .from("company_user_access")
      .update({ [field]: !current[field] })
      .eq("id", current.id)
    mutate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-foreground">{t("companyAccessTitle", { name })}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{t("companyAccessSubtitle")}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("noCompanies")}</p>
          ) : (
            <div className="space-y-3">
              {companies.map((company) => {
                const granted = hasAccess(company.id)
                const row = access.find((a) => a.company_id === company.id)
                return (
                  <div key={company.id} className={cn("rounded-xl border transition-colors", granted ? "border-accent/30 bg-accent/5" : "border-border bg-card")}>
                    <div className="flex items-center gap-3 p-3">
                      <button type="button" onClick={() => toggleCompany(company.id)} className="flex-shrink-0">
                        {granted
                          ? <CheckSquare className="w-5 h-5 text-accent" />
                          : <Square className="w-5 h-5 text-muted-foreground" />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{company.name}</p>
                        {company.cif && <p className="text-xs text-muted-foreground">{company.cif}</p>}
                      </div>
                    </div>

                    {granted && row && (
                      <div className="flex items-center gap-4 px-4 pb-3 pt-0">
                        {(["can_upload", "can_edit", "can_delete"] as const).map((field) => (
                          <label key={field} className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={row[field]}
                              onChange={() => togglePermission(company.id, field)}
                              className="w-3.5 h-3.5 accent-accent"
                            />
                            <span className="text-xs text-muted-foreground">{t(`permissions.${field}`)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Member row ───────────────────────────────────────────────────────────────
function MemberRow({
  member,
  orgId,
  currentUserId,
  isAdmin,
  onRefresh,
}: {
  member: OrgMember
  orgId: string
  currentUserId: string
  isAdmin: boolean
  onRefresh: () => void
}) {
  const t = useTranslations("settings.members")
  const [showAccess, setShowAccess] = useState(false)
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const [loading, setLoading] = useState(false)

  const profile = member.profile
  const name = profile
    ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || profile.email
    : "—"
  const initials = (profile?.first_name?.[0] ?? "") + (profile?.last_name?.[0] ?? "") || "?"
  const isSelf = member.user_id === currentUserId
  const canManage = isAdmin && !isSelf && member.role !== "owner"

  const handleRoleChange = async (newRole: OrgRole) => {
    setShowRoleMenu(false)
    setLoading(true)
    const supabase = createClient()
    await supabase.rpc("update_member_role", {
      p_org_id: orgId,
      p_user_id: member.user_id,
      p_new_role: newRole,
    })
    setLoading(false)
    onRefresh()
  }

  const handleRemove = async () => {
    if (!confirm(t("removeConfirm", { name }))) return
    setLoading(true)
    const supabase = createClient()
    await supabase.rpc("remove_org_member", {
      p_org_id: orgId,
      p_user_id: member.user_id,
    })
    setLoading(false)
    onRefresh()
  }

  return (
    <>
      <div className={cn("flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors", loading && "opacity-60 pointer-events-none")}>
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground truncate">{name}</p>
            {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
          </div>
          <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
        </div>

        <div className="flex items-center gap-2">
          {canManage ? (
            <div className="relative">
              <button
                onClick={() => setShowRoleMenu(!showRoleMenu)}
                className={cn("flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border", ROLE_COLORS[member.role])}
              >
                {t(`roles.${member.role}`)}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showRoleMenu && (
                <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-lg z-10 overflow-hidden w-36">
                  {(["admin", "member", "viewer"] as OrgRole[]).map((role) => (
                    <button
                      key={role}
                      onClick={() => handleRoleChange(role)}
                      className={cn("w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors", member.role === role && "font-semibold text-accent")}
                    >
                      {t(`roles.${role}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full border", ROLE_COLORS[member.role])}>
              {t(`roles.${member.role}`)}
            </span>
          )}

          {canManage && (member.role === "member" || member.role === "viewer") && (
            <button
              onClick={() => setShowAccess(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-2.5 py-1 hover:border-accent/50 transition-colors"
            >
              <Building2 className="w-3 h-3" />
              {t("companyAccess")}
            </button>
          )}

          {canManage && (
            <button onClick={handleRemove} className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {showAccess && (
        <CompanyAccessPanel member={member} orgId={orgId} onClose={() => setShowAccess(false)} />
      )}
    </>
  )
}

// ── Create member form (replaces old invite-by-RPC form) ────────────────────
function CreateMemberForm({ orgId, onSuccess }: { orgId: string; onSuccess: () => void }) {
  const t = useTranslations("settings.members")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName]   = useState("")
  const [email, setEmail]         = useState("")
  const [role, setRole]           = useState<OrgRole>("member")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)

  const inputCls = "px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground w-full"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    const res = await fetch("/api/members/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), firstName, lastName, role, orgId }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok || !data.success) {
      const key = data.error ?? "generic"
      const msgMap: Record<string, string> = {
        already_member: t("errors.already_member"),
        not_authorized: t("errors.not_authorized"),
        missing_fields: t("errors.generic"),
        server_error:   t("errors.generic"),
      }
      setError(msgMap[key] ?? t("errors.generic"))
      return
    }

    setSuccess(true)
    setFirstName(""); setLastName(""); setEmail("")
    setTimeout(() => { setSuccess(false); onSuccess() }, 1500)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-foreground">{t("createTitle")}</p>
      <p className="text-xs text-muted-foreground -mt-1">{t("createSubtitle")}</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">{t("firstName")}</label>
          <input type="text" placeholder="Ana" value={firstName} onChange={e => setFirstName(e.target.value)} disabled={loading} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">{t("lastName")}</label>
          <input type="text" placeholder="García" value={lastName} onChange={e => setLastName(e.target.value)} disabled={loading} className={inputCls} />
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">{t("emailLabel")}</label>
          <input type="email" placeholder={t("emailPlaceholder")} value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} className={inputCls} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">{t("roleLabel")}</label>
          <select value={role} onChange={e => setRole(e.target.value as OrgRole)} disabled={loading}
            className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-foreground h-[38px]">
            {(["admin", "member", "viewer"] as OrgRole[]).map(r => (
              <option key={r} value={r}>{t(`roles.${r}`)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={loading || !email.trim()}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap h-[38px]">
            {loading ? t("sending") : t("createUser")}
          </button>
        </div>
      </div>

      {error   && <p className="text-xs text-destructive">{error}</p>}
      {success && <p className="text-xs text-accent font-medium">✓ {t("createSuccess")}</p>}

      <p className="text-xs text-muted-foreground pt-1">{t("createHint")}</p>
    </form>
  )
}

// ── Organization edit form ───────────────────────────────────────────────────
function OrgForm({ orgId, initialData }: { orgId: string; initialData: {
  name: string; slug: string; cif: string | null; address: string | null
  city: string | null; country: string; phone: string | null; email: string | null
  access_code?: string | null
}}) {
  const t = useTranslations("settings.organization")
  const [form, setForm] = useState({
    name: initialData.name,
    cif: initialData.cif ?? "",
    address: initialData.address ?? "",
    city: initialData.city ?? "",
    country: initialData.country,
    phone: initialData.phone ?? "",
    email: initialData.email ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from("organizations")
      .update({
        name: form.name.trim(),
        cif: form.cif.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      })
      .eq("id", orgId)
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const field = (key: keyof typeof form, label: string, type = "text") => (
    <div key={key} className="grid grid-cols-[160px_1fr] items-center gap-4">
      <label className="text-sm text-muted-foreground text-right">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        disabled={saving}
        className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground w-full"
      />
    </div>
  )

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <h2 className="text-base font-semibold text-foreground">{t("title")}</h2>

      {/* Access code card */}
      {initialData.access_code && (
        <AccessCodeCard code={initialData.access_code} />
      )}

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        {field("name", t("name"))}
        {field("cif", t("cif"))}
        {field("address", t("address"))}
        {field("city", t("city"))}
        {field("country", t("country"))}
        {field("phone", t("phone"))}
        {field("email", t("email"), "email")}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? t("saving") : t("save")}
        </button>
        {saved && <span className="text-sm text-accent">✓ Guardado</span>}
      </div>
    </form>
  )
}

// ── Access code display ───────────────────────────────────────────────────────
function AccessCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-medium text-accent uppercase tracking-wide mb-1">Código de empresa</p>
        <p className="text-xs text-muted-foreground">Comparte este código con tus usuarios para que puedan iniciar sesión</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-2xl font-mono font-bold text-foreground tracking-widest bg-muted px-4 py-2 rounded-lg">{code}</span>
        <button type="button" onClick={copy}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ── Main settings view ───────────────────────────────────────────────────────
export function SettingsView() {
  const t = useTranslations("settings")
  const tMembers = useTranslations("settings.members")
  const { currentOrg, userProfile, isOrgAdmin, loading: orgLoading } = useOrganization()
  const { members, loading: membersLoading, error: membersError, mutate } = useMembers(currentOrg?.id ?? null)
  const [tab, setTab] = useState<"members" | "organization">("members")
  const [showInvite, setShowInvite] = useState(false)

  const currentUserId = userProfile?.id ?? ""
  const loading = orgLoading || membersLoading

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{currentOrg?.name}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {(["members", "organization"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === tabKey
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tabKey === "members" ? <Users className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
            {t(`tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {tab === "members" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">{tMembers("title")}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{tMembers("subtitle")}</p>
            </div>
            {isOrgAdmin && (
              <button
                onClick={() => setShowInvite(!showInvite)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                {tMembers("invite")}
              </button>
            )}
          </div>

          {showInvite && isOrgAdmin && currentOrg && (
            <CreateMemberForm
              orgId={currentOrg.id}
              onSuccess={() => { setShowInvite(false); mutate() }}
            />
          )}

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary mb-3" />
                <p className="text-sm text-muted-foreground">Cargando...</p>
              </div>
            ) : membersError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <p className="text-sm text-destructive font-medium mb-1">Error al cargar miembros</p>
                <p className="text-xs text-muted-foreground mb-3">{String(membersError)}</p>
                <button onClick={() => mutate()} className="text-xs px-3 py-1.5 bg-muted rounded-lg hover:bg-muted/70 transition-colors">
                  Reintentar
                </button>
              </div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <Users className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">No hay miembros todavía</p>
                <p className="text-xs text-muted-foreground">
                  {currentOrg?.id
                    ? "No se encontraron miembros. Aplica la migración SQL en el panel de Supabase."
                    : "Cargando organización..."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    orgId={currentOrg?.id ?? ""}
                    currentUserId={currentUserId}
                    isAdmin={isOrgAdmin}
                    onRefresh={mutate}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Role legend */}
          <div className="grid grid-cols-3 gap-3 mt-2">
            {(["admin", "member", "viewer"] as OrgRole[]).map((role) => (
              <div key={role} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", ROLE_COLORS[role])}>
                    {tMembers(`roles.${role}`)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{tMembers(`roleDescriptions.${role}`)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Organization tab */}
      {tab === "organization" && currentOrg && (
        <OrgForm orgId={currentOrg.id} initialData={{ ...currentOrg, access_code: (currentOrg as any).access_code ?? null }} />
      )}
    </div>
  )
}
