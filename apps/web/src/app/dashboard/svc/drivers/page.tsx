"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { SvcDashboardClient } from "@/components/dashboard/svc-dashboard-client"

export default function SvcDriversPage() {
  return (
    <ProtectedRoute allowedRoles={["SITE_VISIT_COORDINATOR"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Drivers"
          description="View drivers available for assigned visits."
        >
          <SvcDashboardClient view="drivers" />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}
