"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
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
import { useToast } from "@/components/ui/toast"
import { getFriendlyApiError } from "@/lib/api"
import { getToken, type AuthUser } from "@/lib/auth"
import { formatLocalDate, formatLocalDateTime } from "@/lib/date"
import {
  assignLead,
  createLead,
  deleteLead,
  getLeads,
  LEAD_SOURCES,
  type Lead,
  type LeadFormInput,
  type LeadSource,
  updateLead,
} from "@/lib/leads"
import { getSalesExecutives } from "@/lib/users"
import { LeadForm } from "./lead-form"
import { LeadStatusBadge } from "./lead-status-badge"

const SOURCE_LABELS = LEAD_SOURCES.reduce(
  (labels, source) => ({
    ...labels,
    [source.value]: source.label,
  }),
  {} as Record<LeadSource, string>
)

export function AdminLeadsClient() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [salesUsers, setSalesUsers] = useState<AuthUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null)
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create")
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const token = useMemo(() => getToken(), [])
  const toast = useToast()

  const loadData = useCallback(async (showTableLoading = false) => {
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
      const [leadData, salesData] = await Promise.all([
        getLeads(token),
        getSalesExecutives(token),
      ])
      setLeads(leadData)
      setSalesUsers(salesData)
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
    void Promise.resolve().then(() => loadData(true))
  }, [loadData])

  function openCreateDialog() {
    setDialogMode("create")
    setSelectedLead(null)
    setFormError(null)
    setIsDialogOpen(true)
  }

  function openEditDialog(lead: Lead) {
    setDialogMode("edit")
    setSelectedLead(lead)
    setFormError(null)
    setIsDialogOpen(true)
  }

  async function handleSubmit(input: LeadFormInput) {
    if (!token) {
      setFormError("Your session has expired. Please log in again.")
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      if (dialogMode === "create") {
        await createLead(token, input)
        toast.success("Lead created", `${input.fullName} was added.`)
      } else if (selectedLead) {
        const updateInput = { ...input }
        delete updateInput.assignedToId
        await updateLead(token, selectedLead.id, updateInput)
        toast.success("Lead updated", `${selectedLead.fullName} was updated.`)
      }

      setIsDialogOpen(false)
      await loadData(false)
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to save lead")
      setFormError(message)
      toast.error("Unable to save lead", message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAssign(leadId: string, assignedToId: string) {
    if (!token) {
      setError("Your session has expired. Please log in again.")
      return
    }

    setAssigningLeadId(leadId)
    setError(null)

    try {
      await assignLead(token, leadId, assignedToId)
      const lead = leads.find((item) => item.id === leadId)
      const salesUser = salesUsers.find((user) => user.id === assignedToId)
      toast.success(
        "Lead assigned",
        `${lead?.fullName ?? "Lead"} assigned to ${
          salesUser?.name ?? "sales executive"
        }.`
      )
      await loadData(false)
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to assign lead")
      setError(message)
      toast.error("Unable to assign lead", message)
    } finally {
      setAssigningLeadId(null)
    }
  }

  async function handleDelete(lead: Lead) {
    if (!token) {
      setError("Your session has expired. Please log in again.")
      return
    }

    const shouldDelete = window.confirm(`Delete lead for ${lead.fullName}?`)

    if (!shouldDelete) {
      return
    }

    setError(null)
    setDeletingLeadId(lead.id)

    try {
      await deleteLead(token, lead.id)
      toast.success("Lead deleted", `${lead.fullName} was removed.`)
      await loadData(false)
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to delete lead")
      setError(message)
      toast.error("Unable to delete lead", message)
    } finally {
      setDeletingLeadId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Lead pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Review every lead and assign company enquiries to the sales team.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading || isRefreshing}
            aria-busy={isRefreshing}
            onClick={() => loadData(false)}
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
            Add Company Enquiry
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
            <CardTitle>All leads</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadTableSkeleton />
          </CardContent>
        </Card>
      ) : error && leads.length === 0 ? (
        <DashboardError
          title="Leads unavailable"
          message={error}
          onRetry={() => loadData(true)}
        />
      ) : leads.length === 0 ? (
        <DashboardEmpty
          title="No leads found"
          message="New company enquiries will appear here once they are created."
        />
      ) : (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>All leads</CardTitle>
          </CardHeader>
          <CardContent>
            <Table
              aria-label="Admin lead pipeline"
              className="min-w-[1240px]"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Requirement</TableHead>
                  <TableHead>Project / booking</TableHead>
                  <TableHead>Source / creator</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Follow-up / remarks</TableHead>
                  <TableHead>Sales Executive</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    aria-busy={
                      assigningLeadId === lead.id || deletingLeadId === lead.id
                    }
                  >
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
                    <TableCell className="max-w-64 whitespace-normal align-top">
                      <div className="space-y-1">
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
                    <TableCell className="min-w-44 whitespace-normal align-top">
                      <div className="space-y-1">
                        <p>{formatSource(lead.source)}</p>
                        <p className="text-xs text-muted-foreground">
                          Created by {formatUser(lead.createdBy)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <LeadStatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell className="max-w-72 whitespace-normal align-top">
                      <div className="space-y-1">
                        <p>{formatLocalDate(lead.followUpDate, "No follow-up set")}</p>
                        <p className="line-clamp-3 text-xs text-muted-foreground">
                          {lead.remarks || "No remarks yet"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="grid min-w-64 gap-2">
                        <div>
                          <p className="font-medium">
                            {formatUser(lead.assignedTo, "Unassigned")}
                          </p>
                          {lead.assignedTo?.email ? (
                            <p className="text-xs text-muted-foreground">
                              {lead.assignedTo.email}
                            </p>
                          ) : null}
                        </div>
                        <Select
                          value={getSelectedSalesUserId(lead, salesUsers)}
                          disabled={
                            salesUsers.length === 0 ||
                            assigningLeadId === lead.id
                          }
                          onValueChange={(value) => handleAssign(lead.id, value)}
                        >
                          <SelectTrigger
                            className="w-full"
                            aria-label={`Assign sales executive for ${lead.fullName}`}
                          >
                            <SelectValue placeholder="Assign sales executive" />
                          </SelectTrigger>
                          <SelectContent>
                            {salesUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name} - {user.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {assigningLeadId === lead.id ? (
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" />
                            Assigning...
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-top">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Edit lead for ${lead.fullName}`}
                          disabled={deletingLeadId === lead.id}
                          onClick={() => openEditDialog(lead)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          aria-label={`Delete lead for ${lead.fullName}`}
                          disabled={deletingLeadId === lead.id}
                          onClick={() => handleDelete(lead)}
                        >
                          {deletingLeadId === lead.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "Add Company Enquiry" : "Edit lead"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create"
                ? "Capture company enquiry details and optionally assign a sales executive."
                : "Update the lead details visible to the admin team."}
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
            key={selectedLead?.id ?? dialogMode}
            lead={selectedLead}
            salesUsers={salesUsers}
            showAssignment={dialogMode === "create"}
            defaultSource="ADMIN_GENERATED"
            isSubmitting={isSaving}
            submitLabel={
              dialogMode === "create" ? "Add Company Enquiry" : "Save lead"
            }
            onSubmit={handleSubmit}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function getSelectedSalesUserId(lead: Lead, salesUsers: AuthUser[]) {
  if (!lead.assignedToId) {
    return undefined
  }

  return salesUsers.some((user) => user.id === lead.assignedToId)
    ? lead.assignedToId
    : undefined
}

function formatSource(source?: Lead["source"]) {
  return source ? SOURCE_LABELS[source] : "Not set"
}

function formatUser(
  user?: Pick<AuthUser, "name" | "email"> | null,
  fallback = "Not available"
) {
  return user?.name || user?.email || fallback
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
