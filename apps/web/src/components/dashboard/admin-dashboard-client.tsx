"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  BarChart3,
  Building2,
  CalendarDays,
  RefreshCw,
  Shield,
  TrendingUp,
  UserRound,
} from "lucide-react"
import { DashboardChartCard } from "@/components/dashboard/dashboard-chart-card"
import { DashboardMetricCard } from "@/components/dashboard/dashboard-metric-card"
import {
  DashboardEmpty,
  DashboardError,
  DashboardLoading,
} from "@/components/dashboard/dashboard-state"
import { PendingActionsCard } from "@/components/dashboard/pending-actions-card"
import { RecentActivityCard } from "@/components/dashboard/recent-activity-card"
import {
  StatusBreakdownCard,
  type StatusBreakdownItem,
} from "@/components/dashboard/status-breakdown-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getFriendlyApiError } from "@/lib/api"
import { getToken } from "@/lib/auth"
import {
  type AdminDashboardFilters,
  getAdminDashboardSummary,
  getDashboardPendingActions,
  getDashboardRecentActivity,
  type AdminDashboardSummary,
  type DashboardBookingStatus,
  type DashboardLeadStatus,
  type DashboardLeadSource,
  type DashboardPendingActionItem,
  type DashboardPlotStatus,
  type DashboardRecentActivityItem,
} from "@/lib/dashboard"
import { formatLocalDateTime } from "@/lib/date"

const EMPTY_FILTER_VALUE = "__all"

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

const PLOT_STATUS_CONFIG: Array<StatusConfig<DashboardPlotStatus>> = [
  { status: "AVAILABLE", label: "Available", accent: "bg-teal-500" },
  { status: "BLOCKED", label: "Blocked", accent: "bg-amber-500" },
  { status: "BOOKED", label: "Booked", accent: "bg-emerald-500" },
  { status: "SOLD", label: "Sold", accent: "bg-indigo-500" },
  { status: "CANCELLED", label: "Cancelled", accent: "bg-rose-500" },
]

