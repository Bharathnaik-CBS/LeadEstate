"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { SalesDashboardClient } from "@/components/dashboard/sales-dashboard-client"

export default function SalesDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["SALES_EXECUTIVE"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Sales dashboard"
          description="Your created and assigned leads, follow-ups, and current pipeline."
        >
          <SalesDashboardClient />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}
