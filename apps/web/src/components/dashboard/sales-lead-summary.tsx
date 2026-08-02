"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getFriendlyApiError } from "@/lib/api"
import { getToken } from "@/lib/auth"
import { getMyLeads, type Lead } from "@/lib/leads"
import { cn } from "@/lib/utils"

type SalesSummary = {
  total: number
  newLeads: number
  active: number
  converted: number
  cancelled: number
  followUpsDue: number
}

const CARD_ITEMS: Array<{
  key: keyof SalesSummary
  label: string
  accent: string
}> = [
  { key: "total", label: "Total Leads", accent: "border-l-primary" },
  { key: "newLeads", label: "New Leads", accent: "border-l-sky-500" },
  { key: "active", label: "Active Leads", accent: "border-l-amber-500" },
  { key: "converted", label: "Booked Leads", accent: "border-l-emerald-500" },
  { key: "cancelled", label: "Cancelled Leads", accent: "border-l-rose-500" },
  { key: "followUpsDue", label: "Follow-ups Due", accent: "border-l-violet-500" },
]

export function SalesLeadSummary() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const summary = useMemo(() => deriveSummary(leads), [leads])

  const loadLeads = useCallback(async () => {
    const token = getToken()

    if (!token) {
      setError("Your session has expired. Please log in again.")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      setLeads(await getMyLeads(token))
    } catch (err) {
      setError(getFriendlyApiError(err, "Unable to load leads"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadLeads)
  }, [loadLeads])

  if (isLoading) {
    return <SalesLeadSummarySkeleton />
  }

  if (error) {
    return (
      <Card className="rounded-lg border-destructive/30">
        <CardContent className="space-y-4 py-0">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button type="button" variant="outline" onClick={loadLeads}>
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
          <h2 className="text-base font-semibold">My Pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Lead counts are based on your assigned leads.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadLeads}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CARD_ITEMS.map((item) => (
          <SummaryCard
            key={item.key}
            label={item.label}
            value={summary[item.key]}
            accent={item.accent}
          />
        ))}
      </div>

      {summary.total === 0 ? (
        <EmptyState message="No assigned leads yet." />
      ) : summary.followUpsDue === 0 ? (
        <EmptyState message="No follow-ups due." />
      ) : null}
    </div>
  )
}

function deriveSummary(leads: Lead[]): SalesSummary {
  return {
    total: leads.length,
    newLeads: leads.filter((lead) => lead.status === "NEW").length,
    active: leads.filter((lead) =>
      ["FOLLOW_UP", "SITE_VISIT", "NEGOTIATION", "BLOCKED"].includes(
        lead.status
      )
    ).length,
    converted: leads.filter((lead) => lead.status === "BOOKED").length,
    cancelled: leads.filter((lead) => lead.status === "CANCELLED").length,
    followUpsDue: leads.filter(isFollowUpDue).length,
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function isFollowUpDue(lead: Lead) {
  if (
    !lead.followUpDate ||
    lead.status === "BOOKED" ||
    lead.status === "CANCELLED"
  ) {
    return false
  }

  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  return new Date(lead.followUpDate) <= todayEnd
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  return (
    <Card className={cn("rounded-lg border-l-4", accent)}>
      <CardContent className="py-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-normal">{value}</p>
      </CardContent>
    </Card>
  )
}

function SalesLeadSummarySkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="rounded-lg">
            <CardContent className="space-y-3 py-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
