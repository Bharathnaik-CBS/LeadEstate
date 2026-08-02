"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { SvcDashboardClient } from "@/components/dashboard/svc-dashboard-client"

export default function SvcDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["SITE_VISIT_COORDINATOR"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="SVC dashboard"
          description="Coordinate assigned site visits, vehicles, and drivers."
        >
          <SvcDashboardClient view="overview" />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}
