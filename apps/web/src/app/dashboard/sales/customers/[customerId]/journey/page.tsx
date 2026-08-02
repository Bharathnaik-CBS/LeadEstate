"use client"

import Link from "next/link"
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useParams } from "next/navigation"
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { getFriendlyApiError } from "@/lib/api"
import { getToken, type AuthUser } from "@/lib/auth"
import { formatLocalDate, formatLocalDateTime } from "@/lib/date"
import {
  createFollowUp,
  getCustomerJourney,
  updateFollowUp,
  type Customer,
  type CustomerJourney,
  type FollowUpStatus,
  type TimelineCategory,
  type TimelineEvent,
  type TimelineFilter,
} from "@/lib/customers"

type FollowUpFormState = {
  dueDate: string
  dueTime: string
  status: FollowUpStatus
  notes: string
}

const initialFollowUpForm: FollowUpFormState = {
  dueDate: new Date().toISOString().slice(0, 10),
  dueTime: "10:00",
  status: "PENDING",
  notes: "",
}

const filters: Array<{ value: TimelineFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "leads", label: "Leads" },
  { value: "follow-ups", label: "Follow-ups" },
  { value: "bookings", label: "Bookings" },
  { value: "site-visits", label: "Site Visits" },
  { value: "other", label: "Other" },
]

