"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BarChart3,
  Building2,
  RefreshCw,
  Shield,
  TrendingUp,
  UserRound,
} from "lucide-react"
import { DashboardMetricCard } from "@/components/dashboard/dashboard-metric-card"
import {
  DashboardEmpty,
  DashboardError,
  DashboardLoading,
} from "@/components/dashboard/dashboard-state"
import {
  StatusBreakdownCard,
  type StatusBreakdownItem,
} from "@/components/dashboard/status-breakdown-card"
import { Button } from "@/components/ui/button"
import { getFriendlyApiError } from "@/lib/api"
import { getToken } from "@/lib/auth"
import {
  getSalesDashboardSummary,
  type DashboardBookingStatus,
  type DashboardLeadStatus,
  type SalesDashboardSummary,
} from "@/lib/dashboard"
import { formatLocalDateTime } from "@/lib/date"

type StatusConfig<TStatus extends string> = {
  status: TStatus
  label: string
  accent: string
}

const LEAD_STATUS_CONFIG: Array<StatusConfig<DashboardLeadStatus>> = [
  { status: "NEW", label: "New", accent: "bg-sky-500" },
  { status: "FOLLOW_UP", label: "Follow-up", accent: "bg-cyan-500" },
  { status: "SITE_VISIT", label: "Site Visit", accent: "bg-violet-500" },
  { status: "NEGOTIATION", label: "Negotiation", accent: "bg-indigo-500" },
  { status: "BLOCKED", label: "Blocked", accent: "bg-amber-500" },
  { status: "BOOKED", label: "Booked", accent: "bg-emerald-500" },
  { status: "CANCELLED", label: "Cancelled", accent: "bg-rose-500" },
]

const BOOKING_STATUS_CONFIG: Array<StatusConfig<DashboardBookingStatus>> = [
  { status: "ACTIVE", label: "Active", accent: "bg-emerald-500" },
  { status: "CANCELLED", label: "Cancelled", accent: "bg-rose-500" },
  { status: "CLOSED", label: "Closed", accent: "bg-slate-500" },
]

export function SalesDashboardClient() {
  const [summary, setSummary] = useState<SalesDashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const leadBreakdown = useMemo(
    () =>
      summary
        ? toBreakdownItems(summary.breakdowns.leadsByStatus, LEAD_STATUS_CONFIG)
        : [],
    [summary]
  )
  const bookingBreakdown = useMemo(
    () =>
      summary
        ? toBreakdownItems(
            summary.breakdowns.bookingsByStatus,
            BOOKING_STATUS_CONFIG
          )
        : [],
    [summary]
  )
  const hasDashboardData = useMemo(
    () =>
      summary
        ? Object.values(summary.totals).some((value) => value > 0) ||
          Object.values(summary.pendingActions).some((value) => value > 0)
        : false,
    [summary]
  )

  const loadDashboard = useCallback(async () => {
    const token = getToken()

    if (!token) {
      setError("Your session has expired. Please log in again.")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      setSummary(await getSalesDashboardSummary(token))
    } catch (err) {
      setError(getFriendlyApiError(err, "Unable to load sales dashboard"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadDashboard)
  }, [loadDashboard])

  if (isLoading) {
    return (
      <DashboardLoading
        title="Loading sales dashboard"
        description="Preparing your summary and pending work."
        rows={9}
        sections={2}
      />
    )
  }

  if (error) {
    return (
      <DashboardError
        title="Sales dashboard unavailable"
        message={error}
        onRetry={loadDashboard}
      />
    )
  }

  if (!summary) {
    return (
      <DashboardEmpty
        title="No dashboard data"
        message="Your dashboard data is not available yet."
      />
    )
  }

  return (
    <div className="space-y-8">
      <section
        className="space-y-4"
        aria-labelledby="sales-dashboard-summary-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="sales-dashboard-summary-heading"
              className="text-base font-semibold"
            >
              My dashboard
            </h2>
            <p className="text-sm text-muted-foreground">
              Updated {formatLocalDateTime(summary.generatedAt)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="self-start sm:self-auto"
            aria-label="Refresh sales dashboard data"
            onClick={loadDashboard}
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardMetricCard
            label="My Leads"
            value={summary.totals.leads}
            description="Leads assigned to you"
            icon={BarChart3}
          />
          <DashboardMetricCard
            label="Customers"
            value={summary.totals.customers}
            description="Customers in your pipeline"
            icon={UserRound}
            accent="border-l-sky-500"
          />
          <DashboardMetricCard
            label="Bookings"
            value={summary.totals.bookings}
            description="Bookings handled by you"
            icon={TrendingUp}
            accent="border-l-emerald-500"
          />
          <DashboardMetricCard
            label="Site Visits"
            value={summary.totals.siteVisits}
            description="Visits tied to your work"
            icon={Building2}
            accent="border-l-cyan-500"
          />
        </div>
      </section>

      <section
        className="space-y-4"
        aria-labelledby="sales-pending-work-heading"
      >
        <div>
          <h2 id="sales-pending-work-heading" className="text-base font-semibold">
            Pending work
          </h2>
          <p className="text-sm text-muted-foreground">
            Follow-ups, site visits, and booking tasks that need attention.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          <DashboardMetricCard
            label="Follow-ups Due"
            value={summary.pendingActions.followUpsDue}
            description="Due now or overdue"
            icon={RefreshCw}
            accent="border-l-violet-500"
          />
          <DashboardMetricCard
            label="Upcoming Visits"
            value={summary.pendingActions.siteVisitsUpcoming}
            description="Scheduled in the next 7 days"
            icon={Building2}
            accent="border-l-cyan-500"
          />
          <DashboardMetricCard
            label="KYC Pending"
            value={summary.pendingActions.kycPending}
            description="Bookings needing KYC"
            icon={Shield}
            accent="border-l-amber-500"
          />
          <DashboardMetricCard
            label="Payment Pending"
            value={summary.pendingActions.paymentPending}
            description="Payments awaiting review"
            icon={TrendingUp}
            accent="border-l-orange-500"
          />
          <DashboardMetricCard
            label="Blocks Expiring"
            value={summary.pendingActions.plotBlocksExpiring}
            description="Expiring in the next 7 days"
            icon={Building2}
            accent="border-l-rose-500"
          />
        </div>
      </section>

      {!hasDashboardData ? (
        <DashboardEmpty
          title="No assigned activity yet"
          message="New leads, follow-ups, visits, and bookings will appear here as work is assigned."
        />
      ) : null}

      <section
        className="space-y-4"
        aria-labelledby="sales-breakdowns-heading"
      >
        <div>
          <h2 id="sales-breakdowns-heading" className="text-base font-semibold">
            Pipeline breakdowns
          </h2>
          <p className="text-sm text-muted-foreground">
            Status distribution for your assigned leads and bookings.
          </p>
        </div>
        <div className="grid items-stretch gap-4 xl:grid-cols-2">
          <StatusBreakdownCard
            title="My lead status"
            description="Assigned lead counts by status."
            items={leadBreakdown}
          />
          <StatusBreakdownCard
            title="My booking status"
            description="Your booking lifecycle counts."
            items={bookingBreakdown}
          />
        </div>
      </section>
    </div>
  )
}

function toBreakdownItems<TStatus extends string>(
  counts: Record<TStatus, number>,
  config: Array<StatusConfig<TStatus>>
): StatusBreakdownItem[] {
  return config.map((item) => ({
    label: item.label,
    value: counts[item.status] ?? 0,
    accent: item.accent,
  }))
}
