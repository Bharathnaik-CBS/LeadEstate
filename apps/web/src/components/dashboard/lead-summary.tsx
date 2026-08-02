"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiRequest, getFriendlyApiError } from "@/lib/api"
import { getToken } from "@/lib/auth"
import { cn } from "@/lib/utils"

type LeadStatus =
  | "NEW"
  | "FOLLOW_UP"
  | "SITE_VISIT"
  | "NEGOTIATION"
  | "BLOCKED"
  | "BOOKED"
  | "CANCELLED"

type LeadDashboardSummary = {
  total: number
  byStatus: Record<LeadStatus, number>
}

const STATUS_ITEMS: Array<{
  key: LeadStatus
  label: string
  accent: string
}> = [
  { key: "NEW", label: "New", accent: "border-l-sky-500" },
  { key: "FOLLOW_UP", label: "Follow-up", accent: "border-l-cyan-500" },
  { key: "SITE_VISIT", label: "Site Visit", accent: "border-l-violet-500" },
  { key: "NEGOTIATION", label: "Negotiation", accent: "border-l-indigo-500" },
  { key: "BLOCKED", label: "Blocked", accent: "border-l-amber-500" },
  { key: "BOOKED", label: "Booked", accent: "border-l-emerald-500" },
  { key: "CANCELLED", label: "Cancelled", accent: "border-l-rose-500" },
]

type LeadSummaryProps = {
  scopeLabel: string
}

export function LeadSummary({ scopeLabel }: LeadSummaryProps) {
  const [summary, setSummary] = useState<LeadDashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadSummary = useCallback(async () => {
    const token = getToken()

    if (!token) {
      setError("Your session has expired. Please log in again.")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await apiRequest<LeadDashboardSummary>(
        "/leads/dashboard/summary",
        { token }
      )
      setSummary(data)
    } catch (err) {
      setError(getFriendlyApiError(err, "Unable to load summary"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadSummary)
  }, [loadSummary])

  if (isLoading) {
    return <LeadSummarySkeleton />
  }

  if (error) {
    return (
      <Card className="rounded-lg border-destructive/30">
        <CardHeader>
          <CardTitle>Lead summary unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button type="button" variant="outline" onClick={loadSummary}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Lead summary</h2>
          <p className="text-sm text-muted-foreground">{scopeLabel}</p>
        </div>
        <Button type="button" variant="outline" onClick={loadSummary}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total leads" value={summary?.total ?? 0} />
        {STATUS_ITEMS.map((item) => (
          <SummaryCard
            key={item.key}
            label={item.label}
            value={summary?.byStatus[item.key] ?? 0}
            accent={item.accent}
          />
        ))}
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: string
}) {
  return (
    <Card className={cn("rounded-lg border-l-4", accent ?? "border-l-primary")}>
      <CardContent className="py-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-normal">{value}</p>
      </CardContent>
    </Card>
  )
}

function LeadSummarySkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <Card key={index} className="rounded-lg">
            <CardContent className="space-y-3 py-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