export function AdminDashboardClient() {
  const [filters, setFilters] = useState<AdminDashboardFilters>(() =>
    createDefaultFilters()
  )
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null)
  const [pendingActions, setPendingActions] = useState<
    DashboardPendingActionItem[]
  >([])
  const [recentActivity, setRecentActivity] = useState<
    DashboardRecentActivityItem[]
  >([])
  const [recentActivityCursor, setRecentActivityCursor] = useState<
    string | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMoreActivity, setIsLoadingMoreActivity] = useState(false)

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
  const plotBreakdown = useMemo(
    () =>
      summary
        ? toBreakdownItems(summary.breakdowns.plotsByStatus, PLOT_STATUS_CONFIG)
        : [],
    [summary]
  )
  const leadTrendPoints = useMemo(
    () =>
      summary?.analytics?.totalLeadsTrend.map((point) => ({
        label: point.label,
        count: point.count,
      })) ?? [],
    [summary]
  )
  const dailyLeadPoints = useMemo(
    () =>
      summary?.analytics?.leadsByDay.map((point) => ({
        label: point.label,
        count: point.count,
      })) ?? [],
    [summary]
  )
  const projectLeadPoints = useMemo(
    () =>
      summary?.analytics?.leadsByProject.slice(0, 8).map((point) => ({
        label: point.label,
        count: point.count,
      })) ?? [],
    [summary]
  )
  const sourceLeadPoints = useMemo(
    () =>
      summary?.analytics?.leadsBySource.slice(0, 8).map((point) => ({
        label: point.label,
        count: point.count,
      })) ?? [],
    [summary]
  )
  const platformLeadPoints = useMemo(
    () =>
      summary?.analytics?.leadsByPlatform.slice(0, 8).map((point) => ({
        label: point.label,
        count: point.count,
      })) ?? [],
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
      const [summaryData, pendingActionData, activityData] = await Promise.all([
        getAdminDashboardSummary(token, filters),
        getDashboardPendingActions(token),
        getDashboardRecentActivity(token),
      ])

      setSummary(summaryData)
      setPendingActions(pendingActionData.items)
      setRecentActivity(activityData.items)
      setRecentActivityCursor(activityData.nextCursor)
    } catch (err) {
      setError(getFriendlyApiError(err, "Unable to load admin dashboard"))
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  const loadMoreRecentActivity = useCallback(async () => {
    if (!recentActivityCursor) {
      return
    }

    const token = getToken()

    if (!token) {
      setError("Your session has expired. Please log in again.")
      return
    }

    setIsLoadingMoreActivity(true)
    setError(null)

    try {
      const activityData = await getDashboardRecentActivity(
        token,
        recentActivityCursor
      )

      setRecentActivity((current) => [...current, ...activityData.items])
      setRecentActivityCursor(activityData.nextCursor)
    } catch (err) {
      setError(getFriendlyApiError(err, "Unable to load recent activity"))
    } finally {
      setIsLoadingMoreActivity(false)
    }
  }, [recentActivityCursor])

  useEffect(() => {
    void Promise.resolve().then(loadDashboard)
  }, [loadDashboard])

  function updateFilter<Key extends keyof AdminDashboardFilters>(
    key: Key,
    value: AdminDashboardFilters[Key] | typeof EMPTY_FILTER_VALUE
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value === EMPTY_FILTER_VALUE || value === "" ? undefined : value,
    }))
  }

  if (isLoading) {
    return (
      <DashboardLoading
        title="Loading admin dashboard"
        description="Preparing summary metrics, actions, and activity."
        rows={8}
        sections={3}
      />
    )
  }

  if (error) {
    return (
      <DashboardError
        title="Admin dashboard unavailable"
        message={error}
        onRetry={loadDashboard}
      />
    )
  }

  if (!summary) {
    return (
      <DashboardEmpty
        title="No dashboard data"
        message="Admin dashboard data is not available yet."
      />
    )
  }

  return (
    <div className="space-y-8">
      <section
        className="space-y-4"
        aria-labelledby="admin-dashboard-snapshot-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="admin-dashboard-snapshot-heading"
              className="text-base font-semibold"
            >
              Dashboard snapshot
            </h2>
            <p className="text-sm text-muted-foreground">
              Updated {formatLocalDateTime(summary.generatedAt)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="self-start sm:self-auto"
            aria-label="Refresh admin dashboard data"
            onClick={loadDashboard}
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-3 rounded-lg border bg-background p-4 sm:grid-cols-2 xl:grid-cols-6">
          <FilterField label="Start date" htmlFor="admin-start-date">
            <Input
              id="admin-start-date"
              type="date"
              value={filters.startDate ?? ""}
              onChange={(event) => updateFilter("startDate", event.target.value)}
            />
          </FilterField>
          <FilterField label="End date" htmlFor="admin-end-date">
            <Input
              id="admin-end-date"
              type="date"
              value={filters.endDate ?? ""}
              onChange={(event) => updateFilter("endDate", event.target.value)}
            />
          </FilterField>
          <FilterField label="Selected day" htmlFor="admin-selected-date">
            <Input
              id="admin-selected-date"
              type="date"
              value={filters.selectedDate ?? ""}
              onChange={(event) =>
                updateFilter("selectedDate", event.target.value)
              }
            />
          </FilterField>
          <FilterField label="Project" htmlFor="admin-project-filter">
            <Select
              value={filters.projectId ?? EMPTY_FILTER_VALUE}
              onValueChange={(value) => updateFilter("projectId", value)}
            >
              <SelectTrigger id="admin-project-filter" className="w-full">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_FILTER_VALUE}>All projects</SelectItem>
                {summary.filters?.availableProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Source" htmlFor="admin-source-filter">
            <Select
              value={filters.source ?? EMPTY_FILTER_VALUE}
              onValueChange={(value) =>
                updateFilter(
                  "source",
                  value as DashboardLeadSource | typeof EMPTY_FILTER_VALUE
                )
              }
            >
              <SelectTrigger id="admin-source-filter" className="w-full">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_FILTER_VALUE}>All sources</SelectItem>
                {summary.filters?.availableSources.map((source) => (
                  <SelectItem key={source} value={source}>
                    {toTitleLabel(source)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Platform" htmlFor="admin-platform-filter">
            <Select
              value={filters.platformId ?? EMPTY_FILTER_VALUE}
              onValueChange={(value) => updateFilter("platformId", value)}
            >
              <SelectTrigger id="admin-platform-filter" className="w-full">
                <SelectValue placeholder="All platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_FILTER_VALUE}>All platforms</SelectItem>
                {summary.filters?.availablePlatforms.map((platform) => (
                  <SelectItem key={platform.id} value={platform.id}>
                    {platform.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardMetricCard
            label="Total Leads"
            value={summary.totals.leads}
            description="All leads in the pipeline"
            icon={BarChart3}
          />
          <DashboardMetricCard
            label="Customers"
            value={summary.totals.customers}
            description="Converted customer records"
            icon={UserRound}
            accent="border-l-sky-500"
          />
          <DashboardMetricCard
            label="Bookings"
            value={summary.totals.bookings}
            description="Active and closed bookings"
            icon={TrendingUp}
            accent="border-l-emerald-500"
          />
          <DashboardMetricCard
            label="Projects"
            value={summary.totals.projects}
            description="Projects available in CRM"
            icon={Building2}
            accent="border-l-indigo-500"
          />
          <DashboardMetricCard
            label="Filtered Leads"
            value={summary.analytics?.totalLeads ?? summary.totals.leads}
            description="Leads matching dashboard filters"
            icon={BarChart3}
            accent="border-l-teal-500"
          />
          <DashboardMetricCard
            label="Selected Day"
            value={summary.analytics?.leadsOnSelectedDay.count ?? 0}
            description={`Created on ${
              summary.analytics?.leadsOnSelectedDay.label ?? "selected day"
            }`}
            icon={CalendarDays}
            accent="border-l-sky-500"
          />
          <DashboardMetricCard
            label="Follow-ups Due"
            value={summary.pendingActions.followUpsDue}
            description="Pending follow-up work"
            icon={RefreshCw}
            accent="border-l-violet-500"
          />
          <DashboardMetricCard
            label="KYC Pending"
            value={summary.pendingActions.kycPending}
            description="Bookings awaiting KYC"
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
            label="Site Visits"
            value={summary.pendingActions.siteVisitsUpcoming}
            description="Scheduled in the next 7 days"
            icon={Building2}
            accent="border-l-cyan-500"
          />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="admin-analytics-heading">
        <div>
          <h2 id="admin-analytics-heading" className="text-base font-semibold">
            Lead analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Filtered lead movement and source mix for the demo period.
          </p>
        </div>
        <div className="grid items-stretch gap-4 xl:grid-cols-2">
          <DashboardChartCard
            title="Total leads trend"
            description="Cumulative lead count through the selected range."
            points={leadTrendPoints}
            type="line"
          />
          <DashboardChartCard
            title="Daily leads"
            description="Leads created each day in the selected range."
            points={dailyLeadPoints}
          />
          <DashboardChartCard
            title="Leads per project"
            description="Top projects by final project selection."
            points={projectLeadPoints}
          />
          <DashboardChartCard
            title={
              platformLeadPoints.some((point) => point.count > 0)
                ? "Leads by platform"
                : "Leads by source"
            }
            description="Where filtered leads are coming from."
            points={
              platformLeadPoints.some((point) => point.count > 0)
                ? platformLeadPoints
                : sourceLeadPoints
            }
          />
        </div>
      </section>

      <section
        className="space-y-4"
        aria-labelledby="admin-breakdowns-heading"
      >
        <div>
          <h2 id="admin-breakdowns-heading" className="text-base font-semibold">
            Pipeline breakdowns
          </h2>
          <p className="text-sm text-muted-foreground">
            Status distribution across leads, bookings, and plots.
          </p>
        </div>
        <div className="grid items-stretch gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <StatusBreakdownCard
            title="Lead status"
            description="Current lead pipeline by status."
            items={leadBreakdown}
          />
          <StatusBreakdownCard
            title="Booking status"
            description="Booking lifecycle counts."
            items={bookingBreakdown}
          />
          <StatusBreakdownCard
            title="Plot status"
            description="Inventory availability by plot status."
            items={plotBreakdown}
          />
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="admin-activity-heading">
        <div>
          <h2 id="admin-activity-heading" className="text-base font-semibold">
            Operational activity
          </h2>
          <p className="text-sm text-muted-foreground">
            Work requiring attention and the latest CRM updates.
          </p>
        </div>
        <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <PendingActionsCard items={pendingActions} />
          <RecentActivityCard
            items={recentActivity}
            nextCursor={recentActivityCursor}
            isLoadingMore={isLoadingMoreActivity}
            onLoadMore={loadMoreRecentActivity}
          />
        </div>
      </section>
    </div>
  )
}

function FilterField({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </Label>
      {children}
    </div>
  )
}

function createDefaultFilters(): AdminDashboardFilters {
  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setDate(endDate.getDate() - 13)

  return {
    startDate: toDateInput(startDate),
    endDate: toDateInput(endDate),
    selectedDate: toDateInput(endDate),
  }
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function toTitleLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ")
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
