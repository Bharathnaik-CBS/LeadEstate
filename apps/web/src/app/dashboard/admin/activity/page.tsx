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
import { Eye, Loader2, RefreshCw, RotateCcw } from "lucide-react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/components/ui/toast"
import { ApiError, getFriendlyApiError } from "@/lib/api"
import { getToken } from "@/lib/auth"
import {
  describeActivityEvent,
  eventMatchesLocalSearch,
  formatActivityAction,
  formatActivityActor,
  formatTargetType,
  getActivityStatus,
  getEntityReference,
  getMetadataEntries,
  getRelatedReferences,
  getReliableActivityRoute,
  listActivityEvents,
  metadataValueToDisplay,
  type ActivityEvent,
  type ActivityEventQuery,
} from "@/lib/activity-events"
import { formatLocalDateTime } from "@/lib/date"

type FilterState = {
  action: string
  targetType: string
  actorId: string
  from: string
  to: string
}

const pageSize = 50
const initialFilters: FilterState = {
  action: "",
  targetType: "",
  actorId: "",
  from: "",
  to: "",
}

export default function AdminActivityPage() {
  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Activity Log"
          description="Review user and system activity recorded by Lead Estate."
        >
          <AdminActivityClient />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}

function AdminActivityClient() {
  const token = useMemo(() => getToken(), [])
  const toast = useToast()
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [draftFilters, setDraftFilters] =
    useState<FilterState>(initialFilters)
  const [appliedFilters, setAppliedFilters] =
    useState<FilterState>(initialFilters)
  const [localSearch, setLocalSearch] = useState("")
  const [nextCursor, setNextCursor] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [isFilterLoading, setIsFilterLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null)

  const visibleEvents = useMemo(
    () => events.filter((event) => eventMatchesLocalSearch(event, localSearch)),
    [events, localSearch]
  )
  const hasAppliedFilters = useMemo(
    () => Object.values(appliedFilters).some(Boolean),
    [appliedFilters]
  )
  const hasLocalSearch = localSearch.trim().length > 0
  const canLoadMore = Boolean(nextCursor) && !isLoadingMore

  const loadEvents = useCallback(async ({
    cursor,
    filters,
    mode,
  }: {
    cursor?: string
    filters: FilterState
    mode: "initial" | "replace" | "append"
  }) => {
    if (!token) {
      setError("Your session has expired. Please log in again.")
      setIsLoading(false)
      setIsFilterLoading(false)
      setIsLoadingMore(false)
      return
    }

    if (mode === "initial") {
      setIsLoading(true)
    } else if (mode === "replace") {
      setIsFilterLoading(true)
    } else {
      setIsLoadingMore(true)
    }
    setError(null)

    try {
      const page = await listActivityEvents(token, {
        ...toActivityQuery(filters),
        take: pageSize,
        cursor,
      })
      setNextCursor(page.nextCursor)
      setEvents((current) =>
        mode === "append"
          ? appendUniqueEvents(current, page.events)
          : page.events
      )
    } catch (err) {
      const fallback =
        err instanceof ApiError && err.status === 403
          ? "You do not have permission to view the activity log."
          : "Unable to load activity events"
      const message = getFriendlyApiError(err, fallback)
      setError(message)

      if (mode !== "initial") {
        toast.error("Unable to load activity", message)
      }
    } finally {
      setIsLoading(false)
      setIsFilterLoading(false)
      setIsLoadingMore(false)
    }
  }, [toast, token])

  useEffect(() => {
    void Promise.resolve().then(() =>
      loadEvents({ filters: initialFilters, mode: "initial" })
    )
  }, [loadEvents])

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationMessage = validateDateRange(draftFilters)

    if (validationMessage) {
      setFilterError(validationMessage)
      return
    }

    setFilterError(null)
    setAppliedFilters(draftFilters)
    void loadEvents({ filters: draftFilters, mode: "replace" })
  }

  function handleResetFilters() {
    setDraftFilters(initialFilters)
    setAppliedFilters(initialFilters)
    setLocalSearch("")
    setFilterError(null)
    void loadEvents({ filters: initialFilters, mode: "replace" })
  }

  function handleLoadMore() {
    if (!nextCursor) {
      return
    }

    void loadEvents({
      filters: appliedFilters,
      cursor: nextCursor,
      mode: "append",
    })
  }

  function updateDraftFilter<Key extends keyof FilterState>(
    key: Key,
    value: FilterState[Key]
  ) {
    setFilterError(null)
    setDraftFilters((current) => ({ ...current, [key]: value }))
  }

  if (isLoading) {
    return (
      <DashboardLoading
        title="Loading activity log"
        description="Fetching the latest activity events."
        rows={4}
        sections={1}
      />
    )
  }

  if (error && events.length === 0) {
    return (
      <DashboardError
        title={isPermissionError(error) ? "Permission required" : "Activity log unavailable"}
        message={error}
        onRetry={() => loadEvents({ filters: appliedFilters, mode: "initial" })}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Server filters use the existing activity-events query parameters.
            Search is local to the events already loaded below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleFilterSubmit}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Field label="Event type" htmlFor="action">
                <Input
                  id="action"
                  value={draftFilters.action}
                  placeholder="booking.created"
                  disabled={isFilterLoading}
                  onChange={(event) =>
                    updateDraftFilter("action", event.target.value)
                  }
                />
              </Field>
              <Field label="Entity type" htmlFor="targetType">
                <Input
                  id="targetType"
                  value={draftFilters.targetType}
                  placeholder="Booking"
                  disabled={isFilterLoading}
                  onChange={(event) =>
                    updateDraftFilter("targetType", event.target.value)
                  }
                />
              </Field>
              <Field label="Actor ID" htmlFor="actorId">
                <Input
                  id="actorId"
                  value={draftFilters.actorId}
                  placeholder="User UUID"
                  disabled={isFilterLoading}
                  onChange={(event) =>
                    updateDraftFilter("actorId", event.target.value)
                  }
                />
              </Field>
              <Field label="Start date" htmlFor="from">
                <Input
                  id="from"
                  type="date"
                  value={draftFilters.from}
                  disabled={isFilterLoading}
                  onChange={(event) =>
                    updateDraftFilter("from", event.target.value)
                  }
                />
              </Field>
              <Field label="End date" htmlFor="to">
                <Input
                  id="to"
                  type="date"
                  value={draftFilters.to}
                  disabled={isFilterLoading}
                  onChange={(event) =>
                    updateDraftFilter("to", event.target.value)
                  }
                />
              </Field>
            </div>
            <Field label="Local search" htmlFor="localSearch">
              <Input
                id="localSearch"
                value={localSearch}
                placeholder="Search loaded events"
                onChange={(event) => setLocalSearch(event.target.value)}
              />
            </Field>
            {filterError ? <Alert message={filterError} /> : null}
            {error && events.length > 0 ? <Alert message={error} /> : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="submit"
                disabled={isFilterLoading}
                aria-busy={isFilterLoading}
              >
                {isFilterLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {isFilterLoading ? "Applying..." : "Apply Filters"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isFilterLoading}
                onClick={handleResetFilters}
              >
                <RotateCcw className="size-4" />
                Reset Filters
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isFilterLoading || isLoadingMore}
                onClick={() =>
                  loadEvents({ filters: appliedFilters, mode: "replace" })
                }
              >
                <RefreshCw className="size-4" />
                Refresh
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {events.length === 0 ? (
        <DashboardEmpty
          title={
            hasAppliedFilters ? "No matching activity events" : "No activity events"
          }
          message={
            hasAppliedFilters
              ? "No audit events matched the applied backend filters."
              : "Activity events will appear here once the backend records them."
          }
        />
      ) : visibleEvents.length === 0 ? (
        <DashboardEmpty
          title="No local search results"
          message="No loaded events match the current local search term."
        />
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Recent activity</h2>
              <p className="text-sm text-muted-foreground">
                Showing {visibleEvents.length} of {events.length} loaded events.
                {hasLocalSearch
                  ? " Local search does not query unloaded history."
                  : ""}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Sorted by newest event first.
            </p>
          </div>

          <div className="hidden md:block">
            <ActivityTable
              events={visibleEvents}
              onSelectEvent={setSelectedEvent}
            />
          </div>
          <div className="space-y-3 md:hidden">
            {visibleEvents.map((event) => (
              <ActivityCard
                key={event.id}
                event={event}
                onSelect={() => setSelectedEvent(event)}
              />
            ))}
          </div>

          <div className="flex justify-center">
            {nextCursor ? (
              <Button
                type="button"
                variant="outline"
                disabled={!canLoadMore}
                aria-busy={isLoadingMore}
                onClick={handleLoadMore}
              >
                {isLoadingMore ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {isLoadingMore ? "Loading..." : "Load More"}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                No more events are available for the current filters.
              </p>
            )}
          </div>
        </section>
      )}

      <ActivityDetailDialog
        event={selectedEvent}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEvent(null)
          }
        }}
      />
    </div>
  )
}

