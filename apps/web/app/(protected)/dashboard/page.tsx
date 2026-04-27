'use client'

import { useOrganization } from '@/lib/context/organization-context'
import { DashboardView } from '@/components/views/dashboard-view'
import AdminDashboardPage from '../admin-dashboard/page'

export default function DashboardPage() {
  const { isPlatformAdmin, loading } = useOrganization()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (isPlatformAdmin) return <AdminDashboardPage />
  return <DashboardView />
}
