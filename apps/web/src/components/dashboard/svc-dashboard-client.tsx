"use client"

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Truck,
  UserRound,
} from "lucide-react"
import { DashboardMetricCard } from "@/components/dashboard/dashboard-metric-card"
import {
  DashboardError,
  DashboardLoading,
} from "@/components/dashboard/dashboard-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { createCustomer, getCustomers, type Customer } from "@/lib/customers"
import { formatLocalDateTime } from "@/lib/date"
import type { Project } from "@/lib/projects"
import { getProjects } from "@/lib/projects"
import {
  cancelSiteVisit,
  completeSiteVisit,
  createDriver,
  createSiteVisit,
  createVehicle,
  getDrivers,
  getSiteVisits,
  getVehicles,
  startSiteVisit,
  type Driver,
  type SiteVisit,
  type SiteVisitStatus,
  type Vehicle,
} from "@/lib/site-visits"
import { getSalesExecutives } from "@/lib/users"
import type { AuthUser } from "@/lib/auth"

const EMPTY_SELECT_VALUE = "__none"
const NEW_CUSTOMER_VALUE = "__new"
const VISIT_STATUSES: SiteVisitStatus[] = [
  "SCHEDULED",
  "STARTED",
  "COMPLETED",
  "CANCELLED",
]

type VisitFormState = {
  customerId: string
  customerName: string
  customerPhone: string
  customerEmail: string
  projectId: string
  vehicleId: string
  driverId: string
  assignedToId: string
  scheduledAt: string
  notes: string
}

type SvcDashboardView = "overview" | "site-visits" | "vehicles" | "drivers"

const initialVisitForm: VisitFormState = {
  customerId: NEW_CUSTOMER_VALUE,
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  projectId: EMPTY_SELECT_VALUE,
  vehicleId: EMPTY_SELECT_VALUE,
  driverId: EMPTY_SELECT_VALUE,
  assignedToId: EMPTY_SELECT_VALUE,
  scheduledAt: "",
  notes: "",
}

