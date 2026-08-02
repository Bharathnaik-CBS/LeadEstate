"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { SvcDashboardClient } from "@/components/dashboard/svc-dashboard-client"

export default function SvcSiteVisitsPage() {
  return (
    <ProtectedRoute allowedRoles={["SITE_VISIT_COORDINATOR"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Site visits"
          description="Review and update assigned visit status."
        >
          <SvcDashboardClient view="site-visits" />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}
