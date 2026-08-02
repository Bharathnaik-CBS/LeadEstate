"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { SalesLeadsClient } from "@/components/leads/sales-leads-client"

export default function SalesLeadsPage() {
  return (
    <ProtectedRoute allowedRoles={["SALES_EXECUTIVE"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="My Leads"
          description="Create leads, manage follow-ups, and keep your pipeline current."
        >
          <SalesLeadsClient />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}
