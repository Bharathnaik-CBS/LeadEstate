import { apiRequest } from "@/lib/api"
import {
  getToken,
  removeAuthSession,
  saveAuthSession,
  type AuthSession,
  type AuthUser,
} from "@/lib/auth"

export async function verifyStoredSession(): Promise<AuthSession | null> {
  const verifiedToken = getToken()

  if (!verifiedToken) {
    removeAuthSession()
    return null
  }

  try {
    const user = await apiRequest<AuthUser>("/users/me", {
      token: verifiedToken,
    })
    const session = {
      accessToken: verifiedToken,
      user,
    }

    saveAuthSession(session)
    return session
  } catch {
    if (getToken() === verifiedToken) {
      removeAuthSession()
    }

    return null
  }
}
