"use client"

import { useState, useMemo } from "react"
import { Receipt, Plus, X, Trash2, Loader2, Lock, AlertTriangle, ChevronRight, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { cn } from "@/lib/utils"
import { useOrganization } from "@/lib/context/organization-context"
import { useInvoices } from "@/lib/hooks/use-invoices"
import { useCompanies } from "@/lib/hooks/use-companies"
import { useProducts } from "@/lib/hooks/use-products"
import { isPaidPlan } from "@/lib/plan"
import { createClient } from "@/lib/supabase/client"

type Line = {
  productId: string | null
  description: string
  quantity: string
  unitPrice: string
  taxRate: string
  discountPct: string
}

const emptyLine = (): Line => ({ productId: null, description: "", quantity: "1", unitPrice: "0", taxRate: "21", discountPct: "0" })

// Spanish VAT (IVA) rates — "" = exento (0%)
const IVA_RATES = ["", "4", "10", "21"]
// Spanish IRPF withholding (retención) rates — "" = sin retención
const RETENTION_RATES = ["", "7", "15", "19"]

const STATE_STYLES: Record<string, string> = {
  issued:    "bg-[var(--status-paid)]/10 text-[var(--status-paid)]",
  draft:     "bg-muted text-muted-foreground",
  cancelled: "bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]",
}

export function FacturacionView() {
  const t = useTranslations("invoicing")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const router = useRouter()
  const { currentOrg, isOrgAdmin, isPlatformAdmin } = useOrganization()
  const paid = isPaidPlan(currentOrg) || isPlatformAdmin
  const { invoices, loading, mutate } = useInvoices(currentOrg?.id ?? null)
  const { companies, mutate: mutateCompanies } = useCompanies(currentOrg?.id ?? null)
  const { products } = useProducts(currentOrg?.id ?? null)

  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState("")
  const [series, setSeries] = useState("FAC")
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [kind, setKind] = useState<"ordinary" | "simplified">("ordinary")
  const [notes, setNotes] = useState("")
  const [retentionPct, setRetentionPct] = useState("")
  const [lines, setLines] = useState<Line[]>([emptyLine()])
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Inline "new client" creation
  const NEW_CLIENT_EMPTY = { name: "", cif: "", address: "", postal_code: "", city: "", province: "" }
  const [newClientOpen, setNewClientOpen] = useState(false)
  const [nc, setNc] = useState(NEW_CLIENT_EMPTY)
  const [savingClient, setSavingClient] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)

  const handleCreateClient = async () => {
    if (!nc.name.trim() || !currentOrg) return
    setSavingClient(true); setClientError(null)
    const supabase = createClient()
    const { data, error: err } = await supabase.from("companies").insert({
      organization_id: currentOrg.id,
      name: nc.name.trim(),
      cif: nc.cif.trim() || null,
      address: nc.address.trim() || null,
      postal_code: nc.postal_code.trim() || null,
      city: nc.city.trim() || null,
      province: nc.province.trim() || null,
      is_active: true,
    }).select("id").single()
    if (err || !data) { setClientError(err?.message ?? "Error"); setSavingClient(false); return }
    await mutateCompanies()
    setClientId(data.id)
    setSavingClient(false); setNewClientOpen(false); setNc(NEW_CLIENT_EMPTY)
  }

  const fmtEur = (n: number) => `${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
  const canManage = isOrgAdmin && paid

  const selectedClient = companies.find(c => c.id === clientId)

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0
    for (const l of lines) {
      const base = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0) * (1 - (Number(l.discountPct) || 0) / 100)
      subtotal += base
      tax += base * (Number(l.taxRate) || 0) / 100
    }
    const r2 = (n: number) => Math.round(n * 100) / 100
    const retention = r2(subtotal * (Number(retentionPct) || 0) / 100)
    return { subtotal: r2(subtotal), tax: r2(tax), retention, total: r2(subtotal + tax - retention) }
  }, [lines, retentionPct])

  // Validation: client + client CIF + issue date + issuer CIF + at least one described line
  const issuerHasCif = !!currentOrg?.cif?.trim()
  const validationError = useMemo(() => {
    if (!issuerHasCif) return t("errors.issuerCif")
    if (!clientId) return t("errors.clientRequired")
    if (!selectedClient?.cif?.trim()) return t("errors.clientCif")
    if (!issueDate) return t("errors.issueDate")
    if (!lines.some(l => l.description.trim())) return t("errors.noLines")
    return null
  }, [issuerHasCif, clientId, selectedClient, issueDate, lines, t])

  const resetForm = () => {
    setClientId(""); setSeries("FAC"); setIssueDate(new Date().toISOString().slice(0, 10))
    setKind("ordinary"); setNotes(""); setRetentionPct(""); setLines([emptyLine()]); setError(null)
  }

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))

  const pickProduct = (i: number, productId: string) => {
    const p = products.find(pr => pr.id === productId)
    if (!p) { setLine(i, { productId: null }); return }
    setLine(i, {
      productId: p.id,
      description: p.name,
      unitPrice: String(p.unit_price),
      taxRate: String(p.tax_rate),
    })
  }

  const handleIssue = async () => {
    if (validationError || !currentOrg) { setError(validationError); return }
    setIssuing(true); setError(null)
    try {
      const res = await fetch("/api/invoices/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: currentOrg.id,
          clientCompanyId: clientId,
          series, kind, issueDate, notes,
          retentionPct: Number(retentionPct) || 0,
          lines: lines.filter(l => l.description.trim()).map(l => ({
            productId: l.productId,
            description: l.description,
            quantity: Number(l.quantity) || 0,
            unitPrice: Number(l.unitPrice) || 0,
            taxRate: Number(l.taxRate) || 0,
            discountPct: Number(l.discountPct) || 0,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        const known = ["issuer_cif_required", "client_cif_required", "issue_date_required", "client_required", "no_lines"]
        setError(known.includes(json.error) ? t(`errors.${json.error}`) : (json.detail ?? t("errors.generic")))
        setIssuing(false); return
      }
      await mutate()
      setOpen(false); resetForm()
      router.push(`/facturacion/${json.id}`)
    } catch (e) {
      setError(String(e)); setIssuing(false)
    }
  }

  // ── Paywall ─────────────────────────────────────────────────
  if (!paid) {
    return (
      <div className="p-6 sm:p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-2.5 mb-8">
          <Receipt className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        </div>
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t("paywallTitle")}</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{t("paywallBody")}</p>
          <Link href="/configuracion/billing" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
            {t("upgrade")}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-2.5">
          <Receipt className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        </div>
        {canManage && (
          <button onClick={() => { resetForm(); setOpen(true) }} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> {t("newInvoice")}
          </button>
        )}
      </div>

      {/* Verifactu note */}
      <div className="flex items-center gap-2 mb-5 text-xs text-muted-foreground">
        <ShieldCheck className="w-3.5 h-3.5 text-[var(--status-paid)]" />
        {t("verifactuNote")}
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"><Receipt className="w-6 h-6 text-muted-foreground/50" /></div>
            <p className="text-sm font-medium text-foreground">{t("empty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {invoices.map(inv => (
              <Link key={inv.id} href={`/facturacion/${inv.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors group">
                <span className="text-sm font-semibold text-foreground w-32 shrink-0 truncate">{inv.full_number ?? "—"}</span>
                <span className="flex-1 min-w-0 text-sm text-muted-foreground truncate">{inv.client?.name ?? inv.client_name ?? "—"}</span>
                <span className="text-xs text-muted-foreground hidden sm:block w-24">{inv.issue_date ?? "—"}</span>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium hidden sm:block", STATE_STYLES[inv.state])}>{t(`states.${inv.state}`)}</span>
                <span className="text-sm font-semibold text-foreground text-right w-28">{fmtEur(Number(inv.total))}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New invoice modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !issuing && setOpen(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl p-6 my-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">{t("newInvoice")}</h2>
              <button onClick={() => !issuing && setOpen(false)} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>

            {/* Client + meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-foreground">{t("client")} <span className="text-destructive">*</span></label>
                  <button type="button" onClick={() => { setNc(NEW_CLIENT_EMPTY); setClientError(null); setNewClientOpen(true) }} className="flex items-center gap-1 text-xs text-accent hover:underline font-medium">
                    <Plus className="w-3.5 h-3.5" /> {t("newClient")}
                  </button>
                </div>
                <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls}>
                  <option value="">{t("selectClient")}</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.cif ? ` · ${c.cif}` : ` · ${t("noCif")}`}</option>
                  ))}
                </select>
                {companies.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{t("noClientsHint")}</p>
                )}
                {selectedClient && !selectedClient.cif?.trim() && (
                  <p className="text-xs text-destructive mt-1">{t("errors.clientCif")}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t("series")}</label>
                <input value={series} onChange={e => setSeries(e.target.value.toUpperCase())} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t("issueDate")} <span className="text-destructive">*</span></label>
                <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t("kind")}</label>
                <select value={kind} onChange={e => setKind(e.target.value as any)} className={inputCls}>
                  <option value="ordinary">{t("kinds.ordinary")}</option>
                  <option value="simplified">{t("kinds.simplified")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t("retention")}</label>
                <select value={retentionPct} onChange={e => setRetentionPct(e.target.value)} className={inputCls}>
                  {RETENTION_RATES.map(r => <option key={r} value={r}>{r === "" ? t("noRetention") : `${r}%`}</option>)}
                </select>
              </div>
            </div>

            {/* Lines */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">{t("lines")}</label>
                <button onClick={() => setLines([...lines, emptyLine()])} className="flex items-center gap-1 text-xs text-accent hover:underline font-medium">
                  <Plus className="w-3.5 h-3.5" /> {t("addLine")}
                </button>
              </div>
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_56px_72px_56px_auto] gap-2 items-center">
                    <div className="flex flex-col gap-1">
                      {products.length > 0 && (
                        <select value={l.productId ?? ""} onChange={e => pickProduct(i, e.target.value)} className={cn(inputCls, "py-1.5 text-xs")}>
                          <option value="">{t("manualLine")}</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                      <input placeholder={t("description")} value={l.description} onChange={e => setLine(i, { description: e.target.value, productId: null })} className={cn(inputCls, "py-1.5")} />
                    </div>
                    <input type="number" step="0.01" title={t("qty")} value={l.quantity} onChange={e => setLine(i, { quantity: e.target.value })} className={cn(inputCls, "py-1.5 text-right")} />
                    <input type="number" step="0.01" title={t("unitPrice")} value={l.unitPrice} onChange={e => setLine(i, { unitPrice: e.target.value })} className={cn(inputCls, "py-1.5 text-right")} />
                    <select title={t("tax")} value={l.taxRate} onChange={e => setLine(i, { taxRate: e.target.value })} className={cn(inputCls, "py-1.5 px-1 text-right")}>
                      {IVA_RATES.map(r => <option key={r} value={r}>{r === "" ? t("exempt") : `${r}%`}</option>)}
                    </select>
                    <button onClick={() => setLines(lines.filter((_, idx) => idx !== i))} disabled={lines.length === 1} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive disabled:opacity-30">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_56px_72px_56px_auto] gap-2 mt-1 px-1 text-[10px] uppercase tracking-wide text-muted-foreground/60">
                <span>{t("description")}</span><span className="text-right">{t("qty")}</span><span className="text-right">{t("unitPrice")}</span><span className="text-right">{t("tax")}%</span><span></span>
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-border pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>{t("subtotal")}</span><span>{fmtEur(totals.subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>{t("tax")}</span><span>{fmtEur(totals.tax)}</span></div>
              {totals.retention > 0 && (
                <div className="flex justify-between text-muted-foreground"><span>{t("retention")} ({retentionPct}%)</span><span>−{fmtEur(totals.retention)}</span></div>
              )}
              <div className="flex justify-between font-bold text-foreground text-base"><span>{t("total")}</span><span>{fmtEur(totals.total)}</span></div>
            </div>

            {(error || validationError) && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-4">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-destructive text-sm">{error ?? validationError}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => !issuing && setOpen(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">{tCommon("cancel")}</button>
              <button onClick={handleIssue} disabled={issuing || !!validationError} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {issuing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {t("issue")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick "new client" modal (over the invoice modal) */}
      {newClientOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !savingClient && setNewClientOpen(false)} />
          <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">{t("newClient")}</h2>
              <button onClick={() => !savingClient && setNewClientOpen(false)} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t("clientName")} <span className="text-destructive">*</span></label>
                <input autoFocus value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">CIF</label>
                <input value={nc.cif} onChange={e => setNc({ ...nc, cif: e.target.value })} placeholder="B12345678" className={inputCls} />
                <p className="text-[11px] text-muted-foreground mt-1">{t("clientCifHint")}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t("clientAddress")}</label>
                <input value={nc.address} onChange={e => setNc({ ...nc, address: e.target.value })} className={inputCls} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">{t("clientPostalCode")}</label>
                  <input value={nc.postal_code} onChange={e => setNc({ ...nc, postal_code: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">{t("clientCity")}</label>
                  <input value={nc.city} onChange={e => setNc({ ...nc, city: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">{t("clientProvince")}</label>
                  <input value={nc.province} onChange={e => setNc({ ...nc, province: e.target.value })} className={inputCls} />
                </div>
              </div>
              {clientError && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-destructive text-sm">{clientError}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => !savingClient && setNewClientOpen(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">{tCommon("cancel")}</button>
              <button onClick={handleCreateClient} disabled={savingClient || !nc.name.trim()} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {savingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t("createClient")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = "w-full px-3 py-2 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
