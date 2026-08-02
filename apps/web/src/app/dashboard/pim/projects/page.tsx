"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { PimDashboardClient } from "@/components/dashboard/pim-dashboard-client"

export default function PimProjectsPage() {
  return (
    <ProtectedRoute allowedRoles={["PROJECT_INVENTORY_MANAGER"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Projects"
          description="View project inventory and mapped plots."
        >
          <PimDashboardClient view="projects" />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}
