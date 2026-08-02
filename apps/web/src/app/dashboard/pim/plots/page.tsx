"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { PimDashboardClient } from "@/components/dashboard/pim-dashboard-client"

export default function PimPlotsPage() {
  return (
    <ProtectedRoute allowedRoles={["PROJECT_INVENTORY_MANAGER"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Plots and layout"
          description="Review plot status by project."
        >
          <PimDashboardClient view="plots" />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}
