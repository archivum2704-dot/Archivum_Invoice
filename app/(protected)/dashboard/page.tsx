'use client'

import { useOrganization } from '@/lib/context/organization-context'
import { DashboardView } from '@/components/views/dashboard-view'
import { CompanyDashboardView } from '@/components/views/company-dashboard-view'
import AdminDashboardPage from '../admin-dashboard/page'

export default function DashboardPage() {
  const { userRole, loading } = useOrganization()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (userRole === 'admin') {
    return <AdminDashboardPage />
  }

  return <CompanyDashboardView />
}
