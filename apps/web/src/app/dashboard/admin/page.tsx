"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { AdminDashboardClient } from "@/components/dashboard/admin-dashboard-client"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Admin dashboard"
          description="Oversee leads, assignments, and sales executive performance."
        >
          <AdminDashboardClient />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}
