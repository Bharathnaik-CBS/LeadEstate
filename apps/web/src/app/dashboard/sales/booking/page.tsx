"use client"

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import {
  DashboardEmpty,
  DashboardError,
  DashboardLoading,
} from "@/components/dashboard/dashboard-state"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import { getFriendlyApiError } from "@/lib/api"
import { getToken, type AuthUser } from "@/lib/auth"
import { formatLocalDate } from "@/lib/date"
import { getMyLeads, type Lead } from "@/lib/leads"
import {
  createBooking,
  getProjectPlots,
  getProjects,
  type BookingType,
  type Plot,
  type Project,
} from "@/lib/projects"

type BookingForm = {
  leadId: string
  projectId: string
  plotId: string
  type: BookingType
  amountPaid: string
  bookingDate: string
}

type BookingFormErrors = Partial<Record<keyof BookingForm, string>>

const initialBookingForm: BookingForm = {
  leadId: "",
  projectId: "",
  plotId: "",
  type: "BLOCKED",
  amountPaid: "",
  bookingDate: new Date().toISOString().slice(0, 10),
}

function createInitialBookingForm(): BookingForm {
  if (typeof window === "undefined") {
    return initialBookingForm
  }

  const searchParams = new URLSearchParams(window.location.search)

  return {
    ...initialBookingForm,
    leadId: searchParams.get("leadId") ?? "",
    type: searchParams.get("type") === "BOOKED" ? "BOOKED" : "BLOCKED",
    bookingDate: new Date().toISOString().slice(0, 10),
  }
}

