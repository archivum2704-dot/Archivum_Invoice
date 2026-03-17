'use client'

import { useOrganization } from '@/lib/context/organization-context'
import { useDocuments } from '@/lib/hooks/use-documents'
import { useCompanies } from '@/lib/hooks/use-companies'
import { Building2, FileText, DollarSign, TrendingUp, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AdminDashboardPage() {
  const router = useRouter()
  const { userRole, currentOrg, userOrgs, loading: orgLoading } = useOrganization()

  // Redirect non-admin users
  useEffect(() => {
    if (!orgLoading && userRole !== 'admin') {
      router.push('/dashboard')
    }
  }, [userRole, orgLoading, router])

  // Get all documents from first organization (all companies)
  const firstOrgId = userOrgs.length > 0 ? userOrgs[0].id : currentOrg?.id || null
  const { documents, loading: docsLoading } = useDocuments(firstOrgId)
  const { companies, loading: compsLoading } = useCompanies(firstOrgId)
  const loading = orgLoading || docsLoading || compsLoading

  // Calculate statistics
  const totalInvoices = documents.filter(d => d.document_type === 'invoice').length
  const totalAmount = documents.reduce((sum, doc) => sum + (doc.total_amount || 0), 0)
  const paidAmount = documents
    .filter(d => d.status === 'paid')
    .reduce((sum, doc) => sum + (doc.total_amount || 0), 0)
  const pendingAmount = documents
    .filter(d => ['sent', 'overdue', 'draft'].includes(d.status))
    .reduce((sum, doc) => sum + (doc.total_amount || 0), 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!userRole || userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Acceso denegado</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">Panel de Administrador</h1>
        <p className="text-muted-foreground">Vista global del sistema</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Companies */}
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Empresas</p>
              <p className="text-2xl font-bold text-foreground">{companies.length}</p>
            </div>
            <Building2 className="w-8 h-8 text-primary/20" />
          </div>
        </div>

        {/* Total Documents */}
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Documentos</p>
              <p className="text-2xl font-bold text-foreground">{documents.length}</p>
            </div>
            <FileText className="w-8 h-8 text-accent/20" />
          </div>
        </div>

        {/* Total Amount */}
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Importe Total</p>
              <p className="text-2xl font-bold text-foreground">{totalAmount.toFixed(2)} €</p>
            </div>
            <DollarSign className="w-8 h-8 text-[var(--status-paid)]/20" />
          </div>
        </div>

        {/* Paid Amount */}
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Pagado</p>
              <p className="text-2xl font-bold text-foreground">{paidAmount.toFixed(2)} €</p>
            </div>
            <TrendingUp className="w-8 h-8 text-[var(--status-paid)]/20" />
          </div>
        </div>
      </div>

      {/* Companies Section */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Empresas del Sistema</h2>
        </div>
        
        {companies.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay empresas registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-foreground">Empresa</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">CIF</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Sector</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Ciudad</th>
                  <th className="text-right py-3 px-4 font-medium text-foreground">Total Facturado</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4 text-foreground">{company.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{company.cif}</td>
                    <td className="py-3 px-4 text-muted-foreground">{company.sector || '-'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{company.city || '-'}</td>
                    <td className="py-3 px-4 text-right font-semibold text-foreground">
                      {company.total_invoiced.toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Documents Section */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold text-foreground">Documentos Recientes</h2>
        </div>

        {documents.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay documentos registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-foreground">Documento</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Estado</th>
                  <th className="text-right py-3 px-4 font-medium text-foreground">Importe</th>
                </tr>
              </thead>
              <tbody>
                {documents.slice(0, 10).map((doc) => (
                  <tr key={doc.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4 text-foreground font-medium">{doc.document_number}</td>
                    <td className="py-3 px-4 text-muted-foreground">{doc.document_type}</td>
                    <td className="py-3 px-4 text-muted-foreground">{new Date(doc.date).toLocaleDateString('es-ES')}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        doc.status === 'paid' ? 'bg-[var(--status-paid)]/10 text-[var(--status-paid)]' :
                        doc.status === 'sent' ? 'bg-[var(--status-pending)]/10 text-[var(--status-pending)]' :
                        doc.status === 'overdue' ? 'bg-[var(--status-overdue)]/10 text-[var(--status-overdue)]' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-foreground">
                      {doc.total_amount.toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
