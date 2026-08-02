import { apiRequest } from "@/lib/api"

export type DashboardLeadStatus =
  | "NEW"
  | "FOLLOW_UP"
  | "SITE_VISIT"
  | "NEGOTIATION"
  | "BLOCKED"
  | "BOOKED"
  | "CANCELLED"

export type DashboardBookingStatus = "ACTIVE" | "CANCELLED" | "CLOSED"

export type DashboardLeadSource =
  | "SE_GENERATED"
  | "ADMIN_GENERATED"
  | "WEBSITE"
  | "REFERRAL"
  | "WALK_IN"
  | "PHONE_CALL"
  | "SOCIAL_MEDIA"
  | "OTHER"

export type DashboardPlotStatus =
  | "AVAILABLE"
  | "BLOCKED"
  | "BOOKED"
  | "SOLD"
  | "CANCELLED"

export type DashboardPendingActionPriority = "HIGH" | "MEDIUM" | "LOW"

export type DashboardPendingActionType =
  | "FOLLOW_UP"
  | "KYC_REVIEW"
  | "PAYMENT_PENDING"
  | "SITE_VISIT"
  | "PLOT_BLOCK_EXPIRY"
  | (string & {})

export type DashboardPendingActionEntityType =
  | "FollowUp"
  | "BookingKyc"
  | "BookingPayment"
  | "SiteVisit"
  | "PlotBlock"
  | (string & {})

export type DashboardUserRole =
  | "ADMIN"
  | "SALES_EXECUTIVE"
  | "PROJECT_INVENTORY_MANAGER"
  | "SITE_VISIT_COORDINATOR"
  | (string & {})

export type DashboardCountRecord<TStatus extends string> = Record<
  TStatus,
  number
>

export type DashboardPendingActionCounts = {
  followUpsDue: number
  kycPending: number
  paymentPending: number
  siteVisitsUpcoming: number
  plotBlocksExpiring: number
}

export type AdminDashboardSummary = {
  generatedAt: string
  totals: {
    leads: number
    customers: number
    bookings: number
    projects: number
  }
  breakdowns: {
    leadsByStatus: DashboardCountRecord<DashboardLeadStatus>
    bookingsByStatus: DashboardCountRecord<DashboardBookingStatus>
    plotsByStatus: DashboardCountRecord<DashboardPlotStatus>
  }
  pendingActions: DashboardPendingActionCounts
  filters?: {
    startDate: string
    endDate: string
    selectedDate: string
    projectId: string | null
    source: DashboardLeadSource | null
    platformId: string | null
    availableProjects: Array<{
      id: string
      projectName: string
      location: string
    }>
    availablePlatforms: Array<{
      id: string
      name: string
    }>
    availableSources: DashboardLeadSource[]
  }
  analytics?: {
    totalLeads: number
    totalLeadsTrend: DashboardChartPoint[]
    leadsByProject: DashboardBreakdownPoint[]
    leadsBySource: Array<
      DashboardBreakdownPoint & { source: DashboardLeadSource | null }
    >
    leadsByPlatform: DashboardBreakdownPoint[]
    leadsByDay: DashboardChartPoint[]
    leadsOnSelectedDay: DashboardChartPoint
    dateRange: {
      startDate: string
      endDate: string
      days: number
    }
  }
}

export type AdminDashboardFilters = {
  startDate?: string
  endDate?: string
  selectedDate?: string
  projectId?: string
  source?: DashboardLeadSource
  platformId?: string
}

export type DashboardChartPoint = {
  date: string
  label: string
  count: number
}

export type DashboardBreakdownPoint = {
  projectId?: string | null
  platformId?: string | null
  label: string
  count: number
}

export type SalesDashboardSummary = {
  generatedAt: string
  totals: {
    leads: number
    customers: number
    bookings: number
    siteVisits: number
  }
  breakdowns: {
    leadsByStatus: DashboardCountRecord<DashboardLeadStatus>
    bookingsByStatus: DashboardCountRecord<DashboardBookingStatus>
  }
  pendingActions: DashboardPendingActionCounts
}

export type DashboardPendingActionItem = {
  id: string
  type: DashboardPendingActionType
  priority: DashboardPendingActionPriority
  title: string
  dueAt?: string
  entity: {
    type: DashboardPendingActionEntityType
    id: string
    label: string
  }
}

export type DashboardPendingActionsResponse = {
  generatedAt: string
  items: DashboardPendingActionItem[]
}

export type DashboardRecentActivityActor = {
  id: string
  name: string
  email: string
  role: DashboardUserRole
}

export type DashboardRecentActivityItem = {
  id: string
  action: string
  targetType: string
  targetId: string
  occurredAt: string
  actor?: DashboardRecentActivityActor | null
  metadata?: unknown
}

export type DashboardRecentActivityResponse = {
  items: DashboardRecentActivityItem[]
  nextCursor: string | null
}

export function getAdminDashboardSummary(
  token: string,
  filters: AdminDashboardFilters = {}
) {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      query.set(key, value)
    }
  }

  const queryString = query.toString() ? `?${query.toString()}` : ""

  return apiRequest<AdminDashboardSummary>(
    `/dashboard/admin/summary${queryString}`,
    {
      token,
    }
  )
}

export function getSalesDashboardSummary(token: string) {
  return apiRequest<SalesDashboardSummary>("/dashboard/sales/summary", {
    token,
  })
}

export function getDashboardPendingActions(token: string) {
  return apiRequest<DashboardPendingActionsResponse>(
    "/dashboard/pending-actions",
    { token }
  )
}

export function getDashboardRecentActivity(token: string, cursor?: string) {
  const query = cursor ? `?${new URLSearchParams({ cursor }).toString()}` : ""

  return apiRequest<DashboardRecentActivityResponse>(
    `/dashboard/recent-activity${query}`,
    { token }
  )
}
