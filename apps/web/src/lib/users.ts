import { apiRequest } from "@/lib/api"
import type { AuthUser, Gender, OnboardingStatus, UserRole } from "@/lib/auth"

export type CreateSalesExecutiveInput = {
  seId: string
  email: string
  password: string
}

export type CreateUserInput = {
  name: string
  email: string
  password: string
  role: Exclude<UserRole, "ADMIN">
  onboardingStatus?: Extract<OnboardingStatus, "ACTIVE" | "REJECTED">
}

export type CompleteSalesProfileInput = {
  firstName: string
  lastName: string
  username: string
  phoneNumber: string
  dob: string
  gender: Gender
}

export type PasswordOtpResponse = {
  expiresAt: string
  message: string
}

export function getSalesExecutives(token: string) {
  return apiRequest<AuthUser[]>("/users/sales-executives", { token })
}

export function getManagedSalesExecutives(
  token: string,
  onboardingStatus?: OnboardingStatus
) {
  const query = onboardingStatus
    ? `?${new URLSearchParams({ onboardingStatus }).toString()}`
    : ""

  return apiRequest<AuthUser[]>(`/users/sales-executives/manage${query}`, {
    token,
  })
}

export function getManagedUsers(
  token: string,
  filters: {
    role?: UserRole
    onboardingStatus?: OnboardingStatus
  } = {}
) {
  const query = new URLSearchParams()

  if (filters.role) {
    query.set("role", filters.role)
  }

  if (filters.onboardingStatus) {
    query.set("onboardingStatus", filters.onboardingStatus)
  }

  const queryString = query.toString() ? `?${query.toString()}` : ""

  return apiRequest<AuthUser[]>(`/users/manage${queryString}`, {
    token,
  })
}

export function createSalesExecutive(
  token: string,
  input: CreateSalesExecutiveInput
) {
  return apiRequest<AuthUser>("/users/sales-executives", {
    method: "POST",
    token,
    body: cleanInput(input),
  })
}

export function createUser(token: string, input: CreateUserInput) {
  return apiRequest<AuthUser>("/users", {
    method: "POST",
    token,
    body: cleanInput(input),
  })
}

export function getPendingOnboardingRequests(token: string) {
  return apiRequest<AuthUser[]>("/users/onboarding/pending", { token })
}

export function approveSalesExecutive(token: string, userId: string) {
  return apiRequest<AuthUser>(`/users/${userId}/onboarding/approve`, {
    method: "PATCH",
    token,
  })
}

export function rejectSalesExecutive(token: string, userId: string) {
  return apiRequest<AuthUser>(`/users/${userId}/onboarding/reject`, {
    method: "PATCH",
    token,
  })
}

export function getMe(token: string) {
  return apiRequest<AuthUser>("/users/me", { token })
}

export function completeSalesProfile(
  token: string,
  input: CompleteSalesProfileInput
) {
  return apiRequest<AuthUser>("/users/me/profile", {
    method: "PATCH",
    token,
    body: cleanInput(input),
  })
}

export function generatePasswordOtp(token: string) {
  return apiRequest<PasswordOtpResponse>("/users/me/password-otp", {
    method: "POST",
    token,
  })
}

export function changePasswordWithOtp(
  token: string,
  input: { otp: string; newPassword: string }
) {
  return apiRequest<AuthUser>("/users/me/change-password", {
    method: "POST",
    token,
    body: cleanInput(input),
  })
}

function cleanInput(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ])
      .filter(([, value]) => value !== "" && value !== undefined)
  )
}