function ActivityTable({
  events,
  onSelectEvent,
}: {
  events: ActivityEvent[]
  onSelectEvent: (event: ActivityEvent) => void
}) {
  return (
    <Card className="rounded-lg">
      <CardContent>
        <Table aria-label="Audit trail events" className="min-w-[1180px]">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Related</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="min-w-40 align-top">
                  {formatLocalDateTime(event.occurredAt)}
                </TableCell>
                <TableCell className="min-w-44 align-top">
                  <p className="font-medium">{formatActivityAction(event.action)}</p>
                  <p className="text-xs text-muted-foreground">{event.action}</p>
                </TableCell>
                <TableCell className="min-w-36 align-top">
                  <EntityBadge targetType={event.targetType} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {getEntityReference(event)}
                  </p>
                </TableCell>
                <TableCell className="max-w-md whitespace-normal align-top">
                  <p className="line-clamp-3 text-sm">
                    {describeActivityEvent(event)}
                  </p>
                </TableCell>
                <TableCell className="min-w-44 whitespace-normal align-top">
                  {formatActivityActor(event) ? (
                    <div>
                      <p>{formatActivityActor(event)}</p>
                      {event.actor?.email ? (
                        <p className="text-xs text-muted-foreground">
                          {event.actor.email}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">System</span>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {getActivityStatus(event) ? (
                    <StatusBadge status={getActivityStatus(event) ?? ""} />
                  ) : null}
                </TableCell>
                <TableCell className="max-w-48 whitespace-normal align-top">
                  <RelatedReferences event={event} />
                </TableCell>
                <TableCell className="text-right align-top">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectEvent(event)}
                  >
                    <Eye className="size-4" />
                    Inspect
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ActivityCard({
  event,
  onSelect,
}: {
  event: ActivityEvent
  onSelect: () => void
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="space-y-3 py-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {formatLocalDateTime(event.occurredAt)}
            </p>
            <h3 className="font-medium">{formatActivityAction(event.action)}</h3>
          </div>
          <EntityBadge targetType={event.targetType} />
        </div>
        <p className="text-sm">{describeActivityEvent(event)}</p>
        <div className="flex flex-wrap gap-2">
          {getActivityStatus(event) ? (
            <StatusBadge status={getActivityStatus(event) ?? ""} />
          ) : null}
          <Badge variant="outline" className="rounded-md">
            {getEntityReference(event)}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {formatActivityActor(event) ?? "System"}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onSelect}>
            <Eye className="size-4" />
            Inspect
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityDetailDialog({
  event,
  onOpenChange,
}: {
  event: ActivityEvent | null
  onOpenChange: (open: boolean) => void
}) {
  const metadataEntries = useMemo(
    () => getMetadataEntries(event?.metadata),
    [event]
  )
  const route = event ? getReliableActivityRoute(event) : null

  return (
    <Dialog open={Boolean(event)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Activity event details</DialogTitle>
          <DialogDescription>
            Sanitized event metadata and identifiers for troubleshooting.
          </DialogDescription>
        </DialogHeader>
        {event ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailField label="Event ID" value={event.id} />
              <DetailField
                label="Timestamp"
                value={formatLocalDateTime(event.occurredAt)}
              />
              <DetailField
                label="Event type"
                value={formatActivityAction(event.action)}
              />
              <DetailField label="Raw action" value={event.action} />
              <DetailField
                label="Entity type"
                value={formatTargetType(event.targetType)}
              />
              <DetailField label="Entity ID" value={event.targetId} />
              <DetailField
                label="Actor"
                value={formatActivityActor(event) ?? "System"}
              />
              {event.actorId ? (
                <DetailField label="Actor ID" value={event.actorId} />
              ) : null}
            </div>

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{describeActivityEvent(event)}</p>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
                <CardDescription>
                  Sensitive credential-like keys are removed recursively.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {metadataEntries.length === 0 ? (
                  <p className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                    No displayable metadata is available for this event.
                  </p>
                ) : (
                  metadataEntries.map((entry) => (
                    <div key={entry.key} className="rounded-md border px-3 py-2">
                      <p className="text-xs text-muted-foreground">
                        {entry.label}
                      </p>
                      {isComplexMetadataValue(entry.value) ? (
                        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                          {metadataValueToDisplay(entry.value)}
                        </pre>
                      ) : (
                        <p className="mt-1 break-words text-sm font-medium">
                          {metadataValueToDisplay(entry.value)}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              {route ? (
                <Button asChild>
                  <Link href={route.href}>{route.label}</Link>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function RelatedReferences({ event }: { event: ActivityEvent }) {
  const references = getRelatedReferences(event)
  const route = getReliableActivityRoute(event)

  if (references.length === 0 && !route) {
    return <span className="text-muted-foreground">No linked record</span>
  }

  return (
    <div className="space-y-1">
      {references.map((reference) => (
        <p key={reference} className="text-xs text-muted-foreground">
          {reference}
        </p>
      ))}
      {route ? (
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link href={route.href}>{route.label}</Link>
        </Button>
      ) : null}
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

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
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

function EntityBadge({ targetType }: { targetType: string }) {
  return (
    <Badge variant="outline" className="w-fit rounded-md">
      {formatTargetType(targetType)}
    </Badge>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className="w-fit rounded-md">
      {formatTargetType(status)}
    </Badge>
  )
}

function toActivityQuery(filters: FilterState): ActivityEventQuery {
  return {
    action: filters.action,
    targetType: filters.targetType,
    actorId: filters.actorId,
    from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : "",
    to: filters.to ? new Date(`${filters.to}T23:59:59`).toISOString() : "",
  }
}

function validateDateRange(filters: FilterState) {
  if (!filters.from || !filters.to) {
    return null
  }

  const from = new Date(filters.from).getTime()
  const to = new Date(filters.to).getTime()

  return to < from ? "End date cannot be earlier than start date." : null
}

function appendUniqueEvents(
  current: ActivityEvent[],
  nextEvents: ActivityEvent[]
) {
  const seen = new Set(current.map((event) => event.id))

  return [
    ...current,
    ...nextEvents.filter((event) => {
      if (seen.has(event.id)) {
        return false
      }

      seen.add(event.id)
      return true
    }),
  ]
}

function isPermissionError(error: string | null) {
  return error?.toLowerCase().includes("permission") ?? false
}

function isComplexMetadataValue(value: unknown) {
  return Boolean(value) && typeof value === "object"
}
