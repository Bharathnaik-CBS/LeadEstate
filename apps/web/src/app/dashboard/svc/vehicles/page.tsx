"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { SvcDashboardClient } from "@/components/dashboard/svc-dashboard-client"

export default function SvcVehiclesPage() {
  return (
    <ProtectedRoute allowedRoles={["SITE_VISIT_COORDINATOR"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Vehicles"
          description="View vehicles available for assigned visits."
        >
          <SvcDashboardClient view="vehicles" />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}
