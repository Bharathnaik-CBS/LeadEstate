export type UserRole =
  | "ADMIN"
  | "SALES_EXECUTIVE"
  | "PROJECT_INVENTORY_MANAGER"
  | "SITE_VISIT_COORDINATOR"

export type OnboardingStatus =
  | "CREATED"
  | "PENDING_ADMIN_APPROVAL"
  | "PROFILE_INCOMPLETE"
  | "PASSWORD_CHANGE_REQUIRED"
  | "ACTIVE"
  | "REJECTED"

export type Gender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY"

export type AuthUser = {
  id: string
  name: string
  email: string
  role: UserRole
  seId?: string | null
  username?: string | null
  firstName?: string | null
  lastName?: string | null
  phoneNumber?: string | null
  dob?: string | null
  gender?: Gender | null
  onboardingStatus?: OnboardingStatus
  createdAt?: string
  updatedAt?: string
}

export type AuthSession = {
  accessToken: string
  user: AuthUser
}

const TOKEN_KEY = "lead-estate-token"
const USER_KEY = "lead-estate-user"
export const AUTH_INVALID_EVENT = "lead-estate-auth-invalid"
const onboardingStatuses: OnboardingStatus[] = [
  "CREATED",
  "PENDING_ADMIN_APPROVAL",
  "PROFILE_INCOMPLETE",
  "PASSWORD_CHANGE_REQUIRED",
  "ACTIVE",
  "REJECTED",
]

export function saveAuthSession(session: AuthSession) {
  if (!isBrowser()) {
    return
  }

  localStorage.setItem(TOKEN_KEY, session.accessToken)
  localStorage.setItem(USER_KEY, JSON.stringify(session.user))
}

export function getToken() {
  if (!isBrowser()) {
    return null
  }

  return localStorage.getItem(TOKEN_KEY)?.trim() || null
}

export function getStoredUser(): AuthUser | null {
  if (!isBrowser()) {
    return null
  }

  const rawUser = localStorage.getItem(USER_KEY)

  if (!rawUser) {
    return null
  }

  try {
    const user = JSON.parse(rawUser) as AuthUser

    if (!isAuthUser(user)) {
      removeAuthSession()
      return null
    }

    return user
  } catch {
    removeAuthSession()
    return null
  }
}

export function removeAuthSession() {
  if (!isBrowser()) {
    return
  }

  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function invalidateAuthSession() {
  removeAuthSession()

  if (!isBrowser()) {
    return
  }

  window.dispatchEvent(new Event(AUTH_INVALID_EVENT))
}

export function logout(router: { replace(path: string): void; refresh(): void }) {
  removeAuthSession()
  router.replace("/login")
  router.refresh()
}

export function getDashboardPathForRole(role: UserRole) {
  if (role === "ADMIN") {
    return "/dashboard/admin"
  }

  if (role === "PROJECT_INVENTORY_MANAGER") {
    return "/dashboard/pim"
  }

  if (role === "SITE_VISIT_COORDINATOR") {
    return "/dashboard/svc"
  }

  return "/dashboard/sales"
}

export function getLandingPathForUser(user: AuthUser) {
  if (
    user.role === "SALES_EXECUTIVE" &&
    getSalesOnboardingStatus(user) !== "ACTIVE"
  ) {
    return "/dashboard/sales/onboarding"
  }

  return getDashboardPathForRole(user.role)
}

export function getSalesOnboardingStatus(user: AuthUser): OnboardingStatus {
  return user.onboardingStatus ?? "PENDING_ADMIN_APPROVAL"
}

function isAuthUser(user: Partial<AuthUser> | null): user is AuthUser {
  return (
    typeof user?.id === "string" &&
    typeof user.name === "string" &&
    typeof user.email === "string" &&
    (user.role === "ADMIN" ||
      user.role === "SALES_EXECUTIVE" ||
      user.role === "PROJECT_INVENTORY_MANAGER" ||
      user.role === "SITE_VISIT_COORDINATOR") &&
    (user.onboardingStatus === undefined ||
      onboardingStatuses.includes(user.onboardingStatus))
  )
}

function isBrowser() {
  return typeof window !== "undefined"
}
