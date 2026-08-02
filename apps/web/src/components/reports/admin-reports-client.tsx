"use client"

import { useCallback, useEffect, useId, useMemo, useState } from "react"
import type { FormEvent, ReactNode } from "react"
import {
  Banknote,
  CalendarDays,
  Download,
  FileText,
  Printer,
  RefreshCw,
  Users,
} from "lucide-react"
import { DashboardMetricCard } from "@/components/dashboard/dashboard-metric-card"
import {
  DashboardEmpty,
  DashboardError,
  DashboardLoading,
} from "@/components/dashboard/dashboard-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import { getFriendlyApiError } from "@/lib/api"
import { getToken } from "@/lib/auth"
import { formatLocalDate, formatLocalDateTime, toDateInputValue } from "@/lib/date"
import {
  downloadReportCsv,
  getBookingReport,
  getLeadReport,
  getSalesPerformanceReport,
  type BookingReportResponse,
  type LeadReportResponse,
  type ReportDateFilters,
  type ReportExportKind,
  type SalesPerformanceReportResponse,
} from "@/lib/reports"

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat("en-IN")

export function AdminReportsClient() {
  const initialFilters = useMemo(() => getInitialFilters(), [])
  const formId = useId()
  const filterErrorId = `${formId}-date-range-error`
  const toast = useToast()
  const [draftFilters, setDraftFilters] =
    useState<ReportDateFilters>(initialFilters)
  const [appliedFilters, setAppliedFilters] =
    useState<ReportDateFilters>(initialFilters)
  const [leadReport, setLeadReport] = useState<LeadReportResponse | null>(null)
  const [bookingReport, setBookingReport] =
    useState<BookingReportResponse | null>(null)
  const [salesReport, setSalesReport] =
    useState<SalesPerformanceReportResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isApplyingFilters, setIsApplyingFilters] = useState(false)
  const [exportingReport, setExportingReport] =
    useState<ReportExportKind | null>(null)

  const token = useMemo(() => getToken(), [])
  const hasReports = leadReport && bookingReport && salesReport
  const isExportDisabled = isLoading || exportingReport !== null

  const loadReports = useCallback(async (
    filters: ReportDateFilters,
    feedback?: "filters" | "refresh"
  ) => {
    if (!token) {
      const message = "Your session has expired. Please log in again."
      setError(message)
      if (feedback) {
        toast.error("Unable to load reports", message)
      }
      setIsLoading(false)
      setIsApplyingFilters(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [leadData, bookingData, salesData] = await Promise.all([
        getLeadReport(token, filters),
        getBookingReport(token, filters),
        getSalesPerformanceReport(token, filters),
      ])

      setLeadReport(leadData)
      setBookingReport(bookingData)
      setSalesReport(salesData)
      setAppliedFilters(filters)

      if (feedback === "filters") {
        toast.success(
          "Reports updated",
          `Showing reports for ${formatRangeLabel(filters)}.`
        )
      } else if (feedback === "refresh") {
        toast.success("Reports refreshed", "Latest report data is showing.")
      }
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to load reports")
      setError(message)
      if (feedback) {
        toast.error("Unable to load reports", message)
      }
    } finally {
      setIsLoading(false)
      setIsApplyingFilters(false)
    }
  }, [toast, token])

  useEffect(() => {
    void Promise.resolve().then(() => loadReports(initialFilters))
  }, [initialFilters, loadReports])

  function handleApplyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextFilters = cleanFilters(draftFilters)
    const validationMessage = validateDateRange(nextFilters)

    if (validationMessage) {
      setFilterError(validationMessage)
      toast.error("Invalid date range", validationMessage)
      return
    }

    setFilterError(null)
    setIsApplyingFilters(true)
    void loadReports(nextFilters, "filters")
  }

  function updateDraftFilter(key: keyof ReportDateFilters, value: string) {
    setFilterError(null)
    setDraftFilters((current) => ({
      ...current,
      [key]: value || undefined,
    }))
  }

  async function handleExport(report: ReportExportKind) {
    if (!token) {
      const message = "Your session has expired. Please log in again."
      setError(message)
      toast.error("Unable to export report", message)
      return
    }

    setExportingReport(report)
    setError(null)

    try {
      await downloadReportCsv(token, report, appliedFilters)
      toast.success(
        "Export ready",
        `${formatReportKind(report)} CSV download started.`
      )
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to export report")
      setError(message)
      toast.error("Unable to export report", message)
    } finally {
      setExportingReport(null)
    }
  }

  function handlePrint() {
    window.print()
  }

  if (isLoading && !hasReports) {
    return (
      <DashboardLoading
        title="Loading reports"
        description="Preparing report totals and rows."
        rows={6}
      />
    )
  }

  if (error && !hasReports) {
    return (
      <DashboardError
        title="Reports unavailable"
        message={error}
        onRetry={() => loadReports(appliedFilters, "refresh")}
      />
    )
  }

  if (!leadReport || !bookingReport || !salesReport) {
    return (
      <DashboardEmpty
        title="No report data"
        message="Report data is not available yet."
      />
    )
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <form
        className="grid gap-3 rounded-lg border bg-background p-4 print:hidden md:grid-cols-[1fr_1fr_auto_auto]"
        noValidate
        onSubmit={handleApplyFilters}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="report-from">From</Label>
          <Input
            id="report-from"
            type="date"
            value={draftFilters.from ?? ""}
            disabled={isLoading}
            aria-invalid={Boolean(filterError)}
            aria-describedby={filterError ? filterErrorId : undefined}
            onChange={(event) => updateDraftFilter("from", event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="report-to">To</Label>
          <Input
            id="report-to"
            type="date"
            value={draftFilters.to ?? ""}
            disabled={isLoading}
            aria-invalid={Boolean(filterError)}
            aria-describedby={filterError ? filterErrorId : undefined}
            onChange={(event) => updateDraftFilter("to", event.target.value)}
          />
        </div>
        <Button
          type="submit"
          className="self-end"
          disabled={isLoading}
          aria-busy={isApplyingFilters}
          aria-describedby={filterError ? filterErrorId : undefined}
        >
          <RefreshCw
            className={isApplyingFilters ? "size-4 animate-spin" : "size-4"}
          />
          {isApplyingFilters ? "Applying..." : "Apply"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="self-end"
          disabled={isLoading}
          aria-label="Print admin reports"
          onClick={handlePrint}
        >
          <Printer className="size-4" />
          Print
        </Button>
        {filterError ? (
          <p
            id={filterErrorId}
            role="alert"
            className="text-sm text-destructive md:col-span-4"
          >
            {filterError}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground md:col-span-4">
            Apply refreshes all report totals, tables, and exports for the
            selected range.
          </p>
        )}
      </form>

      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive print:hidden"
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground print:hidden"
        >
          <RefreshCw className="size-4 animate-spin" />
          Updating report data...
        </div>
      ) : null}

      <div className="flex flex-col gap-2 print:gap-1">
        <h2 className="text-base font-semibold">Admin reports</h2>
        <p className="text-sm text-muted-foreground">
          {formatRangeLabel(appliedFilters)} - Updated{" "}
          {formatLocalDateTime(salesReport.generatedAt)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label="Leads"
          value={leadReport.totals.total}
          description="Created in range"
          icon={FileText}
        />
        <DashboardMetricCard
          label="Bookings"
          value={bookingReport.totals.total}
          description="Booked or blocked in range"
          icon={CalendarDays}
          accent="border-l-sky-500"
        />
        <DashboardMetricCard
          label="Closed sales"
          value={salesReport.totals.closedBookings}
          description="Closed booking count"
          icon={Users}
          accent="border-l-emerald-500"
        />
        <DashboardMetricCard
          label="Amount paid"
          value={formatCurrency(salesReport.totals.amountPaidTotal)}
          description="Booking amount total"
          icon={Banknote}
          accent="border-l-amber-500"
        />
      </div>

      <ReportSection
        title="Leads"
        description={`${leadReport.items.length} lead rows`}
        exportLabel="Export leads CSV"
        isExporting={exportingReport === "leads"}
        isExportDisabled={isExportDisabled}
        onExport={() => handleExport("leads")}
      >
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-7">
          {Object.entries(leadReport.totals.byStatus).map(([status, count]) => (
            <ReportStat key={status} label={formatEnum(status)} value={count} />
          ))}
        </div>
        {leadReport.items.length === 0 ? (
          <ReportSectionEmpty
            title="No lead rows"
            message="No leads match the selected report range."
          />
        ) : (
          <Table
            aria-label="Lead report rows"
            className="min-w-[1080px] print:min-w-full print:text-[10px]"
          >
            <TableCaption className="sr-only">
              Lead report rows for {formatRangeLabel(appliedFilters)}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requirement</TableHead>
                <TableHead>Sales Executive</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leadReport.items.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="min-w-56 whitespace-normal align-top">
                    <p className="font-medium">{lead.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.phone}
                      {lead.email ? ` - ${lead.email}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    {formatEnum(lead.status)}
                  </TableCell>
                  <TableCell className="min-w-44 whitespace-normal align-top">
                    <p>{lead.propertyType || "Not set"}</p>
                    <p className="text-xs text-muted-foreground">
                      {[lead.location, lead.budget]
                        .filter(Boolean)
                        .join(" - ") || "Details pending"}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-40 whitespace-normal align-top">
                    {lead.assignedTo?.name ?? "Unassigned"}
                  </TableCell>
                  <TableCell className="min-w-44 whitespace-normal align-top">
                    <p>{lead.finalProject?.projectName ?? "Not finalized"}</p>
                    <p className="text-xs text-muted-foreground">
                      Plot {lead.finalPlot?.plotNumber ?? "not set"}
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    <p>{formatCurrency(lead.bookingAmount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatLocalDate(lead.bookingDate, "Not set")}
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    {formatLocalDate(lead.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ReportSection>

      <ReportSection
        title="Bookings"
        description={`${bookingReport.items.length} booking rows`}
        exportLabel="Export bookings CSV"
        isExporting={exportingReport === "bookings"}
        isExportDisabled={isExportDisabled}
        onExport={() => handleExport("bookings")}
      >
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {Object.entries(bookingReport.totals.byStatus).map(
            ([status, count]) => (
              <ReportStat
                key={status}
                label={formatEnum(status)}
                value={count}
              />
            )
          )}
          <ReportStat
            label="Amount paid"
            value={formatCurrency(bookingReport.totals.amountPaidTotal)}
          />
        </div>
        {bookingReport.items.length === 0 ? (
          <ReportSectionEmpty
            title="No booking rows"
            message="No bookings or plot blocks match the selected report range."
          />
        ) : (
          <Table
            aria-label="Booking report rows"
            className="min-w-[1040px] print:min-w-full print:text-[10px]"
          >
            <TableCaption className="sr-only">
              Booking report rows for {formatRangeLabel(appliedFilters)}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sales Executive</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Booking Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookingReport.items.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="min-w-48 whitespace-normal align-top">
                    <p className="font-medium">{booking.contactName}</p>
                    <p className="text-xs text-muted-foreground">
                      ID {booking.id}
                    </p>
                  </TableCell>
                  <TableCell className="min-w-44 whitespace-normal align-top">
                    <p>{booking.projectName}</p>
                    <p className="text-xs text-muted-foreground">
                      Plot {booking.plotNumber}
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    {formatEnum(booking.type)}
                  </TableCell>
                  <TableCell className="align-top">
                    {formatEnum(booking.status)}
                  </TableCell>
                  <TableCell className="min-w-40 whitespace-normal align-top">
                    {booking.salesExecutive.name}
                  </TableCell>
                  <TableCell className="align-top">
                    {formatCurrency(booking.amountPaid)}
                  </TableCell>
                  <TableCell className="align-top">
                    {formatLocalDate(booking.bookingDate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ReportSection>

      <ReportSection
        title="Sales performance"
        description={`${salesReport.items.length} sales executives`}
        exportLabel="Export performance CSV"
        isExporting={exportingReport === "sales-performance"}
        isExportDisabled={isExportDisabled}
        onExport={() => handleExport("sales-performance")}
      >
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
          <ReportStat
            label="Sales executives"
            value={salesReport.totals.salesExecutives}
          />
          <ReportStat
            label="Leads created"
            value={salesReport.totals.leadsCreated}
          />
          <ReportStat
            label="Leads assigned"
            value={salesReport.totals.leadsAssigned}
          />
          <ReportStat
            label="Bookings"
            value={salesReport.totals.bookingsTotal}
          />
          <ReportStat
            label="Amount paid"
            value={formatCurrency(salesReport.totals.amountPaidTotal)}
          />
        </div>
        {salesReport.items.length === 0 ? (
          <ReportSectionEmpty
            title="No sales performance rows"
            message="No sales executives have report activity in the selected range."
          />
        ) : (
          <Table
            aria-label="Sales performance report rows"
            className="min-w-[1120px] print:min-w-full print:text-[10px]"
          >
            <TableCaption className="sr-only">
              Sales performance report rows for {formatRangeLabel(appliedFilters)}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Sales Executive</TableHead>
                <TableHead>Leads Created</TableHead>
                <TableHead>Leads Assigned</TableHead>
                <TableHead>Total Bookings</TableHead>
                <TableHead>Booked</TableHead>
                <TableHead>Blocked</TableHead>
                <TableHead>Closed</TableHead>
                <TableHead>Cancelled</TableHead>
                <TableHead className="text-right">Amount Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesReport.items.map((item) => (
                <TableRow key={item.salesExecutiveId}>
                  <TableCell className="min-w-56 whitespace-normal align-top">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.seId ? `${item.seId} - ` : ""}
                      {item.email}
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    {formatNumber(item.leadsCreated)}
                  </TableCell>
                  <TableCell className="align-top">
                    {formatNumber(item.leadsAssigned)}
                  </TableCell>
                  <TableCell className="align-top">
                    {formatNumber(item.bookingsTotal)}
                  </TableCell>
                  <TableCell className="align-top">
                    {formatNumber(item.bookedBookings)}
                  </TableCell>
                  <TableCell className="align-top">
                    {formatNumber(item.blockedBookings)}
                  </TableCell>
                  <TableCell className="align-top">
                    {formatNumber(item.closedBookings)}
                  </TableCell>
                  <TableCell className="align-top">
                    {formatNumber(item.cancelledBookings)}
                  </TableCell>
                  <TableCell className="text-right align-top">
                    {formatCurrency(item.amountPaidTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ReportSection>
    </div>
  )
}

type ReportSectionProps = {
  title: string
  description: string
  exportLabel: string
  isExporting: boolean
  isExportDisabled: boolean
  onExport: () => void
  children: ReactNode
}

function ReportSection({
  title,
  description,
  exportLabel,
  isExporting,
  isExportDisabled,
  onExport,
  children,
}: ReportSectionProps) {
  return (
    <Card className="rounded-lg print:break-inside-avoid print:gap-3 print:py-3 print:shadow-none print:ring-0">
      <CardHeader className="print:px-0">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction className="print:hidden">
          <Button
            type="button"
            variant="outline"
            disabled={isExportDisabled}
            aria-busy={isExporting}
            aria-label={exportLabel}
            onClick={onExport}
          >
            {isExporting ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {isExporting ? "Exporting..." : exportLabel}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4 print:px-0">{children}</CardContent>
    </Card>
  )
}

function ReportSectionEmpty({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-md border border-dashed bg-muted/20 px-3 py-4"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

function ReportStat({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-md border px-3 py-2 print:px-2 print:py-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold">{formatMetric(value)}</p>
    </div>
  )
}

function getInitialFilters(): ReportDateFilters {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 30)

  return {
    from: toDateInputValue(from),
    to: toDateInputValue(to),
  }
}

function cleanFilters(filters: ReportDateFilters): ReportDateFilters {
  return {
    from: filters.from?.trim() || undefined,
    to: filters.to?.trim() || undefined,
  }
}

function validateDateRange(filters: ReportDateFilters) {
  if (filters.from && filters.to && filters.from > filters.to) {
    return "From date must be on or before To date."
  }

  return null
}

function formatRangeLabel(filters: ReportDateFilters) {
  if (filters.from && filters.to) {
    return `${formatLocalDate(filters.from)} to ${formatLocalDate(filters.to)}`
  }

  if (filters.from) {
    return `From ${formatLocalDate(filters.from)}`
  }

  if (filters.to) {
    return `Through ${formatLocalDate(filters.to)}`
  }

  return "All dates"
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatCurrency(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "Not set"
  }

  const numericValue = Number(value)

  if (Number.isNaN(numericValue)) {
    return String(value)
  }

  return currencyFormatter.format(numericValue)
}

function formatNumber(value: number) {
  return numberFormatter.format(value)
}

function formatMetric(value: number | string) {
  return typeof value === "number" ? formatNumber(value) : value
}

function formatReportKind(report: ReportExportKind) {
  if (report === "sales-performance") {
    return "Sales performance"
  }

  return formatEnum(report)
}
