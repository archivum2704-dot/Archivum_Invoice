import { AppShell } from "@/components/app-shell"
import { DashboardView } from "@/components/views/dashboard-view"

export default function HomePage() {
  return (
    <AppShell>
      <DashboardView />
    </AppShell>
  )
}
