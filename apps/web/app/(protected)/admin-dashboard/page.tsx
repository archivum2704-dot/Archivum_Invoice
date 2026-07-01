'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useOrganization } from '@/lib/context/organization-context'
import { PLANS, type PlanId } from '@/lib/pricing'
import {
  Building2, Users, FileText, CreditCard, Search, RefreshCw,
  Pencil, Trash2, X, Shield, AlertTriangle,
  TrendingUp, Database, Crown, Receipt, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminOrg {
  id: string
  name: string
  slug: string
  cif: string | null
  is_active: boolean
  created_at: string
  subscription_plan: string | null
  subscription_status: string | null
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  extra_users_quantity: number
  extra_docs_quantity: number
  doc_quota_pool: number
  current_period_end: string | null
  trial_ends_at: string | null
  deletion_scheduled_at: string | null
  storage_limit_bytes: number
  storage_used_bytes: number
  member_count: number
  document_count: number
  invoice_count: number
  invoiced_total: number
  company_count: number
  product_count: number
  cert_exists: boolean
  cert_nif: string | null
  cert_valid_until: string | null
  cert_uploaded_at: string | null
  owner_email: string | null
}

type CertState = 'none' | 'valid' | 'expired'
function certStatus(org: AdminOrg): CertState {
  if (!org.cert_exists) return 'none'
  if (org.cert_valid_until && new Date(org.cert_valid_until) < new Date()) return 'expired'
  return 'valid'
}

interface AdminUser {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  platform_role: string
  created_at: string
  orgs: Array<{ org_id: string; org_name: string; role: string; subscription_plan: string }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = { free: 'Gratuito', starter: 'Starter', business: 'Business', pro: 'Pro' }
const PLAN_COLORS: Record<string, string> = {
  free:     'bg-muted text-muted-foreground border-border',
  starter:  'bg-blue-50 text-blue-700 border-blue-200',
  business: 'bg-purple-50 text-purple-700 border-purple-200',
  pro:      'bg-amber-50 text-amber-700 border-amber-200',
}
const STATUS_COLORS: Record<string, string> = {
  active:     'bg-green-50 text-green-700 border-green-200',
  trialing:   'bg-sky-50 text-sky-700 border-sky-200',
  past_due:   'bg-orange-50 text-orange-700 border-orange-200',
  canceled:   'bg-red-50 text-red-700 border-red-200',
  unpaid:     'bg-red-50 text-red-700 border-red-200',
  paused:     'bg-muted text-muted-foreground border-border',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function fmtEur(n: number) {
  return `${n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium border', color)}>
      {label}
    </span>
  )
}

function CertBadge({ org }: { org: AdminOrg }) {
  const state = certStatus(org)
  if (state === 'none') return <span className="text-xs text-muted-foreground">—</span>
  const title = [
    org.cert_nif ? `NIF ${org.cert_nif}` : null,
    org.cert_valid_until ? `Válido hasta ${fmt(org.cert_valid_until)}` : null,
  ].filter(Boolean).join(' · ')
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        state === 'valid'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-red-50 text-red-700 border-red-200',
      )}
    >
      <ShieldCheck className="w-3 h-3" />
      {state === 'valid' ? 'Vigente' : 'Caducado'}
    </span>
  )
}

// ── Edit Org Modal ─────────────────────────────────────────────────────────────

function EditOrgModal({ org, onClose, onSaved }: { org: AdminOrg; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name:                  org.name,
    is_active:             org.is_active,
    subscription_plan:     org.subscription_plan ?? 'free',
    subscription_status:   org.subscription_status ?? '',
    extra_users_quantity:  org.extra_users_quantity,
    extra_docs_quantity:   org.extra_docs_quantity,
    doc_quota_pool:        org.doc_quota_pool,
    current_period_end:    org.current_period_end ? org.current_period_end.slice(0, 10) : '',
    stripe_subscription_id: org.stripe_subscription_id ?? '',
    stripe_customer_id:    org.stripe_customer_id ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const field = (k: keyof typeof form) => ({
    value: form[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value })),
  })
  const numField = (k: keyof typeof form) => ({
    value: form[k] as number,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [k]: parseInt(e.target.value) || 0 })),
  })

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/admin/organizations/${org.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        subscription_status:   form.subscription_status   || null,
        current_period_end:    form.current_period_end    || null,
        stripe_subscription_id: form.stripe_subscription_id || null,
        stripe_customer_id:    form.stripe_customer_id    || null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
    onSaved()
    onClose()
  }

  const inputCls = 'w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring'
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-foreground">Editar organización</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{org.slug}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Nombre</label>
            <input type="text" className={inputCls} {...field('name')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Plan</label>
              <select className={inputCls} {...field('subscription_plan')}>
                {(['free', 'starter', 'business', 'pro'] as PlanId[]).map(p => (
                  <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Estado suscripción</label>
              <select className={inputCls} {...field('subscription_status')}>
                <option value="">Sin suscripción</option>
                {['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused', 'incomplete'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Usuarios extra</label>
              <input type="number" min="0" className={inputCls} {...numField('extra_users_quantity')} />
            </div>
            <div>
              <label className={labelCls}>Docs extra (bonos)</label>
              <input type="number" min="0" className={inputCls} {...numField('extra_docs_quantity')} />
            </div>
            <div>
              <label className={labelCls}>Pool docs disponibles</label>
              <input type="number" min="0" className={inputCls} {...numField('doc_quota_pool')} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Fin del periodo actual</label>
            <input type="date" className={inputCls} {...field('current_period_end')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Stripe Customer ID</label>
              <input type="text" className={inputCls} placeholder="cus_…" {...field('stripe_customer_id')} />
            </div>
            <div>
              <label className={labelCls}>Stripe Subscription ID</label>
              <input type="text" className={inputCls} placeholder="sub_…" {...field('stripe_subscription_id')} />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Organización activa</p>
              <p className="text-xs text-muted-foreground">Si se desactiva, los usuarios no podrán acceder</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}
              className={cn('relative w-11 h-6 rounded-full transition-colors', form.is_active ? 'bg-primary' : 'bg-muted')}
            >
              <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', form.is_active ? 'translate-x-5' : 'translate-x-0')} />
            </button>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit User Modal ────────────────────────────────────────────────────────────

function EditUserModal({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    first_name:    user.first_name ?? '',
    last_name:     user.last_name  ?? '',
    platform_role: user.platform_role,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const inputCls = 'w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring'
  const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error === 'cannot_demote_self' ? 'No puedes quitarte el rol de super admin' : (data.error ?? 'Error al guardar')); return }
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-foreground">Editar usuario</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre</label>
              <input type="text" className={inputCls} value={form.first_name}
                onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Apellido</label>
              <input type="text" className={inputCls} value={form.last_name}
                onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Rol en la plataforma</label>
            <select className={inputCls} value={form.platform_role}
              onChange={e => setForm(p => ({ ...p, platform_role: e.target.value }))}>
              <option value="user">Usuario</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          {user.orgs.length > 0 && (
            <div>
              <p className={labelCls}>Organizaciones</p>
              <div className="space-y-1.5">
                {user.orgs.map(o => (
                  <div key={o.org_id} className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-lg border border-border text-xs">
                    <span className="font-medium text-foreground">{o.org_name}</span>
                    <div className="flex items-center gap-2">
                      <Badge label={o.role} color="bg-muted text-foreground border-border" />
                      <Badge label={PLAN_LABELS[o.subscription_plan] ?? o.subscription_plan} color={PLAN_COLORS[o.subscription_plan] ?? ''} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────

function DeleteModal({ label, detail, onConfirm, onClose }: {
  label: string; detail: string; onConfirm: () => Promise<void>; onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try { await onConfirm() } catch (e) { setError(String(e)); setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">¿Eliminar {label}?</h3>
        <p className="text-sm text-muted-foreground mb-5">{detail}</p>
        {error && <p className="text-xs text-destructive mb-3">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors">Cancelar</button>
          <button onClick={handleConfirm} disabled={loading}
            className="flex-1 px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50 transition-colors">
            {loading ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Orgs Tab ──────────────────────────────────────────────────────────────────

function OrgsTab({ orgs, onRefresh }: { orgs: AdminOrg[]; onRefresh: () => void }) {
  const [search,    setSearch]    = useState('')
  const [planFilter, setPlan]     = useState('all')
  const [statusFilter, setStatus] = useState('all')
  const [editOrg,   setEditOrg]   = useState<AdminOrg | null>(null)
  const [deleteOrg, setDeleteOrg] = useState<AdminOrg | null>(null)

  const filtered = useMemo(() => orgs.filter(o => {
    const q = search.toLowerCase()
    if (q && !o.name.toLowerCase().includes(q) && !o.owner_email?.toLowerCase().includes(q) && !o.slug.toLowerCase().includes(q)) return false
    if (planFilter !== 'all' && (o.subscription_plan ?? 'free') !== planFilter) return false
    if (statusFilter !== 'all') {
      if (statusFilter === 'none' && o.subscription_status) return false
      if (statusFilter !== 'none' && o.subscription_status !== statusFilter) return false
    }
    return true
  }), [orgs, search, planFilter, statusFilter])

  const handleDelete = async () => {
    if (!deleteOrg) return
    const res = await fetch(`/api/admin/organizations/${deleteOrg.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Error al eliminar')
    setDeleteOrg(null)
    onRefresh()
  }

  const selectCls = 'text-xs px-3 py-1.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground'

  return (
    <>
      {editOrg   && <EditOrgModal org={editOrg} onClose={() => setEditOrg(null)} onSaved={onRefresh} />}
      {deleteOrg && (
        <DeleteModal
          label={deleteOrg.name}
          detail="Se eliminarán todos los miembros, documentos y empresas. Esta acción no se puede deshacer."
          onConfirm={handleDelete}
          onClose={() => setDeleteOrg(null)}
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text" placeholder="Buscar por nombre, propietario o slug…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>
        <select className={selectCls} value={planFilter} onChange={e => setPlan(e.target.value)}>
          <option value="all">Todos los planes</option>
          {['free', 'starter', 'business', 'pro'].map(p => (
            <option key={p} value={p}>{PLAN_LABELS[p]}</option>
          ))}
        </select>
        <select className={selectCls} value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="all">Todos los estados</option>
          <option value="none">Sin suscripción</option>
          {['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{filtered.length} organizaciones</span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Organización</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Plan</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Estado</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Miembros</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Docs</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Clientes</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Facturas</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">VeriFactu</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Propietario</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Periodo fin</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} className="py-12 text-center text-sm text-muted-foreground">No hay organizaciones</td></tr>
              ) : filtered.map(org => (
                <tr key={org.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {!org.is_active && <span className="w-2 h-2 rounded-full bg-destructive shrink-0" title="Inactiva" />}
                      <div>
                        <p className="font-medium text-foreground">{org.name}</p>
                        <p className="text-xs text-muted-foreground">{org.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge label={PLAN_LABELS[org.subscription_plan ?? 'free'] ?? org.subscription_plan ?? 'free'} color={PLAN_COLORS[org.subscription_plan ?? 'free'] ?? ''} />
                  </td>
                  <td className="py-3 px-4">
                    {org.subscription_status
                      ? <Badge label={org.subscription_status} color={STATUS_COLORS[org.subscription_status] ?? 'bg-muted text-muted-foreground border-border'} />
                      : <span className="text-xs text-muted-foreground">—</span>
                    }
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-sm font-semibold text-foreground">{org.member_count}</span>
                    <span className="text-xs text-muted-foreground">
                      /{(PLANS[(org.subscription_plan ?? 'free') as PlanId]?.users ?? 1) + org.extra_users_quantity}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-sm font-semibold text-foreground">{org.document_count}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-sm font-semibold text-foreground">{org.company_count}</span>
                    {org.product_count > 0 && (
                      <span className="block text-[10px] text-muted-foreground">{org.product_count} prod.</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-sm font-semibold text-foreground">{org.invoice_count}</span>
                    {org.invoiced_total > 0 && (
                      <span className="block text-[10px] text-muted-foreground">{fmtEur(org.invoiced_total)}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <CertBadge org={org} />
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{org.owner_email ?? '—'}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{fmt(org.current_period_end)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditOrg(org)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteOrg(org)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab({ users, onRefresh }: { users: AdminUser[]; onRefresh: () => void }) {
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [editUser,   setEditUser]   = useState<AdminUser | null>(null)
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null)

  const filtered = useMemo(() => users.filter(u => {
    const q = search.toLowerCase()
    if (q && !u.email.toLowerCase().includes(q) &&
        !`${u.first_name ?? ''} ${u.last_name ?? ''}`.toLowerCase().includes(q)) return false
    if (roleFilter === 'super_admin' && u.platform_role !== 'super_admin') return false
    if (roleFilter === 'user' && u.platform_role !== 'user') return false
    return true
  }), [users, search, roleFilter])

  const handleDelete = async () => {
    if (!deleteUser) return
    const res = await fetch(`/api/admin/users/${deleteUser.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Error al eliminar')
    setDeleteUser(null)
    onRefresh()
  }

  const selectCls = 'text-xs px-3 py-1.5 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground'

  return (
    <>
      {editUser   && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={onRefresh} />}
      {deleteUser && (
        <DeleteModal
          label={deleteUser.email}
          detail="Se eliminarán todas sus membresías. Si no pertenece a ninguna otra organización, su cuenta también se eliminará."
          onConfirm={handleDelete}
          onClose={() => setDeleteUser(null)}
        />
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text" placeholder="Buscar por email o nombre…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>
        <select className={selectCls} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="all">Todos los roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="user">Usuario</option>
        </select>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{filtered.length} usuarios</span>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Usuario</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Rol plataforma</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Organizaciones</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Registrado</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">No hay usuarios</td></tr>
              ) : filtered.map(u => {
                const name = [u.first_name, u.last_name].filter(Boolean).join(' ')
                const initials = [(u.first_name?.[0] ?? ''), (u.last_name?.[0] ?? '')].join('') || u.email[0].toUpperCase()
                return (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{name || '—'}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {u.platform_role === 'super_admin'
                        ? <Badge label="Super Admin" color="bg-amber-50 text-amber-700 border-amber-200" />
                        : <Badge label="Usuario" color="bg-muted text-muted-foreground border-border" />
                      }
                    </td>
                    <td className="py-3 px-4">
                      {u.orgs.length === 0
                        ? <span className="text-xs text-muted-foreground">Sin organización</span>
                        : <div className="flex flex-wrap gap-1">
                            {u.orgs.map(o => (
                              <span key={o.org_id} className="text-xs px-2 py-0.5 bg-muted rounded-full border border-border">
                                {o.org_name} <span className="text-muted-foreground">({o.role})</span>
                              </span>
                            ))}
                          </div>
                      }
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{fmt(u.created_at)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditUser(u)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteUser(u)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── Billing Tab ───────────────────────────────────────────────────────────────

function BillingTab({ orgs }: { orgs: AdminOrg[] }) {
  const [search, setSearch] = useState('')

  const paying = useMemo(() =>
    orgs.filter(o => o.subscription_status && o.subscription_status !== 'canceled')
        .filter(o => {
          const q = search.toLowerCase()
          return !q || o.name.toLowerCase().includes(q) || (o.owner_email?.toLowerCase().includes(q) ?? false)
        }),
    [orgs, search])

  const totalMRR = orgs.reduce((sum, o) => {
    if (!o.subscription_status || o.subscription_status === 'canceled') return sum
    const plan = PLANS[(o.subscription_plan ?? 'free') as PlanId]
    const base = plan?.price ?? 0
    const extras = o.extra_users_quantity * 4.99 + o.extra_docs_quantity * 4.99
    return sum + base + extras
  }, 0)

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'MRR estimado', value: `${totalMRR.toFixed(2)} €` },
          { label: 'Suscripciones activas', value: orgs.filter(o => o.subscription_status === 'active').length },
          { label: 'En prueba', value: orgs.filter(o => o.subscription_status === 'trialing').length },
          { label: 'Vencidas / impago', value: orgs.filter(o => ['past_due', 'unpaid'].includes(o.subscription_status ?? '')).length },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text" placeholder="Buscar organización…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{paying.length} con suscripción activa</span>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Organización</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Plan</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Estado</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Usuarios extra</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Docs extra</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">MRR</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fin periodo</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Stripe Customer</th>
              </tr>
            </thead>
            <tbody>
              {paying.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">No hay suscripciones activas</td></tr>
              ) : paying.map(org => {
                const plan = PLANS[(org.subscription_plan ?? 'free') as PlanId]
                const mrr = (plan?.price ?? 0) + org.extra_users_quantity * 4.99 + org.extra_docs_quantity * 4.99
                return (
                  <tr key={org.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-medium text-foreground">{org.name}</p>
                      <p className="text-xs text-muted-foreground">{org.owner_email ?? '—'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <Badge label={PLAN_LABELS[org.subscription_plan ?? 'free'] ?? '—'} color={PLAN_COLORS[org.subscription_plan ?? 'free'] ?? ''} />
                    </td>
                    <td className="py-3 px-4">
                      <Badge label={org.subscription_status ?? '—'} color={STATUS_COLORS[org.subscription_status ?? ''] ?? 'bg-muted text-muted-foreground border-border'} />
                    </td>
                    <td className="py-3 px-4 text-right text-sm">{org.extra_users_quantity || '—'}</td>
                    <td className="py-3 px-4 text-right text-sm">{org.extra_docs_quantity || '—'}</td>
                    <td className="py-3 px-4 text-right font-semibold text-foreground">{mrr.toFixed(2)} €</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{fmt(org.current_period_end)}</td>
                    <td className="py-3 px-4">
                      {org.stripe_customer_id
                        ? <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{org.stripe_customer_id}</code>
                        : <span className="text-xs text-muted-foreground">—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'resumen' | 'organizaciones' | 'usuarios' | 'facturacion'

export default function AdminDashboardPage() {
  const router = useRouter()
  const { isPlatformAdmin, loading: orgLoading } = useOrganization()

  const [orgs,         setOrgs]    = useState<AdminOrg[]>([])
  const [users,        setUsers]   = useState<AdminUser[]>([])
  const [loadingData,  setLoading] = useState(true)
  const [activeTab,    setTab]     = useState<Tab>('resumen')

  useEffect(() => {
    if (!orgLoading && !isPlatformAdmin) router.push('/dashboard')
  }, [isPlatformAdmin, orgLoading, router])

  const load = async () => {
    setLoading(true)
    const [orgsRes, usersRes] = await Promise.all([
      fetch('/api/admin/organizations'),
      fetch('/api/admin/users'),
    ])
    if (orgsRes.ok)  setOrgs(await orgsRes.json())
    if (usersRes.ok) setUsers(await usersRes.json())
    setLoading(false)
  }

  useEffect(() => {
    if (isPlatformAdmin) load()
  }, [isPlatformAdmin])

  if (orgLoading || (!isPlatformAdmin && !orgLoading)) return null

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  // Stats
  const activeOrgs    = orgs.filter(o => o.subscription_status === 'active').length
  const trialingOrgs  = orgs.filter(o => o.subscription_status === 'trialing').length
  const totalDocs     = orgs.reduce((s, o) => s + o.document_count, 0)
  const superAdmins   = users.filter(u => u.platform_role === 'super_admin').length
  const totalStorage  = orgs.reduce((s, o) => s + o.storage_used_bytes, 0)
  const totalInvoices = orgs.reduce((s, o) => s + (o.invoice_count ?? 0), 0)
  const totalInvoiced = orgs.reduce((s, o) => s + (o.invoiced_total ?? 0), 0)
  const totalClients  = orgs.reduce((s, o) => s + (o.company_count ?? 0), 0)
  const certsValid    = orgs.filter(o => certStatus(o) === 'valid').length
  const certsExpired  = orgs.filter(o => certStatus(o) === 'expired').length

  const stats = [
    { label: 'Organizaciones', value: orgs.length,            icon: Building2,  color: 'text-blue-500',   bg: 'bg-blue-50' },
    { label: 'Usuarios totales', value: users.length,          icon: Users,      color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: 'Activas / en prueba', value: `${activeOrgs} / ${trialingOrgs}`, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50' },
    { label: 'Documentos totales', value: totalDocs,            icon: FileText,   color: 'text-amber-500',  bg: 'bg-amber-50' },
    { label: 'Facturas emitidas', value: totalInvoices,         icon: Receipt,    color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Facturado (VeriFactu)', value: fmtEur(totalInvoiced), icon: CreditCard, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Clientes registrados', value: totalClients,       icon: Building2,  color: 'text-sky-600',    bg: 'bg-sky-50' },
    { label: 'VeriFactu vigentes', value: certsExpired > 0 ? `${certsValid} · ${certsExpired} cad.` : certsValid, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Almacenamiento usado', value: fmtBytes(totalStorage), icon: Database, color: 'text-rose-500',  bg: 'bg-rose-50' },
    { label: 'Super Admins', value: superAdmins,               icon: Crown,      color: 'text-amber-600',  bg: 'bg-amber-50' },
  ]

  const TABS: { id: Tab; label: string; icon: typeof Building2 }[] = [
    { id: 'resumen',        label: 'Resumen',        icon: TrendingUp  },
    { id: 'organizaciones', label: 'Organizaciones', icon: Building2   },
    { id: 'usuarios',       label: 'Usuarios',       icon: Users       },
    { id: 'facturacion',    label: 'Facturación',    icon: CreditCard  },
  ]

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Panel de Super Administrador</h1>
            <p className="text-sm text-muted-foreground">Vista global y control total de la plataforma</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-xl mb-6 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Resumen Tab */}
      {activeTab === 'resumen' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', s.bg)}>
                  <s.icon className={cn('w-6 h-6', s.color)} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Plan distribution */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Distribución por plan</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(['free', 'starter', 'business', 'pro'] as PlanId[]).map(p => {
                const count = orgs.filter(o => (o.subscription_plan ?? 'free') === p).length
                const pct   = orgs.length ? Math.round((count / orgs.length) * 100) : 0
                return (
                  <div key={p} className="text-center p-4 bg-muted/40 rounded-xl border border-border">
                    <Badge label={PLAN_LABELS[p]} color={PLAN_COLORS[p]} />
                    <p className="text-2xl font-bold text-foreground mt-2">{count}</p>
                    <p className="text-xs text-muted-foreground">{pct}% del total</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent orgs */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Building2 className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground text-sm">Últimas organizaciones registradas</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left py-3 px-5 font-medium text-muted-foreground">Nombre</th>
                  <th className="text-left py-3 px-5 font-medium text-muted-foreground">Plan</th>
                  <th className="text-center py-3 px-5 font-medium text-muted-foreground">Miembros</th>
                  <th className="text-center py-3 px-5 font-medium text-muted-foreground">Docs</th>
                  <th className="text-center py-3 px-5 font-medium text-muted-foreground">Facturas</th>
                  <th className="text-left py-3 px-5 font-medium text-muted-foreground">Registrada</th>
                </tr>
              </thead>
              <tbody>
                {orgs.slice(0, 8).map(org => (
                  <tr key={org.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-5 font-medium text-foreground">{org.name}</td>
                    <td className="py-3 px-5">
                      <Badge label={PLAN_LABELS[org.subscription_plan ?? 'free'] ?? '—'} color={PLAN_COLORS[org.subscription_plan ?? 'free'] ?? ''} />
                    </td>
                    <td className="py-3 px-5 text-center text-foreground font-semibold">{org.member_count}</td>
                    <td className="py-3 px-5 text-center text-foreground font-semibold">{org.document_count}</td>
                    <td className="py-3 px-5 text-center text-foreground font-semibold">{org.invoice_count}</td>
                    <td className="py-3 px-5 text-muted-foreground text-xs">{fmt(org.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'organizaciones' && <OrgsTab orgs={orgs} onRefresh={load} />}
      {activeTab === 'usuarios'       && <UsersTab users={users} onRefresh={load} />}
      {activeTab === 'facturacion'    && <BillingTab orgs={orgs} />}
    </div>
  )
}
