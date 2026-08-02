"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Eye, RefreshCw } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import {
  DashboardEmpty,
  DashboardError,
  DashboardLoading,
} from "@/components/dashboard/dashboard-state"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import { getFriendlyApiError } from "@/lib/api"
import { getToken } from "@/lib/auth"
import { formatLocalDateTime } from "@/lib/date"
import {
  getCustomers,
  type Customer,
  type CustomerJourneyStatus,
} from "@/lib/customers"

export default function SalesCustomersPage() {
  return (
    <ProtectedRoute allowedRoles={["SALES_EXECUTIVE", "ADMIN"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Customers"
          description="Open a customer journey from the accessible customer list."
        >
          <CustomerListClient />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}

function CustomerListClient() {
  const token = useMemo(() => getToken(), [])
  const toast = useToast()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCustomers = useCallback(async (showLoading = false) => {
    if (!token) {
      setError("Your session has expired. Please log in again.")
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }

    if (showLoading) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }
    setError(null)

    try {
      const customerData = await getCustomers(token)
      setCustomers(customerData)
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to load customers")
      setError(message)

      if (!showLoading) {
        toast.error("Unable to refresh customers", message)
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [toast, token])

  useEffect(() => {
    void Promise.resolve().then(() => loadCustomers(true))
  }, [loadCustomers])

  if (isLoading) {
    return (
      <DashboardLoading
        title="Loading customers"
        description="Fetching customers available to your role."
        rows={4}
      />
    )
  }

  if (error && customers.length === 0) {
    return (
      <DashboardError
        title="Customers unavailable"
        message={error}
        onRetry={() => loadCustomers(true)}
      />
    )
  }

  if (customers.length === 0) {
    return (
      <DashboardEmpty
        title="No customers found"
        message="Converted customer records will appear here once available."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Accessible customers</h2>
          <p className="text-sm text-muted-foreground">
            Open a customer to review the full CRM journey.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isRefreshing}
          aria-busy={isRefreshing}
          onClick={() => loadCustomers(false)}
        >
          <RefreshCw
            className={isRefreshing ? "size-4 animate-spin" : "size-4"}
          />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Customer list</CardTitle>
          <CardDescription>
            Showing customers scoped by the backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table aria-label="Customers" className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned user</TableHead>
                <TableHead>Source lead</TableHead>
                <TableHead>Latest activity</TableHead>
                <TableHead className="text-right">Journey</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="min-w-52 whitespace-normal align-top">
                    <p className="font-medium">{customer.fullName}</p>
                    {customer.notes ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {customer.notes}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="min-w-48 whitespace-normal align-top">
                    <p>{customer.phone}</p>
                    {customer.email ? (
                      <p className="text-xs text-muted-foreground">
                        {customer.email}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top">
                    <CustomerStatusBadge status={customer.status} />
                  </TableCell>
                  <TableCell className="min-w-44 whitespace-normal align-top">
                    {customer.assignedTo?.name ?? "Not assigned"}
                  </TableCell>
                  <TableCell className="min-w-44 whitespace-normal align-top">
                    {customer.sourceLead ? (
                      <div>
                        <p>{customer.sourceLead.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {customer.sourceLead.phone}
                        </p>
                      </div>
                    ) : (
                      "Not linked"
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    {formatLocalDateTime(customer.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right align-top">
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/dashboard/sales/customers/${customer.id}/journey`}
                      >
                        <Eye className="size-4" />
                        Open
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function CustomerStatusBadge({ status }: { status: CustomerJourneyStatus }) {
  const className =
    status === "CUSTOMER"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "LOST"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-sky-200 bg-sky-50 text-sky-700"

  return (
    <Badge variant="outline" className={`w-fit rounded-md ${className}`}>
      {formatEnum(status)}
    </Badge>
  )
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
