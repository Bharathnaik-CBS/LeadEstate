"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, RefreshCw } from "lucide-react"
import {
  DashboardEmpty,
  DashboardError,
} from "@/components/dashboard/dashboard-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { getFriendlyApiError } from "@/lib/api"
import { getToken } from "@/lib/auth"
import {
  formatLocalDate,
  formatLocalDateTime,
  toDateInputValue,
} from "@/lib/date"
import {
  createLead,
  getMyLeads,
  LEAD_STATUSES,
  type Lead,
  type LeadFormInput,
  type LeadProgressInput,
  type LeadStatus,
  updateLeadStatus,
} from "@/lib/leads"
import { getProjects, type Project } from "@/lib/projects"
import { LeadForm } from "./lead-form"
import { LeadStatusBadge } from "./lead-status-badge"

type LeadEditState = Required<Pick<LeadProgressInput, "status">> &
  Pick<LeadProgressInput, "followUpDate" | "remarks" | "interestedProjectIds">

export function SalesLeadsClient() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [leadEdits, setLeadEdits] = useState<Record<string, LeadEditState>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null)
  const [bookingLeadId, setBookingLeadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const router = useRouter()
  const token = useMemo(() => getToken(), [])
  const toast = useToast()

  const loadLeads = useCallback(async (showTableLoading = false) => {
    if (!token) {
      setError("Your session has expired. Please log in again.")
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }

    if (showTableLoading) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }
    setError(null)

    try {
      const [leadData, projectData] = await Promise.all([
        getMyLeads(token),
        getProjects(token),
      ])
      setLeads(leadData)
      setProjects(projectData)
      setLeadEdits(createLeadEditMap(leadData))
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to load leads")
      setError(message)

      if (!showTableLoading) {
        toast.error("Unable to refresh leads", message)
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [toast, token])

  useEffect(() => {
    void Promise.resolve().then(() => loadLeads(true))
  }, [loadLeads])

  useEffect(() => {
    function openFromHash() {
      if (window.location.hash !== "#create-lead") {
        return
      }

      setFormError(null)
      setIsCreateDialogOpen(true)
    }

    void Promise.resolve().then(openFromHash)
    window.addEventListener("hashchange", openFromHash)

    return () => {
      window.removeEventListener("hashchange", openFromHash)
    }
  }, [])

  function openCreateDialog() {
    setFormError(null)
    setIsCreateDialogOpen(true)
  }

  function handleCreateDialogOpenChange(open: boolean) {
    setIsCreateDialogOpen(open)

    if (!open && window.location.hash === "#create-lead") {
      window.history.replaceState(null, "", "/dashboard/sales/leads")
    }
  }

  async function handleCreateLead(input: LeadFormInput) {
    if (!token) {
      setFormError("Your session has expired. Please log in again.")
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      await createLead(token, input)
      setIsCreateDialogOpen(false)
      window.history.replaceState(null, "", "/dashboard/sales/leads")
      toast.success("Lead created", `${input.fullName} was added.`)
      await loadLeads(false)
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to create lead")
      setFormError(message)
      toast.error("Unable to create lead", message)
    } finally {
      setIsSaving(false)
    }
  }

  function updateLeadEdit<Key extends keyof LeadEditState>(
    leadId: string,
    key: Key,
    value: LeadEditState[Key]
  ) {
    setLeadEdits((current) => ({
      ...current,
      [leadId]: {
        ...(current[leadId] ??
          createLeadEdit(leads.find((lead) => lead.id === leadId))),
        [key]: value,
      },
    }))
  }

  function toggleInterestedProject(
    leadId: string,
    projectId: string,
    isSelected: boolean
  ) {
    const lead = leads.find((item) => item.id === leadId)

    setLeadEdits((current) => {
      const currentEdit = current[leadId] ?? createLeadEdit(lead)
      const projectIds = currentEdit.interestedProjectIds ?? []
      const nextProjectIds = isSelected
        ? Array.from(new Set([...projectIds, projectId]))
        : projectIds.filter((id) => id !== projectId)

      return {
        ...current,
        [leadId]: {
          ...currentEdit,
          interestedProjectIds: nextProjectIds,
        },
      }
    })
  }

  async function handleCompleteBooking(leadId: string) {
    if (!token) {
      setError("Your session has expired. Please log in again.")
      return
    }

    const status =
      leadEdits[leadId]?.status ??
      leads.find((lead) => lead.id === leadId)?.status ??
      "BLOCKED"

    if (!isBookingStatus(status)) {
      return
    }

    const type = status === "BOOKED" ? "BOOKED" : "BLOCKED"

    setBookingLeadId(leadId)
    setError(null)

    try {
      const updatedLead = await updateLeadStatus(token, leadId, leadEdits[leadId])
      setLeads((current) =>
        current.map((lead) => (lead.id === leadId ? updatedLead : lead))
      )
      setLeadEdits((current) => ({
        ...current,
        [leadId]: createLeadEdit(updatedLead),
      }))
      toast.success(
        "Lead updated",
        `${updatedLead.fullName} is ready for booking details.`
      )
    } catch (err) {
      const message = getFriendlyApiError(
        err,
        "Unable to update lead before booking"
      )
      setError(message)
      toast.error("Unable to continue booking", message)
      setBookingLeadId(null)
      return
    }

    router.push(`/dashboard/sales/booking?leadId=${leadId}&type=${type}`)
  }

  async function handleSaveProgress(leadId: string) {
    if (!token) {
      setError("Your session has expired. Please log in again.")
      return
    }

    setSavingLeadId(leadId)
    setError(null)

    try {
      const updatedLead = await updateLeadStatus(token, leadId, leadEdits[leadId])
      setLeads((current) =>
        current.map((lead) => (lead.id === leadId ? updatedLead : lead))
      )
      setLeadEdits((current) => ({
        ...current,
        [leadId]: createLeadEdit(updatedLead),
      }))
      toast.success("Lead updated", `${updatedLead.fullName} was updated.`)
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to update lead")
      setError(message)
      toast.error("Unable to update lead", message)
    } finally {
      setSavingLeadId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">My Leads</h2>
          <p className="text-sm text-muted-foreground">
            Update each lead as it moves through the pipeline.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading || isRefreshing}
            aria-busy={isRefreshing}
            onClick={() => loadLeads(false)}
          >
            {isRefreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Button type="button" onClick={openCreateDialog}>
            <Plus className="size-4" />
            Create Lead
          </Button>
        </div>
      </div>

      {error && leads.length > 0 ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>My Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadTableSkeleton />
          </CardContent>
        </Card>
      ) : error && leads.length === 0 ? (
        <DashboardError
          title="Leads unavailable"
          message={error}
          onRetry={() => loadLeads(true)}
        />
      ) : leads.length === 0 ? (
        <DashboardEmpty
          title="No assigned leads yet"
          message="Create a lead to start your pipeline."
        />
      ) : (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>My Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <Table
              aria-label="Sales lead pipeline"
              className="min-w-[1280px]"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Requirement</TableHead>
                  <TableHead>Interested Projects</TableHead>
                  <TableHead>Booking / Plot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Follow-up</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead>Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => {
                  const isLeadBusy =
                    savingLeadId === lead.id || bookingLeadId === lead.id
                  const isSavingLead = savingLeadId === lead.id
                  const isBookingLead = bookingLeadId === lead.id

                  return (
                  <TableRow key={lead.id} aria-busy={isLeadBusy}>
                    <TableCell className="min-w-56 whitespace-normal align-top">
                      <div className="space-y-1">
                        <p className="font-medium">{lead.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {lead.phone}
                          {lead.email ? ` - ${lead.email}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Created {formatLocalDate(lead.createdAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Updated {formatLocalDateTime(lead.updatedAt)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="min-w-44 whitespace-normal align-top">
                      <div className="space-y-1">
                        <p>{lead.propertyType || "Not set"}</p>
                        <p className="text-xs text-muted-foreground">
                          {[lead.location, lead.budget].filter(Boolean).join(" - ") ||
                            "Details pending"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-56 whitespace-normal align-top">
                      <p className="text-sm">
                        {formatProjectNames(
                          lead.interestedProjectIds ?? [],
                          projects
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-64 whitespace-normal align-top">
                      <div className="space-y-1 text-sm">
                        <p>{lead.finalProject?.projectName ?? "Not finalized"}</p>
                        <p className="text-xs text-muted-foreground">
                          Plot {lead.finalPlot?.plotNumber ?? "not set"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Amount {formatCurrency(lead.bookingAmount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Booking {formatLocalDate(lead.bookingDate, "not set")}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <LeadStatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell className="min-w-36 whitespace-normal align-top">
                      {formatLocalDate(lead.followUpDate, "No follow-up set")}
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-normal align-top">
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {lead.remarks || "No remarks yet"}
                      </p>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="grid min-w-72 gap-2">
                        <div className="rounded-md border p-2">
                          <p className="mb-2 text-xs font-medium">
                            Interested Projects
                          </p>
                          {projects.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No projects available yet.
                            </p>
                          ) : (
                            <div className="grid max-h-28 gap-2 overflow-y-auto">
                              {projects.map((project) => {
                                const selectedIds =
                                  leadEdits[lead.id]?.interestedProjectIds ?? []

                                return (
                                  <label
                                    key={project.id}
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    <input
                                      type="checkbox"
                                      className="size-4"
                                      checked={selectedIds.includes(project.id)}
                                      disabled={isLeadBusy}
                                      onChange={(event) =>
                                        toggleInterestedProject(
                                          lead.id,
                                          project.id,
                                          event.target.checked
                                        )
                                      }
                                    />
                                    <span>
                                      {project.projectName} - {project.location}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </div>
                        <Select
                          value={leadEdits[lead.id]?.status ?? lead.status}
                          disabled={isLeadBusy}
                          onValueChange={(value) =>
                            updateLeadEdit(
                              lead.id,
                              "status",
                              value as LeadStatus
                            )
                          }
                        >
                          <SelectTrigger
                            className="w-full"
                            aria-label={`Status for ${lead.fullName}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_STATUSES.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="date"
                          value={leadEdits[lead.id]?.followUpDate ?? ""}
                          disabled={isLeadBusy}
                          aria-label={`Follow-up date for ${lead.fullName}`}
                          onChange={(event) =>
                            updateLeadEdit(
                              lead.id,
                              "followUpDate",
                              event.target.value
                            )
                          }
                        />
                        <Textarea
                          value={leadEdits[lead.id]?.remarks ?? ""}
                          disabled={isLeadBusy}
                          placeholder="Remarks"
                          aria-label={`Remarks for ${lead.fullName}`}
                          className="min-h-20"
                          onChange={(event) =>
                            updateLeadEdit(lead.id, "remarks", event.target.value)
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isLeadBusy}
                          aria-label={`Save update for ${lead.fullName}`}
                          aria-busy={isSavingLead}
                          onClick={() => handleSaveProgress(lead.id)}
                        >
                          {isSavingLead ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : null}
                          {isSavingLead ? "Saving..." : "Save Update"}
                        </Button>
                        {isBookingStatus(leadEdits[lead.id]?.status) ? (
                          <Button
                            type="button"
                            disabled={isLeadBusy}
                            aria-label={`Complete booking for ${lead.fullName}`}
                            aria-busy={isBookingLead}
                            onClick={() => handleCompleteBooking(lead.id)}
                          >
                            {isBookingLead ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : null}
                            {isBookingLead ? "Opening..." : "Complete Booking"}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Lead</DialogTitle>
            <DialogDescription>
              Add a new customer lead to your own pipeline.
            </DialogDescription>
          </DialogHeader>
          {formError ? (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </div>
          ) : null}
          <LeadForm
            showAssignment={false}
            showSource={false}
            isSubmitting={isSaving}
            submitLabel="Create Lead"
            onSubmit={handleCreateLead}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function createLeadEditMap(leads: Lead[]) {
  return Object.fromEntries(
    leads.map((lead) => [lead.id, createLeadEdit(lead)])
  )
}

function createLeadEdit(lead?: Lead): LeadEditState {
  return {
    status: lead?.status ?? "NEW",
    followUpDate: toDateInputValue(lead?.followUpDate),
    remarks: lead?.remarks ?? "",
    interestedProjectIds: lead?.interestedProjectIds ?? [],
  }
}

function isBookingStatus(status?: LeadStatus) {
  return status === "BOOKED" || status === "BLOCKED"
}

function formatProjectNames(projectIds: string[], projects: Project[]) {
  if (projectIds.length === 0) {
    return "Not selected"
  }

  const names = projectIds.map((projectId) => {
    const project = projects.find((item) => item.id === projectId)
    return project?.projectName ?? "Project"
  })

  return names.join(", ")
}

function formatCurrency(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "not set"
  }

  const numericValue = Number(value)

  if (Number.isNaN(numericValue)) {
    return String(value)
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numericValue)
}

function LeadTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  )
}
