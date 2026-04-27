'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useOrganization } from '@/lib/context/organization-context'
import { useDocuments } from '@/lib/hooks/use-documents'
import { useCompanies } from '@/lib/hooks/use-companies'
import { Building2, FileText, DollarSign, TrendingUp } from 'lucide-react'

export default function AdminDashboardPage() {
  const t = useTranslations('admin')
  const tDoc = useTranslations('documents')
  const router = useRouter()
  const { isPlatformAdmin, currentOrg, userOrgs, loading: orgLoading } = useOrganization()

  useEffect(() => {
    if (!orgLoading && !isPlatformAdmin) router.push('/dashboard')
  }, [isPlatformAdmin, orgLoading, router])

  const orgId = currentOrg?.id ?? userOrgs[0]?.id ?? null
  const { documents, loading: docsLoading } = useDocuments(orgId)
  const { companies, loading: compsLoading } = useCompanies(orgId)
  const loading = orgLoading || docsLoading || compsLoading

  const totalAmount = documents.reduce((s, d) => s + (d.total ?? 0), 0)
  const paidAmount = documents
    .filter(d => d.status === 'paid')
    .reduce((s, d) => s + (d.total ?? 0), 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!isPlatformAdmin) return null

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('allOrganizations'), value: userOrgs.length, icon: TrendingUp },
          { label: t('allDocuments'), value: documents.length, icon: FileText },
          { label: 'Total', value: `${totalAmount.toLocaleString('en', { minimumFractionDigits: 2 })} €`, icon: DollarSign },
          { label: 'Paid', value: `${paidAmount.toLocaleString('en', { minimumFractionDigits: 2 })} €`, icon: TrendingUp },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">{stat.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
            </div>
            <stat.icon className="w-8 h-8 text-primary/20" />
          </div>
        ))}
      </div>

      {/* Companies table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Building2 className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">{t('allOrganizations')}</h2>
        </div>
        {companies.length === 0 ? (
          <p className="text-muted-foreground text-sm p-5">No companies registered yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left py-3 px-5 font-medium text-muted-foreground">{tDoc('fields.company')}</th>
                <th className="text-left py-3 px-5 font-medium text-muted-foreground">{tDoc('fields.status')}</th>
                <th className="text-left py-3 px-5 font-medium text-muted-foreground">City</th>
                <th className="text-right py-3 px-5 font-medium text-muted-foreground">Active</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(co => (
                <tr key={co.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                  <td className="py-3 px-5 font-medium text-foreground">{co.name}</td>
                  <td className="py-3 px-5 text-muted-foreground">{co.cif ?? '—'}</td>
                  <td className="py-3 px-5 text-muted-foreground">{co.city ?? '—'}</td>
                  <td className="py-3 px-5 text-right">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${co.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                      {co.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Documents table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <FileText className="w-4 h-4 text-accent" />
          <h2 className="font-semibold text-foreground text-sm">{t('allDocuments')}</h2>
        </div>
        {documents.length === 0 ? (
          <p className="text-muted-foreground text-sm p-5">No documents yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left py-3 px-5 font-medium text-muted-foreground">{tDoc('fields.number')}</th>
                <th className="text-left py-3 px-5 font-medium text-muted-foreground">{tDoc('fields.type')}</th>
                <th className="text-left py-3 px-5 font-medium text-muted-foreground">{tDoc('fields.status')}</th>
                <th className="text-right py-3 px-5 font-medium text-muted-foreground">{tDoc('fields.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {documents.slice(0, 15).map(doc => (
                <tr key={doc.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                  <td className="py-3 px-5 font-medium text-foreground">{doc.document_number ?? '—'}</td>
                  <td className="py-3 px-5 text-muted-foreground">{tDoc(`types.${doc.document_type}`)}</td>
                  <td className="py-3 px-5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      doc.status === 'paid' ? 'bg-green-100 text-green-700' :
                      doc.status === 'overdue' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {tDoc(`statuses.${doc.status}`)}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right font-semibold text-foreground">
                    {doc.total != null ? `${doc.total.toLocaleString('en', { minimumFractionDigits: 2 })} €` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
