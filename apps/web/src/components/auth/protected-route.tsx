"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { DashboardLoading } from "@/components/dashboard/dashboard-state"
import {
  AUTH_INVALID_EVENT,
  getLandingPathForUser,
  getSalesOnboardingStatus,
  removeAuthSession,
  type AuthUser,
  type UserRole,
} from "@/lib/auth"
import { verifyStoredSession } from "@/lib/session"

type ProtectedRouteProps = {
  allowedRoles?: UserRole[]
  children: (user: AuthUser) => ReactNode
}

export function ProtectedRoute({
  allowedRoles,
  children,
}: ProtectedRouteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const rolesKey = useMemo(() => allowedRoles?.join(",") ?? "", [allowedRoles])

  useEffect(() => {
    let isActive = true

    void verifyStoredSession().then((session) => {
      if (!isActive) {
        return
      }

      if (!session) {
        removeAuthSession()
        router.replace("/login")
        return
      }

      const freshUser = session.user

      if (allowedRoles?.length && !allowedRoles.includes(freshUser.role)) {
        router.replace(getLandingPathForUser(freshUser))
        return
      }

      const salesOnboardingStatus =
        freshUser.role === "SALES_EXECUTIVE"
          ? getSalesOnboardingStatus(freshUser)
          : null

      if (
        freshUser.role === "SALES_EXECUTIVE" &&
        salesOnboardingStatus !== "ACTIVE" &&
        pathname !== "/dashboard/sales/onboarding"
      ) {
        router.replace("/dashboard/sales/onboarding")
        return
      }

      if (
        freshUser.role === "SALES_EXECUTIVE" &&
        salesOnboardingStatus === "ACTIVE" &&
        pathname === "/dashboard/sales/onboarding"
      ) {
        router.replace("/dashboard/sales")
        return
      }

      setUser(freshUser)
      setIsChecking(false)
    })

    return () => {
      isActive = false
    }
  }, [allowedRoles, pathname, rolesKey, router])

  useEffect(() => {
    function handleAuthInvalid() {
      setUser(null)
      setIsChecking(true)
      router.replace("/login")
    }

    window.addEventListener(AUTH_INVALID_EVENT, handleAuthInvalid)

    return () => {
      window.removeEventListener(AUTH_INVALID_EVENT, handleAuthInvalid)
    }
  }, [router])

  if (isChecking || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <DashboardLoading
          title="Checking your session"
          description="Confirming access before opening the dashboard."
          rows={3}
          className="w-full max-w-3xl"
        />
      </main>
    )
  }

  return children(user)
}