export function SvcDashboardClient({
  view = "overview",
}: {
  view?: SvcDashboardView
}) {
  const [visits, setVisits] = useState<SiteVisit[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [salesUsers, setSalesUsers] = useState<AuthUser[]>([])
  const [visitForm, setVisitForm] = useState<VisitFormState>(initialVisitForm)
  const [selectedVisitId, setSelectedVisitId] = useState("")
  const [targetStatus, setTargetStatus] = useState<SiteVisitStatus>("STARTED")
  const [statusNotes, setStatusNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedVisit =
    visits.find((visit) => visit.id === selectedVisitId) ?? visits[0] ?? null
  const showOverview = view === "overview"
  const showSiteVisitWorkflows = view === "site-visits"
  const showVehicleWorkflows = view === "vehicles"
  const showDriverWorkflows = view === "drivers"

  const summary = useMemo(
    () => ({
      upcoming: visits.filter((visit) => visit.status === "SCHEDULED").length,
      completed: visits.filter((visit) => visit.status === "COMPLETED").length,
      pending: visits.filter((visit) =>
        ["SCHEDULED", "STARTED"].includes(visit.status)
      ).length,
      vehicles: vehicles.length,
      drivers: drivers.length,
    }),
    [drivers.length, vehicles.length, visits]
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
      const [
        visitData,
        vehicleData,
        driverData,
        customerData,
        projectData,
        salesData,
      ] = await Promise.all([
        getSiteVisits(token),
        getVehicles(token),
        getDrivers(token),
        getCustomers(token),
        getProjects(token),
        getSalesExecutives(token),
      ])
      setVisits(visitData)
      setVehicles(vehicleData)
      setDrivers(driverData)
      setCustomers(customerData)
      setProjects(projectData)
      setSalesUsers(salesData)
      setSelectedVisitId((current) =>
        current && visitData.some((visit) => visit.id === current)
          ? current
          : visitData[0]?.id ?? ""
      )
    } catch (err) {
      setError(getFriendlyApiError(err, "Unable to load SVC dashboard"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(loadDashboard)
  }, [loadDashboard])

  async function handleScheduleVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!visitForm.scheduledAt) {
      setError("Visit date and time are required.")
      return
    }

    await runAction(async (token) => {
      let customerId =
        visitForm.customerId === NEW_CUSTOMER_VALUE
          ? ""
          : visitForm.customerId

      if (!customerId) {
        if (!visitForm.customerName.trim() || !visitForm.customerPhone.trim()) {
          throw new Error("Customer name and phone are required.")
        }

        const customer = await createCustomer(token, {
          fullName: visitForm.customerName,
          phone: visitForm.customerPhone,
          email: visitForm.customerEmail,
          assignedToId:
            visitForm.assignedToId === EMPTY_SELECT_VALUE
              ? undefined
              : visitForm.assignedToId,
        })
        customerId = customer.id
      }

      await createSiteVisit(token, {
        customerId,
        scheduledAt: new Date(visitForm.scheduledAt).toISOString(),
        projectId:
          visitForm.projectId === EMPTY_SELECT_VALUE
            ? undefined
            : visitForm.projectId,
        vehicleId:
          visitForm.vehicleId === EMPTY_SELECT_VALUE
            ? undefined
            : visitForm.vehicleId,
        driverId:
          visitForm.driverId === EMPTY_SELECT_VALUE ? undefined : visitForm.driverId,
        assignedToId:
          visitForm.assignedToId === EMPTY_SELECT_VALUE
            ? undefined
            : visitForm.assignedToId,
        notes: visitForm.notes,
      })
      setVisitForm(initialVisitForm)
      setActionMessage("Site visit scheduled.")
      await loadDashboard()
    })
  }

  async function handleStatusUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedVisit) {
      setError("Select a visit to update.")
      return
    }

    await runAction(async (token) => {
      const updatedVisit = await transitionVisit(token, selectedVisit, targetStatus)
      setVisits((current) =>
        current.map((visit) =>
          visit.id === selectedVisit.id ? updatedVisit : visit
        )
      )
      setActionMessage("Visit status updated.")
      setStatusNotes("")
    })
  }

  async function transitionVisit(
    token: string,
    visit: SiteVisit,
    nextStatus: SiteVisitStatus
  ) {
    if (visit.status === nextStatus) {
      return visit
    }

    if (nextStatus === "SCHEDULED") {
      throw new Error("Scheduled is the initial visit state and cannot be restored.")
    }

    if (nextStatus === "STARTED") {
      if (visit.status !== "SCHEDULED") {
        throw new Error("Only scheduled visits can be started.")
      }

      return startSiteVisit(token, visit.id)
    }

    if (nextStatus === "COMPLETED") {
      if (visit.status === "SCHEDULED") {
        const startedVisit = await startSiteVisit(token, visit.id)
        return completeSiteVisit(token, startedVisit.id, statusNotes)
      }

      if (visit.status === "STARTED") {
        return completeSiteVisit(token, visit.id, statusNotes)
      }

      throw new Error("Only scheduled or started visits can be completed.")
    }

    if (nextStatus === "CANCELLED") {
      if (!statusNotes.trim()) {
        throw new Error("Cancellation reason is required.")
      }

      if (visit.status === "SCHEDULED" || visit.status === "STARTED") {
        return cancelSiteVisit(token, visit.id, statusNotes)
      }

      throw new Error("Only scheduled or started visits can be cancelled.")
    }

    return visit
  }

  async function handleCreateVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const registrationNumber = getFormValue(formData, "registrationNumber")

    if (!registrationNumber) {
      setError("Vehicle registration number is required.")
      return
    }

    await runAction(async (token) => {
      await createVehicle(token, {
        registrationNumber,
        name: getFormValue(formData, "name"),
        type: getFormValue(formData, "type"),
        capacity: getFormValue(formData, "capacity"),
        notes: getFormValue(formData, "notes"),
      })
      form.reset()
      setActionMessage("Vehicle added.")
      await loadDashboard()
    })
  }

  async function handleCreateDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const fullName = getFormValue(formData, "fullName")
    const phone = getFormValue(formData, "phone")

    if (!fullName || !phone) {
      setError("Driver name and phone are required.")
      return
    }

    await runAction(async (token) => {
      await createDriver(token, {
        fullName,
        phone,
        licenseNumber: getFormValue(formData, "licenseNumber"),
        notes: getFormValue(formData, "notes"),
      })
      form.reset()
      setActionMessage("Driver added.")
      await loadDashboard()
    })
  }

  async function runAction(action: (token: string) => Promise<void>) {
    const token = getToken()

    if (!token) {
      setError("Your session has expired. Please log in again.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    setActionMessage(null)

    try {
      await action(token)
    } catch (err) {
      setError(getFriendlyApiError(err, "Unable to complete SVC action"))
    } finally {
      setIsSubmitting(false)
    }
  }

  function updateVisitForm<Key extends keyof VisitFormState>(
    key: Key,
    value: VisitFormState[Key]
  ) {
    setVisitForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  if (isLoading) {
    return (
      <DashboardLoading
        title="Loading SVC dashboard"
        description="Preparing assigned visits, vehicles, and drivers."
        rows={6}
        sections={3}
      />
    )
  }

  if (error && visits.length === 0 && vehicles.length === 0 && drivers.length === 0) {
    return (
      <DashboardError
        title="SVC dashboard unavailable"
        message={error}
        onRetry={loadDashboard}
      />
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4" aria-labelledby="svc-summary-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="svc-summary-heading" className="text-base font-semibold">
              Visit coordination
            </h2>
            <p className="text-sm text-muted-foreground">
              Schedule visits, update status, and manage trip resources.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={loadDashboard}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <DashboardMetricCard
            label="Upcoming"
            value={summary.upcoming}
            description="Scheduled visits"
            icon={CalendarClock}
          />
          <DashboardMetricCard
            label="Completed"
            value={summary.completed}
            description="Closed visits"
            icon={CheckCircle2}
            accent="border-l-emerald-500"
          />
          <DashboardMetricCard
            label="Pending"
            value={summary.pending}
            description="Scheduled or started"
            icon={Clock3}
            accent="border-l-amber-500"
          />
          <DashboardMetricCard
            label="Vehicles"
            value={summary.vehicles}
            description="Active vehicle list"
            icon={Truck}
            accent="border-l-sky-500"
          />
          <DashboardMetricCard
            label="Drivers"
            value={summary.drivers}
            description="Active driver list"
            icon={UserRound}
            accent="border-l-indigo-500"
          />
        </div>
      </section>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {actionMessage ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {actionMessage}
        </p>
      ) : null}

      {showOverview ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Assigned visits</CardTitle>
            <CardDescription>
              Upcoming and active visit work for coordination.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {visits.length === 0 ? (
              <EmptyPanel message="No site visits are assigned yet." />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {visits.slice(0, 6).map((visit) => (
                  <VisitCard
                    key={visit.id}
                    visit={visit}
                    onSelect={() => setSelectedVisitId(visit.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {showSiteVisitWorkflows ? (
      <>
      <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <Card className="rounded-lg" id="site-visits">
          <CardHeader>
            <CardTitle>Schedule site visit</CardTitle>
            <CardDescription>
              Link a visit to an existing or quick-created customer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={handleScheduleVisit}>
              <Field label="Customer" htmlFor="visitCustomer">
                <Select
                  value={visitForm.customerId}
                  disabled={isSubmitting}
                  onValueChange={(value) => updateVisitForm("customerId", value)}
                >
                  <SelectTrigger id="visitCustomer" className="w-full">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NEW_CUSTOMER_VALUE}>New customer</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.fullName} - {customer.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {visitForm.customerId === NEW_CUSTOMER_VALUE ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Customer name" htmlFor="customerName">
                    <Input
                      id="customerName"
                      value={visitForm.customerName}
                      disabled={isSubmitting}
                      onChange={(event) =>
                        updateVisitForm("customerName", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Customer phone" htmlFor="customerPhone">
                    <Input
                      id="customerPhone"
                      value={visitForm.customerPhone}
                      disabled={isSubmitting}
                      onChange={(event) =>
                        updateVisitForm("customerPhone", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Customer email" htmlFor="customerEmail">
                    <Input
                      id="customerEmail"
                      type="email"
                      value={visitForm.customerEmail}
                      disabled={isSubmitting}
                      onChange={(event) =>
                        updateVisitForm("customerEmail", event.target.value)
                      }
                    />
                  </Field>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <OptionalSelect
                  label="Project"
                  id="visitProject"
                  value={visitForm.projectId}
                  onChange={(value) => updateVisitForm("projectId", value)}
                  options={projects.map((project) => ({
                    value: project.id,
                    label: project.projectName,
                  }))}
                />
                <Field label="Visit date/time" htmlFor="scheduledAt">
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={visitForm.scheduledAt}
                    disabled={isSubmitting}
                    onChange={(event) =>
                      updateVisitForm("scheduledAt", event.target.value)
                    }
                  />
                </Field>
                <OptionalSelect
                  label="Assigned SE"
                  id="assignedTo"
                  value={visitForm.assignedToId}
                  onChange={(value) => updateVisitForm("assignedToId", value)}
                  options={salesUsers.map((user) => ({
                    value: user.id,
                    label: `${user.name} - ${user.email}`,
                  }))}
                />
                <OptionalSelect
                  label="Vehicle"
                  id="visitVehicle"
                  value={visitForm.vehicleId}
                  onChange={(value) => updateVisitForm("vehicleId", value)}
                  options={vehicles.map((vehicle) => ({
                    value: vehicle.id,
                    label: vehicle.registrationNumber,
                  }))}
                />
                <OptionalSelect
                  label="Driver"
                  id="visitDriver"
                  value={visitForm.driverId}
                  onChange={(value) => updateVisitForm("driverId", value)}
                  options={drivers.map((driver) => ({
                    value: driver.id,
                    label: `${driver.fullName} - ${driver.phone}`,
                  }))}
                />
              </div>
              <Field label="Notes" htmlFor="visitNotes">
                <Input
                  id="visitNotes"
                  value={visitForm.notes}
                  disabled={isSubmitting}
                  onChange={(event) => updateVisitForm("notes", event.target.value)}
                />
              </Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Schedule visit
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Update visit status</CardTitle>
            <CardDescription>
              Use existing start, complete, and cancel workflows.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedVisit ? (
              <form className="grid gap-3" onSubmit={handleStatusUpdate}>
                <Field label="Visit" htmlFor="selectedVisit">
                  <Select
                    value={selectedVisit.id}
                    disabled={isSubmitting}
                    onValueChange={setSelectedVisitId}
                  >
                    <SelectTrigger id="selectedVisit" className="w-full">
                      <SelectValue placeholder="Select visit" />
                    </SelectTrigger>
                    <SelectContent>
                      {visits.map((visit) => (
                        <SelectItem key={visit.id} value={visit.id}>
                          {getVisitLabel(visit)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Target status" htmlFor="targetStatus">
                  <Select
                    value={targetStatus}
                    disabled={isSubmitting}
                    onValueChange={(value) =>
                      setTargetStatus(value as SiteVisitStatus)
                    }
                  >
                    <SelectTrigger id="targetStatus" className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {toTitleLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Notes / reason" htmlFor="statusNotes">
                  <Input
                    id="statusNotes"
                    value={statusNotes}
                    disabled={isSubmitting}
                    onChange={(event) => setStatusNotes(event.target.value)}
                  />
                </Field>
                <Button type="submit" variant="outline" disabled={isSubmitting}>
                  Update visit
                </Button>
              </form>
            ) : (
              <EmptyPanel message="Schedule a visit to enable status updates." />
            )}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Assigned visits</CardTitle>
          <CardDescription>Upcoming and active visit work.</CardDescription>
        </CardHeader>
        <CardContent>
          {visits.length === 0 ? (
            <EmptyPanel message="No site visits are assigned yet." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {visits.map((visit) => (
                <VisitCard
                  key={visit.id}
                  visit={visit}
                  onSelect={() => setSelectedVisitId(visit.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </>
      ) : null}

      {showVehicleWorkflows ? (
      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-lg" id="vehicles">
          <CardHeader>
            <CardTitle>Add vehicle</CardTitle>
            <CardDescription>Register a vehicle for visit coordination.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={handleCreateVehicle}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Registration number" htmlFor="registrationNumber">
                  <Input
                    id="registrationNumber"
                    name="registrationNumber"
                    disabled={isSubmitting}
                  />
                </Field>
                <Field label="Vehicle name" htmlFor="vehicleName">
                  <Input id="vehicleName" name="name" disabled={isSubmitting} />
                </Field>
                <Field label="Type" htmlFor="vehicleType">
                  <Input id="vehicleType" name="type" disabled={isSubmitting} />
                </Field>
                <Field label="Capacity" htmlFor="vehicleCapacity">
                  <Input
                    id="vehicleCapacity"
                    name="capacity"
                    type="number"
                    min="1"
                    disabled={isSubmitting}
                  />
                </Field>
              </div>
              <Field label="Notes" htmlFor="vehicleNotes">
                <Input id="vehicleNotes" name="notes" disabled={isSubmitting} />
              </Field>
              <Button type="submit" variant="outline" disabled={isSubmitting}>
                Add vehicle
              </Button>
            </form>
          </CardContent>
        </Card>
        <ResourceCard
          id="vehicle-list"
          title="Active vehicles"
          emptyMessage="No active vehicles are available."
          items={vehicles.map((vehicle) => ({
            id: vehicle.id,
            title: vehicle.registrationNumber,
            subtitle: [vehicle.name, vehicle.type].filter(Boolean).join(" - "),
            meta:
              vehicle.capacity !== null && vehicle.capacity !== undefined
                ? `${vehicle.capacity} seats`
                : "Capacity not set",
          }))}
        />
      </section>
      ) : null}

      {showDriverWorkflows ? (
      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-lg" id="drivers">
          <CardHeader>
            <CardTitle>Add driver</CardTitle>
            <CardDescription>Register a driver for visit coordination.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={handleCreateDriver}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Driver name" htmlFor="driverName">
                  <Input id="driverName" name="fullName" disabled={isSubmitting} />
                </Field>
                <Field label="Phone" htmlFor="driverPhone">
                  <Input id="driverPhone" name="phone" disabled={isSubmitting} />
                </Field>
                <Field label="License number" htmlFor="licenseNumber">
                  <Input
                    id="licenseNumber"
                    name="licenseNumber"
                    disabled={isSubmitting}
                  />
                </Field>
              </div>
              <Field label="Notes" htmlFor="driverNotes">
                <Input id="driverNotes" name="notes" disabled={isSubmitting} />
              </Field>
              <Button type="submit" variant="outline" disabled={isSubmitting}>
                Add driver
              </Button>
            </form>
          </CardContent>
        </Card>
        <ResourceCard
          id="driver-list"
          title="Active drivers"
          emptyMessage="No active drivers are available."
          items={drivers.map((driver) => ({
            id: driver.id,
            title: driver.fullName,
            subtitle: driver.phone,
            meta: driver.licenseNumber ?? "License not set",
          }))}
        />
      </section>
      ) : null}
    </div>
  )
}

function OptionalSelect({
  label,
  id,
  value,
  onChange,
  options,
}: {
  label: string
  id: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY_SELECT_VALUE}>Not set</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function VisitCard({
  visit,
  onSelect,
}: {
  visit: SiteVisit
  onSelect: () => void
}) {
  const contact = visit.customer ?? visit.lead

  return (
    <button
      type="button"
      className="rounded-lg border bg-background p-4 text-left hover:bg-muted/40"
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{contact?.fullName ?? "Visit"}</p>
          <p className="text-xs text-muted-foreground">
            {formatLocalDateTime(visit.scheduledAt)}
          </p>
        </div>
        <VisitStatusBadge status={visit.status} />
      </div>

      <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
        <p>Project: {visit.project?.projectName ?? "Not set"}</p>
        <p>Vehicle: {visit.vehicle?.registrationNumber ?? "Not assigned"}</p>
        <p>Driver: {visit.driver?.fullName ?? "Not assigned"}</p>
      </div>
    </button>
  )
}

function VisitStatusBadge({ status }: { status: SiteVisitStatus }) {
  const className =
    status === "COMPLETED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "STARTED"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : status === "SCHEDULED"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : ""

  return (
    <Badge variant="outline" className={`rounded-md ${className}`}>
      {toTitleLabel(status)}
    </Badge>
  )
}

function ResourceCard({
  id,
  title,
  emptyMessage,
  items,
}: {
  id: string
  title: string
  emptyMessage: string
  items: Array<{ id: string; title: string; subtitle: string; meta: string }>
}) {
  return (
    <Card className="rounded-lg" id={id}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyPanel message={emptyMessage} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border bg-background p-4">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.subtitle || "Details not set"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{item.meta}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function getVisitLabel(visit: SiteVisit) {
  const contact = visit.customer?.fullName ?? visit.lead?.fullName ?? "Visit"

  return `${contact} - ${formatLocalDateTime(visit.scheduledAt)}`
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key)

  return typeof value === "string" ? value.trim() : ""
}

function toTitleLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ")
}
