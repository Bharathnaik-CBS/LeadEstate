"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { getLandingPathForUser, removeAuthSession } from "@/lib/auth"
import { verifyStoredSession } from "@/lib/session"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    void verifyStoredSession().then((session) => {
      if (!session) {
        removeAuthSession()
        router.replace("/login")
        return
      }

      router.replace(getLandingPathForUser(session.user))
    })
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Opening Lead Estate...
      </div>
    </main>
  )
}