export default function CustomerJourneyPage() {
  return (
    <ProtectedRoute allowedRoles={["SALES_EXECUTIVE", "ADMIN"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Customer journey"
          description="Review a chronological CRM timeline for one customer."
        >
          <CustomerJourneyClient user={user} />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}

function CustomerJourneyClient({ user }: { user: AuthUser }) {
  const params = useParams()
  const customerId = getParamValue(params.customerId)
  const token = useMemo(() => getToken(), [])
  const toast = useToast()
  const [journey, setJourney] = useState<CustomerJourney | null>(null)
  const [filter, setFilter] = useState<TimelineFilter>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFollowUpDialogOpen, setIsFollowUpDialogOpen] = useState(false)
  const [followUpForm, setFollowUpForm] =
    useState<FollowUpFormState>(initialFollowUpForm)
  const [followUpError, setFollowUpError] = useState<string | null>(null)
  const [isFollowUpSubmitting, setIsFollowUpSubmitting] = useState(false)
  const [updatingFollowUpId, setUpdatingFollowUpId] = useState<string | null>(
    null
  )

  const canManageFollowUps =
    user.role === "SALES_EXECUTIVE" || user.role === "ADMIN"

  const visibleTimeline = useMemo(() => {
    if (!journey) {
      return []
    }

    if (filter === "all") {
      return journey.timeline
    }

    return journey.timeline.filter((event) => event.filter === filter)
  }, [filter, journey])

  const loadJourney = useCallback(async (showLoading = false) => {
    if (!token) {
      setError("Your session has expired. Please log in again.")
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }

    if (!customerId) {
      setError("Customer ID is missing.")
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
      const journeyData = await getCustomerJourney(token, customerId, user.role)
      setJourney(journeyData)
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to load customer journey")
      setError(message)

      if (!showLoading) {
        toast.error("Unable to refresh journey", message)
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [customerId, toast, token, user.role])

  useEffect(() => {
    void Promise.resolve().then(() => loadJourney(true))
  }, [loadJourney])

  async function handleCreateFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token || !journey) {
      setFollowUpError("Your session has expired. Please log in again.")
      return
    }

    if (!followUpForm.dueDate || !followUpForm.dueTime) {
      setFollowUpError("Follow-up date and time are required.")
      return
    }

    setIsFollowUpSubmitting(true)
    setFollowUpError(null)

    try {
      await createFollowUp(token, {
        dueAt: new Date(
          `${followUpForm.dueDate}T${followUpForm.dueTime}`
        ).toISOString(),
        status: followUpForm.status,
        notes: followUpForm.notes,
        customerId: journey.customer.id,
      })
      setFollowUpForm(initialFollowUpForm)
      setIsFollowUpDialogOpen(false)
      toast.success("Follow-up added", "The customer journey was refreshed.")
      await loadJourney(false)
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to add follow-up")
      setFollowUpError(message)
      toast.error("Unable to add follow-up", message)
    } finally {
      setIsFollowUpSubmitting(false)
    }
  }

  async function handleUpdateFollowUp(
    followUpId: string,
    status: FollowUpStatus
  ) {
    if (!token) {
      setError("Your session has expired. Please log in again.")
      return
    }

    setUpdatingFollowUpId(followUpId)
    setError(null)

    try {
      await updateFollowUp(token, followUpId, { status })
      toast.success(
        status === "COMPLETED" ? "Follow-up completed" : "Follow-up cancelled",
        "The customer journey was refreshed."
      )
      await loadJourney(false)
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to update follow-up")
      setError(message)
      toast.error("Unable to update follow-up", message)
    } finally {
      setUpdatingFollowUpId(null)
    }
  }

  if (isLoading) {
    return (
      <DashboardLoading
        title="Loading customer journey"
        description="Fetching customer, lead, follow-up, booking, and visit activity."
        rows={4}
        sections={2}
      />
    )
  }

  if (error || !journey) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline">
          <Link href="/dashboard/sales/customers">
            <ArrowLeft className="size-4" />
            Back to customers
          </Link>
        </Button>
        <DashboardError
          title={isNotFoundError(error) ? "Customer not found" : "Journey unavailable"}
          message={error ?? "Customer journey could not be loaded."}
          onRetry={() => loadJourney(true)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline" className="w-fit">
          <Link href="/dashboard/sales/customers">
            <ArrowLeft className="size-4" />
            Back to customers
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          {canManageFollowUps ? (
            <Button
              type="button"
              onClick={() => {
                setFollowUpError(null)
                setIsFollowUpDialogOpen(true)
              }}
            >
              <Plus className="size-4" />
              Add Follow-up
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            onClick={() => loadJourney(false)}
          >
            <RefreshCw
              className={isRefreshing ? "size-4 animate-spin" : "size-4"}
            />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert message={error} />
      ) : null}

      {journey.warnings.length > 0 ? (
        <div className="space-y-2" role="status" aria-live="polite">
          {Array.from(new Set(journey.warnings)).map((warning) => (
            <p
              key={warning}
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      <CustomerSummary customer={journey.customer} journey={journey} />

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Activity timeline</h2>
            <p className="text-sm text-muted-foreground">
              Reverse chronological activity from available CRM records.
            </p>
          </div>
          <Select
            value={filter}
            onValueChange={(value) => setFilter(value as TimelineFilter)}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Timeline filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filters.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {visibleTimeline.length === 0 ? (
          <DashboardEmpty
            title="No timeline activity"
            message="No events match the selected category."
          />
        ) : (
          <div className="space-y-3">
            {visibleTimeline.map((event) => (
              <TimelineCard
                key={event.id}
                event={event}
                canManageFollowUps={canManageFollowUps}
                isUpdating={updatingFollowUpId === event.sourceId}
                onCompleteFollowUp={() =>
                  handleUpdateFollowUp(event.sourceId, "COMPLETED")
                }
                onCancelFollowUp={() =>
                  handleUpdateFollowUp(event.sourceId, "CANCELLED")
                }
              />
            ))}
          </div>
        )}
      </section>

      <Dialog
        open={isFollowUpDialogOpen}
        onOpenChange={setIsFollowUpDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Follow-up</DialogTitle>
            <DialogDescription>
              Schedule a customer follow-up using the existing CRM follow-up API.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleCreateFollowUp}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date" htmlFor="followUpDate">
                <Input
                  id="followUpDate"
                  type="date"
                  value={followUpForm.dueDate}
                  disabled={isFollowUpSubmitting}
                  onChange={(event) =>
                    updateFollowUpForm("dueDate", event.target.value)
                  }
                />
              </Field>
              <Field label="Time" htmlFor="followUpTime">
                <Input
                  id="followUpTime"
                  type="time"
                  value={followUpForm.dueTime}
                  disabled={isFollowUpSubmitting}
                  onChange={(event) =>
                    updateFollowUpForm("dueTime", event.target.value)
                  }
                />
              </Field>
            </div>
            <Field label="Status" htmlFor="followUpStatus">
              <Select
                value={followUpForm.status}
                disabled={isFollowUpSubmitting}
                onValueChange={(value) =>
                  updateFollowUpForm("status", value as FollowUpStatus)
                }
              >
                <SelectTrigger id="followUpStatus" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Notes" htmlFor="followUpNotes">
              <Textarea
                id="followUpNotes"
                value={followUpForm.notes}
                disabled={isFollowUpSubmitting}
                onChange={(event) =>
                  updateFollowUpForm("notes", event.target.value)
                }
              />
            </Field>
            {followUpError ? <Alert message={followUpError} /> : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isFollowUpSubmitting}
                onClick={() => setIsFollowUpDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isFollowUpSubmitting}
                aria-busy={isFollowUpSubmitting}
              >
                {isFollowUpSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {isFollowUpSubmitting ? "Adding..." : "Add Follow-up"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )

  function updateFollowUpForm<Key extends keyof FollowUpFormState>(
    key: Key,
    value: FollowUpFormState[Key]
  ) {
    setFollowUpError(null)
    setFollowUpForm((current) => ({ ...current, [key]: value }))
  }
}

function CustomerSummary({
  customer,
  journey,
}: {
  customer: Customer
  journey: CustomerJourney
}) {
  const activeBooking =
    journey.bookings.find((booking) => booking.status === "ACTIVE") ?? null
  const fields = [
    { label: "Full name", value: customer.fullName },
    { label: "Phone", value: customer.phone },
    { label: "Email", value: customer.email },
    { label: "Assigned user", value: customer.assignedTo?.name },
    { label: "Source lead", value: customer.sourceLead?.fullName },
    { label: "Created", value: formatLocalDate(customer.createdAt) },
    { label: "Converted", value: customer.convertedAt ? formatLocalDate(customer.convertedAt) : null },
    { label: "Notes", value: customer.notes },
    {
      label: "Current booking",
      value: activeBooking
        ? `${formatShortId(activeBooking.id)} - ${activeBooking.project?.projectName ?? "Project"} plot ${activeBooking.plot?.plotNumber ?? "not set"}`
        : null,
    },
  ].filter((field) => Boolean(field.value))

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{customer.fullName}</CardTitle>
            <CardDescription>
              Customer summary from the backend customer record.
            </CardDescription>
          </div>
          <CustomerStatusBadge status={customer.status} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => (
          <SummaryField
            key={field.label}
            label={field.label}
            value={field.value ?? ""}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function TimelineCard({
  event,
  canManageFollowUps,
  isUpdating,
  onCompleteFollowUp,
  onCancelFollowUp,
}: {
  event: TimelineEvent
  canManageFollowUps: boolean
  isUpdating: boolean
  onCompleteFollowUp: () => void
  onCancelFollowUp: () => void
}) {
  const canUpdateFollowUp =
    canManageFollowUps &&
    event.sourceType === "FollowUp" &&
    event.metadata?.followUpStatus === "PENDING"

  return (
    <Card className="rounded-lg">
      <CardContent className="grid gap-3 py-0 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="space-y-2">
          <p className="text-sm font-medium">{formatLocalDateTime(event.timestamp)}</p>
          <CategoryBadge category={event.category} />
        </div>
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-medium">{event.title}</h3>
              <p className="text-sm text-muted-foreground">{event.description}</p>
            </div>
            {event.status ? <StatusBadge status={event.status} /> : null}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {event.actor ? <span>Actor: {event.actor}</span> : null}
            {event.related?.map((item) => <span key={item}>{item}</span>)}
          </div>
          {canUpdateFollowUp ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUpdating}
                aria-busy={isUpdating}
                onClick={onCompleteFollowUp}
              >
                {isUpdating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Complete
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isUpdating}
                aria-busy={isUpdating}
                onClick={onCancelFollowUp}
              >
                {isUpdating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <XCircle className="size-4" />
                )}
                Cancel
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}

function Field({
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
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function Alert({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  )
}

function CustomerStatusBadge({ status }: { status: Customer["status"] }) {
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

function CategoryBadge({ category }: { category: TimelineCategory }) {
  const className =
    category === "Lead"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : category === "Follow-up"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : category === "Booking" || category === "Plot Block"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : category === "Site Visit"
            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
            : category === "Payment"
              ? "border-teal-200 bg-teal-50 text-teal-700"
              : category === "KYC"
                ? "border-violet-200 bg-violet-50 text-violet-700"
                : "border-border bg-background text-muted-foreground"

  return (
    <Badge variant="outline" className={`w-fit rounded-md ${className}`}>
      {category}
    </Badge>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className="w-fit rounded-md">
      {formatEnum(status)}
    </Badge>
  )
}

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? ""
  }

  return value ?? ""
}

function isNotFoundError(error: string | null) {
  return error?.toLowerCase().includes("not found") ?? false
}

function formatShortId(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