export default function SalesBookingPage() {
  return (
    <ProtectedRoute allowedRoles={["SALES_EXECUTIVE"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Complete Booking"
          description="Confirm the project, plot, payment, and booking status."
        >
          <BookingClient user={user} />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}

function BookingClient({ user }: { user: AuthUser }) {
  const router = useRouter()
  const token = useMemo(() => getToken(), [])
  const toast = useToast()
  const formId = useId()
  const [form, setForm] = useState<BookingForm>(() => createInitialBookingForm())
  const [leads, setLeads] = useState<Lead[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [plots, setPlots] = useState<Plot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPlotLoading, setIsPlotLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [plotError, setPlotError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<BookingFormErrors>({})

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === form.leadId) ?? null,
    [form.leadId, leads]
  )
  const availablePlots = useMemo(
    () =>
      form.projectId
        ? plots.filter(
            (plot) => plot.status !== "BOOKED" && plot.status !== "CANCELLED"
          )
        : [],
    [form.projectId, plots]
  )
  const getErrorId = useCallback(
    (field: keyof BookingForm) => `${formId}-${field}-error`,
    [formId]
  )
  const getHintId = useCallback(
    (field: keyof BookingForm) => `${formId}-${field}-hint`,
    [formId]
  )
  const submitGuidanceId = `${formId}-submit-guidance`
  const plotHint = getPlotHint({
    hasProject: Boolean(form.projectId),
    isPlotLoading,
    plotError,
    availablePlotCount: availablePlots.length,
  })
  const submitGuidance = getBookingSubmitGuidance({
    form,
    isPlotLoading,
    plotError,
    availablePlotCount: availablePlots.length,
  })
  const canSubmit = !isSubmitting && !isPlotLoading && !submitGuidance

  const loadData = useCallback(async () => {
    if (!token) {
      const message = "Your session has expired. Please log in again."
      setLoadError(message)
      toast.error("Unable to load booking details", message)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)
    setSubmitError(null)

    try {
      const [leadData, projectData] = await Promise.all([
        getMyLeads(token),
        getProjects(token),
      ])
      setLeads(leadData)
      setProjects(projectData)
      setForm((current) => {
        if (current.projectId) {
          return current
        }

        const selectedLead = leadData.find((lead) => lead.id === current.leadId)
        const interestedProject = projectData.find((project) =>
          selectedLead?.interestedProjectIds?.includes(project.id)
        )

        return interestedProject
          ? {
              ...current,
              projectId: interestedProject.id,
              plotId: "",
            }
          : current
      })
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to load booking details")
      setLoadError(message)
      toast.error("Unable to load booking details", message)
    } finally {
      setIsLoading(false)
    }
  }, [toast, token])

  useEffect(() => {
    void Promise.resolve().then(loadData)
  }, [loadData])

  useEffect(() => {
    if (!token || !form.projectId) {
      return
    }

    let isActive = true

    void Promise.resolve()
      .then(async () => {
        if (!isActive) {
          return
        }

        setIsPlotLoading(true)
        setPlotError(null)
        setPlots([])
        const plotData = await getProjectPlots(token, form.projectId)

        if (isActive) {
          setPlots(plotData)
        }
      })
      .catch((err) => {
        if (isActive) {
          const message = getFriendlyApiError(err, "Unable to load project plots")
          setPlotError(message)
          toast.error("Unable to load project plots", message)
        }
      })
      .finally(() => {
        if (isActive) {
          setIsPlotLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [form.projectId, toast, token])

  function updateForm<Key extends keyof BookingForm>(
    key: Key,
    value: BookingForm[Key]
  ) {
    setFormErrors((current) => ({
      ...current,
      [key]: undefined,
      ...(key === "projectId" ? { plotId: undefined } : {}),
    }))
    setSubmitError(null)

    if (key === "projectId") {
      setPlots([])
      setPlotError(null)
    }

    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "projectId" ? { plotId: "" } : {}),
    }))
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateBookingForm(form)

    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors)
      setSubmitError("Complete the required booking details before confirming.")
      return
    }

    if (!token) {
      const message = "Your session has expired. Please log in again."
      setSubmitError(message)
      toast.error("Unable to confirm booking", message)
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await createBooking(token, form)
      toast.success(
        form.type === "BOOKED" ? "Booking confirmed" : "Plot blocked",
        `${selectedLead?.fullName ?? "Lead"} was updated successfully.`
      )
      router.replace("/dashboard/sales/leads")
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to confirm booking")
      setSubmitError(message)
      toast.error("Unable to confirm booking", message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLoading
        className="max-w-4xl"
        title="Loading booking details"
        description="Fetching your leads, projects, and booking inventory."
        rows={0}
        sections={1}
      />
    )
  }

  if (loadError) {
    return (
      <div className="max-w-4xl">
        <DashboardError
          title="Booking details unavailable"
          message={loadError}
          onRetry={loadData}
        />
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div className="max-w-4xl">
        <DashboardEmpty
          title="No leads ready for booking"
          message="A lead must be available before a booking or plot block can be completed."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => router.replace("/dashboard/sales/leads")}
            >
              Back to leads
            </Button>
          }
        />
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="max-w-4xl">
        <DashboardEmpty
          title="No projects available"
          message="Projects and plots must be available before a booking or plot block can be completed."
        />
      </div>
    )
  }

  return (
    <form className="max-w-4xl space-y-4" noValidate onSubmit={handleConfirm}>
      {submitError ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {submitError}
        </div>
      ) : null}

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Booking details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Sales Executive" value={user.name} />
          <ReadOnlyField
            label="Booking date"
            value={formatLocalDate(form.bookingDate)}
          />
          <ReadOnlyField
            label="Customer"
            value={selectedLead?.fullName ?? "Lead not selected"}
          />
          <ReadOnlyField
            label="Contact"
            value={
              selectedLead
                ? [selectedLead.phone, selectedLead.email]
                    .filter(Boolean)
                    .join(" - ")
                : "Not available"
            }
          />

          <Field
            label="Lead"
            htmlFor="leadId"
            required
            error={formErrors.leadId}
            errorId={getErrorId("leadId")}
            hint="Choose the customer lead this booking belongs to."
            hintId={getHintId("leadId")}
          >
            <Select
              value={form.leadId}
              disabled={isSubmitting}
              onValueChange={(value) => updateForm("leadId", value)}
            >
              <SelectTrigger
                id="leadId"
                className="w-full"
                aria-label="Lead for booking"
                aria-invalid={Boolean(formErrors.leadId)}
                aria-describedby={
                  formErrors.leadId ? getErrorId("leadId") : getHintId("leadId")
                }
              >
                <SelectValue placeholder="Select lead" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.fullName} - {lead.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Type"
            htmlFor="bookingType"
            hint="Choose whether this should block or book the selected plot."
            hintId={getHintId("type")}
          >
            <Select
              value={form.type}
              disabled={isSubmitting}
              onValueChange={(value) => updateForm("type", value as BookingType)}
            >
              <SelectTrigger
                id="bookingType"
                className="w-full"
                aria-label="Booking type"
                aria-describedby={getHintId("type")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
                <SelectItem value="BOOKED">Booked</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Project"
            htmlFor="projectId"
            required
            error={formErrors.projectId}
            errorId={getErrorId("projectId")}
            hint="Selecting a project loads available plots for that project."
            hintId={getHintId("projectId")}
          >
            <Select
              value={form.projectId}
              disabled={isSubmitting}
              onValueChange={(value) => updateForm("projectId", value)}
            >
              <SelectTrigger
                id="projectId"
                className="w-full"
                aria-label="Project for booking"
                aria-invalid={Boolean(formErrors.projectId)}
                aria-describedby={
                  formErrors.projectId
                    ? getErrorId("projectId")
                    : getHintId("projectId")
                }
              >
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.projectName} - {project.location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Plot number"
            htmlFor="plotId"
            required
            error={formErrors.plotId ?? plotError ?? undefined}
            errorId={getErrorId("plotId")}
            hint={plotHint}
            hintId={getHintId("plotId")}
          >
            <Select
              value={form.plotId}
              disabled={
                isSubmitting ||
                isPlotLoading ||
                !form.projectId ||
                Boolean(plotError) ||
                availablePlots.length === 0
              }
              onValueChange={(value) => updateForm("plotId", value)}
            >
              <SelectTrigger
                id="plotId"
                className="w-full"
                aria-label="Plot number for booking"
                aria-invalid={Boolean(formErrors.plotId || plotError)}
                aria-describedby={
                  formErrors.plotId || plotError
                    ? getErrorId("plotId")
                    : getHintId("plotId")
                }
              >
                <SelectValue
                  placeholder={getPlotPlaceholder({
                    hasProject: Boolean(form.projectId),
                    isPlotLoading,
                    plotError,
                    availablePlotCount: availablePlots.length,
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                {availablePlots.map((plot) => (
                  <SelectItem key={plot.id} value={plot.id}>
                    {plot.plotNumber} - {formatPlotStatus(plot.status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Amount paid"
            htmlFor="amountPaid"
            hint="Optional. Leave blank if no payment has been collected yet."
            hintId={getHintId("amountPaid")}
          >
            <Input
              id="amountPaid"
              type="number"
              min="0"
              value={form.amountPaid}
              disabled={isSubmitting}
              aria-describedby={getHintId("amountPaid")}
              onChange={(event) => updateForm("amountPaid", event.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          disabled={!canSubmit}
          aria-busy={isSubmitting}
          aria-describedby={submitGuidanceId}
        >
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {isSubmitting ? "Confirming..." : "Confirm"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => router.replace("/dashboard/sales/leads")}
        >
          Cancel
        </Button>
      </div>
      <p
        id={submitGuidanceId}
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {submitGuidance ??
          "Ready to confirm once the selected lead, project, and plot are correct."}
      </p>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  required,
  error,
  errorId,
  hint,
  hintId,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  error?: string
  errorId?: string
  hint?: string
  hintId?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="flex items-center gap-2">
        {label}
        {required ? (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
            Required
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function validateBookingForm(form: BookingForm): BookingFormErrors {
  const errors: BookingFormErrors = {}

  if (!form.leadId) {
    errors.leadId = "Select the lead for this booking."
  }

  if (!form.projectId) {
    errors.projectId = "Select the project for this booking."
  }

  if (!form.plotId) {
    errors.plotId = "Select an available plot before confirming."
  }

  if (!form.bookingDate) {
    errors.bookingDate = "Booking date is required."
  }

  return errors
}

type PlotStateDetails = {
  hasProject: boolean
  isPlotLoading: boolean
  plotError: string | null
  availablePlotCount: number
}

function getPlotHint({
  hasProject,
  isPlotLoading,
  plotError,
  availablePlotCount,
}: PlotStateDetails) {
  if (!hasProject) {
    return "Select a project first to load available plots."
  }

  if (isPlotLoading) {
    return "Loading available plots for the selected project."
  }

  if (plotError) {
    return "Plots could not be loaded for the selected project."
  }

  if (availablePlotCount === 0) {
    return "No available plots are currently loaded for this project."
  }

  return "Only available or blocked plots are shown."
}

function getPlotPlaceholder(details: PlotStateDetails) {
  if (!details.hasProject) {
    return "Select project first"
  }

  if (details.isPlotLoading) {
    return "Loading plots..."
  }

  if (details.plotError) {
    return "Plots unavailable"
  }

  if (details.availablePlotCount === 0) {
    return "No available plots"
  }

  return "Select plot"
}

function getBookingSubmitGuidance({
  form,
  isPlotLoading,
  plotError,
  availablePlotCount,
}: {
  form: BookingForm
  isPlotLoading: boolean
  plotError: string | null
  availablePlotCount: number
}) {
  if (!form.leadId) {
    return "Select a lead before confirming."
  }

  if (!form.projectId) {
    return "Select a project to load plots."
  }

  if (isPlotLoading) {
    return "Wait for the plot list to finish loading."
  }

  if (plotError) {
    return "Resolve the plot loading error before confirming."
  }

  if (availablePlotCount === 0 && !form.plotId) {
    return "No available plots are loaded for this project."
  }

  if (!form.plotId) {
    return "Select a plot before confirming."
  }

  return null
}

function formatPlotStatus(status: Plot["status"]) {
  return status.replaceAll("_", " ").toLowerCase()
}
