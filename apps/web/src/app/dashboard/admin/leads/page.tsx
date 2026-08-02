"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { AdminLeadsClient } from "@/components/leads/admin-leads-client"

export default function AdminLeadsPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Leads"
          description="Manage and assign every lead in the pipeline."
        >
          <AdminLeadsClient />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}
