import { API_URL, ApiError, apiRequest } from "@/lib/api"
import type { LeadSource, LeadStatus } from "@/lib/leads"

export type ReportDateFilters = {
  from?: string
  to?: string
}

export type ReportFilters = {
  from: string | null
  to: string | null
}

export type ReportCountRecord<TStatus extends string> = Record<TStatus, number>

export type ReportLeadSource = LeadSource | "UNSPECIFIED"

export type LeadReportItem = {
  id: string
  fullName: string
  phone: string
  email: string | null
  status: LeadStatus
  source: ReportLeadSource | null
  propertyType: string | null
  budget: string | null
  location: string | null
  assignedTo: ReportPerson | null
  createdBy: ReportPerson | null
  finalProject: {
    id: string
    projectName: string
    location: string
  } | null
  finalPlot: {
    id: string
    plotNumber: string
  } | null
  bookingAmount: string | null
  bookingDate: string | null
  followUpDate: string | null
  createdAt: string
  updatedAt: string
}

export type LeadReportResponse = {
  generatedAt: string
  filters: ReportFilters
  totals: {
    total: number
    byStatus: ReportCountRecord<LeadStatus>
    bySource: ReportCountRecord<ReportLeadSource>
  }
  items: LeadReportItem[]
}

export type BookingType = "BLOCKED" | "BOOKED"
export type BookingStatus = "ACTIVE" | "CANCELLED" | "CLOSED"

export type BookingReportItem = {
  id: string
  type: BookingType
  status: BookingStatus
  contactName: string
  leadName: string | null
  customerName: string | null
  projectName: string
  plotNumber: string
  salesExecutive: ReportPerson
  amountPaid: string | null
  bookingDate: string
  closedAt: string | null
  cancelledAt: string | null
}

export type BookingReportResponse = {
  generatedAt: string
  filters: ReportFilters
  totals: {
    total: number
    amountPaidTotal: number
    byStatus: ReportCountRecord<BookingStatus>
    byType: ReportCountRecord<BookingType>
  }
  items: BookingReportItem[]
}

export type SalesPerformanceItem = {
  salesExecutiveId: string
  name: string
  email: string
  seId: string | null
  leadsCreated: number
  leadsAssigned: number
  bookingsTotal: number
  bookedBookings: number
  blockedBookings: number
  activeBookings: number
  closedBookings: number
  cancelledBookings: number
  amountPaidTotal: number
}

export type SalesPerformanceReportResponse = {
  generatedAt: string
  filters: ReportFilters
  totals: {
    salesExecutives: number
    leadsCreated: number
    leadsAssigned: number
    bookingsTotal: number
    closedBookings: number
    amountPaidTotal: number
  }
  items: SalesPerformanceItem[]
}

export type ReportExportKind = "leads" | "bookings" | "sales-performance"

type ReportPerson = {
  id: string
  name: string
  email: string
}

export function getLeadReport(token: string, filters: ReportDateFilters) {
  return apiRequest<LeadReportResponse>(`/reports/leads${toQuery(filters)}`, {
    token,
  })
}

export function getBookingReport(token: string, filters: ReportDateFilters) {
  return apiRequest<BookingReportResponse>(
    `/reports/bookings${toQuery(filters)}`,
    { token }
  )
}

export function getSalesPerformanceReport(
  token: string,
  filters: ReportDateFilters
) {
  return apiRequest<SalesPerformanceReportResponse>(
    `/reports/sales-performance${toQuery(filters)}`,
    { token }
  )
}

export async function downloadReportCsv(
  token: string,
  report: ReportExportKind,
  filters: ReportDateFilters
) {
  const response = await fetch(
    `${API_URL}/reports/${report}/export${toQuery(filters)}`,
    {
      headers: {
        Accept: "text/csv",
        Authorization: `Bearer ${token}`,
      },
    }
  )

  if (!response.ok) {
    throw new ApiError(await getExportErrorMessage(response), response.status)
  }

  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = getFilename(response, `${report}-report.csv`)
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}

function toQuery(filters: ReportDateFilters) {
  const params = new URLSearchParams()

  if (filters.from) {
    params.set("from", filters.from)
  }

  if (filters.to) {
    params.set("to", filters.to)
  }

  const query = params.toString()
  return query ? `?${query}` : ""
}

async function getExportErrorMessage(response: Response) {
  const contentType = response.headers.get("content-type")

  if (contentType?.includes("application/json")) {
    const data = (await response.json().catch(() => null)) as {
      message?: string | string[]
      error?: string
    } | null
    const message = data?.message

    if (Array.isArray(message)) {
      return message.join(", ")
    }

    return message ?? data?.error ?? response.statusText
  }

  return response.statusText || "Unable to export report"
}

function getFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition")
  const match = disposition?.match(/filename="?([^"]+)"?/i)
  return match?.[1] ?? fallback
}
