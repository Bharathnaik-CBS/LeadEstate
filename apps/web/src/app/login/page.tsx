"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, apiRequest, getFriendlyApiError } from "@/lib/api"
import {
  getLandingPathForUser,
  saveAuthSession,
  type AuthSession,
} from "@/lib/auth"
import { verifyStoredSession } from "@/lib/session"

export default function LoginPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let isActive = true

    void verifyStoredSession().then((session) => {
      if (!isActive) {
        return
      }

      if (session) {
        router.replace(getLandingPathForUser(session.user))
      }
    })

    return () => {
      isActive = false
    }
  }, [router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const session = await apiRequest<AuthSession>("/auth/login", {
        method: "POST",
        body: {
          identifier: identifier.trim(),
          password,
        },
      })

      saveAuthSession(session)
      router.replace(getLandingPathForUser(session.user))
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Invalid email or password."
          : getFriendlyApiError(err, "Unable to sign in. Please try again.")
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md rounded-lg">
        <CardHeader className="space-y-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="size-6" />
          </span>
          <div>
            <CardTitle className="text-2xl">Lead Estate</CardTitle>
            <CardDescription>
              Sign in to manage leads and follow-ups.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="identifier">Email or username</Label>
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                disabled={isSubmitting}
                onChange={(event) => setIdentifier(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                disabled={isSubmitting}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error ? (
              <div
                aria-live="polite"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
