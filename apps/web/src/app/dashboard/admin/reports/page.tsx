"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { AdminReportsClient } from "@/components/reports/admin-reports-client"

export default function AdminReportsPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Reports"
          description="Review printable admin reports and export CSV files."
        >
          <AdminReportsClient />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}
