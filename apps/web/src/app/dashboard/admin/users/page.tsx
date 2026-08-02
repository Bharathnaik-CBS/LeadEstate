"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { AdminUserOnboardingClient } from "@/components/users/admin-user-onboarding-client"

export default function AdminUsersPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Users and onboarding"
          description="Create SE, PIM, and SVC users for operational workflows."
        >
          <AdminUserOnboardingClient />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}
