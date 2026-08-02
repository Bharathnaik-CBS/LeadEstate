"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { PimDashboardClient } from "@/components/dashboard/pim-dashboard-client"

export default function PimBlocksPage() {
  return (
    <ProtectedRoute allowedRoles={["PROJECT_INVENTORY_MANAGER"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Blocks and bookings"
          description="Inspect active, cancelled, expired, and converted plot blocks."
        >
          <PimDashboardClient view="blocks" />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}
