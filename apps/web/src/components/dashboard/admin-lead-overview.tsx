"use client"

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { Check, Loader2, Plus, RefreshCw, UserPlus, X } from "lucide-react"
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
import { getFriendlyApiError } from "@/lib/api"
import { getToken, type AuthUser, type OnboardingStatus } from "@/lib/auth"
import { formatLocalDate } from "@/lib/date"
import { getLeads, type Lead, type LeadStatus } from "@/lib/leads"
import {
  createPlot,
  createProject,
  getProjects,
  getRecentBookings,
  type Booking,
  type PlotStatus,
  type Project,
} from "@/lib/projects"
import {
  approveSalesExecutive,
  createSalesExecutive,
  getManagedSalesExecutives,
  getPendingOnboardingRequests,
  getSalesExecutives,
  rejectSalesExecutive,
} from "@/lib/users"
import { cn } from "@/lib/utils"

type AdminSummary = {
  total: number
  newThisWeek: number
  newThisMonth: number
  followUpsDue: number
  converted: number
  closed: number
  salesExecutives: number
  pendingApprovals: number
  totalProjects: number
  totalPlots: number
  availablePlots: number
  blockedPlots: number
  bookedPlots: number
  cancelledPlots: number
}

type PerformanceRow = {
  id: string
  name: string
  email: string
  total: number
  active: number
  converted: number
  lost: number
  conversionRate: number
}

type CreateSeForm = {
  seId: string
  email: string
  password: string
}

type CreateProjectForm = {
  projectName: string
  location: string
  description: string
  totalPlots: string
}

type CreatePlotForm = {
  plotNumber: string
  size: string
  facing: string
  price: string
  status: PlotStatus
}

type ManagedStatusFilter = "ALL" | OnboardingStatus

const ACTIVE_STATUSES: LeadStatus[] = [
  "FOLLOW_UP",
  "SITE_VISIT",
  "NEGOTIATION",
  "BLOCKED",
]

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  FOLLOW_UP: "Follow-up",
  SITE_VISIT: "Site Visit",
  NEGOTIATION: "Negotiation",
  BLOCKED: "Blocked",
  BOOKED: "Booked",
  CANCELLED: "Cancelled",
}

const SUMMARY_ITEMS: Array<{
  key: keyof AdminSummary
  label: string
  accent: string
}> = [
  { key: "total", label: "Total Leads", accent: "border-l-primary" },
  { key: "newThisWeek", label: "New This Week", accent: "border-l-sky-500" },
  { key: "newThisMonth", label: "New This Month", accent: "border-l-cyan-500" },
  { key: "followUpsDue", label: "Follow-ups Due", accent: "border-l-violet-500" },
  { key: "converted", label: "Booked Leads", accent: "border-l-emerald-500" },
  { key: "closed", label: "Cancelled Leads", accent: "border-l-rose-500" },
  {
    key: "salesExecutives",
    label: "Sales Executives",
    accent: "border-l-amber-500",
  },
  {
    key: "pendingApprovals",
    label: "Pending Approvals",
    accent: "border-l-orange-500",
  },
]

const PROJECT_SUMMARY_ITEMS: Array<{
  key: keyof AdminSummary
  label: string
  accent: string
}> = [
  { key: "totalProjects", label: "Total Projects", accent: "border-l-indigo-500" },
  { key: "totalPlots", label: "Total Plots", accent: "border-l-slate-500" },
  { key: "availablePlots", label: "Available Plots", accent: "border-l-teal-500" },
  { key: "blockedPlots", label: "Blocked Plots", accent: "border-l-amber-500" },
  { key: "bookedPlots", label: "Booked Plots", accent: "border-l-emerald-500" },
  { key: "cancelledPlots", label: "Cancelled Plots", accent: "border-l-rose-500" },
]

const initialCreateForm: CreateSeForm = {
  seId: "",
  email: "",
  password: "",
}

const initialProjectForm: CreateProjectForm = {
  projectName: "",
  location: "",
  description: "",
  totalPlots: "",
}

const initialPlotForm: CreatePlotForm = {
  plotNumber: "",
  size: "",
  facing: "",
  price: "",
  status: "AVAILABLE",
}

const PLOT_STATUS_OPTIONS: Array<{ value: PlotStatus; label: string }> = [
  { value: "AVAILABLE", label: "Available" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "BOOKED", label: "Booked" },
  { value: "CANCELLED", label: "Cancelled" },
]

const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  CREATED: "Created",
  PENDING_ADMIN_APPROVAL: "Pending approval",
  PROFILE_INCOMPLETE: "Profile incomplete",
  PASSWORD_CHANGE_REQUIRED: "Password change required",
  ACTIVE: "Active",
  REJECTED: "Rejected",
}

const MANAGED_STATUS_FILTER_OPTIONS: Array<{
  value: ManagedStatusFilter
  label: string
}> = [
  { value: "ALL", label: "All statuses" },
  { value: "CREATED", label: ONBOARDING_STATUS_LABELS.CREATED },
  {
    value: "PENDING_ADMIN_APPROVAL",
    label: ONBOARDING_STATUS_LABELS.PENDING_ADMIN_APPROVAL,
  },
  {
    value: "PROFILE_INCOMPLETE",
    label: ONBOARDING_STATUS_LABELS.PROFILE_INCOMPLETE,
  },
  {
    value: "PASSWORD_CHANGE_REQUIRED",
    label: ONBOARDING_STATUS_LABELS.PASSWORD_CHANGE_REQUIRED,
  },
  { value: "ACTIVE", label: ONBOARDING_STATUS_LABELS.ACTIVE },
  { value: "REJECTED", label: ONBOARDING_STATUS_LABELS.REJECTED },
]

const APPROVABLE_SE_STATUSES: OnboardingStatus[] = [
  "CREATED",
  "PENDING_ADMIN_APPROVAL",
  "REJECTED",
]

const REJECTABLE_SE_STATUSES: OnboardingStatus[] = [
  "CREATED",
  "PENDING_ADMIN_APPROVAL",
]

export function AdminLeadOverview() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [salesUsers, setSalesUsers] = useState<AuthUser[]>([])
  const [pendingUsers, setPendingUsers] = useState<AuthUser[]>([])
  const [managedUsers, setManagedUsers] = useState<AuthUser[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [recentBookings, setRecentBookings] = useState<Booking[]>([])
  const [createForm, setCreateForm] = useState<CreateSeForm>(initialCreateForm)
  const [managedStatusFilter, setManagedStatusFilter] =
    useState<ManagedStatusFilter>("ALL")
  const [projectForm, setProjectForm] =
    useState<CreateProjectForm>(initialProjectForm)
  const [plotForms, setPlotForms] = useState<Record<string, CreatePlotForm>>({})
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [projectSuccess, setProjectSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [creatingPlotProjectId, setCreatingPlotProjectId] = useState<
    string | null
  >(null)
  const [actionUserId, setActionUserId] = useState<string | null>(null)

  const summary = useMemo(
    () => deriveSummary(leads, salesUsers, pendingUsers, projects),
    [leads, salesUsers, pendingUsers, projects]
  )
  const performanceRows = useMemo(
    () => derivePerformance(leads, salesUsers),
    [leads, salesUsers]
  )
  const statusRows = useMemo(() => deriveStatusRows(leads), [leads])
  const leadsBySeRows = useMemo(
    () => deriveLeadsBySalesExecutive(leads, salesUsers),
    [leads, salesUsers]
  )

  const loadOverview = useCallback(async () => {
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
        leadData,
        salesData,
        pendingData,
        managedData,
        projectData,
        recentBookingData,
      ] = await Promise.all([
        getLeads(token),
        getSalesExecutives(token),
        getPendingOnboardingRequests(token),
        getManagedSalesExecutives(
          token,
          managedStatusFilter === "ALL" ? undefined : managedStatusFilter
        ),
        getProjects(token),
        getRecentBookings(token),
      ])
      setLeads(leadData)
      setSalesUsers(salesData)
      setPendingUsers(pendingData)
      setManagedUsers(managedData)
      setProjects(projectData)
      setRecentBookings(recentBookingData)
    } catch (err) {
      setError(getFriendlyApiError(err, "Unable to load admin dashboard"))
    } finally {
      setIsLoading(false)
    }
  }, [managedStatusFilter])

  useEffect(() => {
    void Promise.resolve().then(loadOverview)
  }, [loadOverview])

  async function handleCreateSalesExecutive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const token = getToken()

    if (!token) {
      setFormError("Your session has expired. Please log in again.")
      return
    }

    setIsCreating(true)
    setFormError(null)
    setFormSuccess(null)

    try {
      const user = await createSalesExecutive(token, createForm)
      setCreateForm(initialCreateForm)
      setFormSuccess(
        `${user.seId ?? user.email} created. Share the temporary password with the sales executive through an approved channel.`
      )
      await loadOverview()
    } catch (err) {
      setFormError(getFriendlyApiError(err, "Unable to create sales executive"))
    } finally {
      setIsCreating(false)
    }
  }

  async function handleApprove(userId: string) {
    const token = getToken()

    if (!token) {
      setError("Your session has expired. Please log in again.")
      return
    }

    setActionUserId(userId)
    setError(null)

    try {
      await approveSalesExecutive(token, userId)
      await loadOverview()
    } catch (err) {
      setError(getFriendlyApiError(err, "Unable to approve sales executive"))
    } finally {
      setActionUserId(null)
    }
  }

  async function handleReject(userId: string) {
    const token = getToken()

    if (!token) {
      setError("Your session has expired. Please log in again.")
      return
    }

    setActionUserId(userId)
    setError(null)

    try {
      await rejectSalesExecutive(token, userId)
      await loadOverview()
    } catch (err) {
      setError(getFriendlyApiError(err, "Unable to reject sales executive"))
    } finally {
      setActionUserId(null)
    }
  }

  function updateCreateForm<Key extends keyof CreateSeForm>(
    key: Key,
    value: CreateSeForm[Key]
  ) {
    setCreateForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function updateProjectForm<Key extends keyof CreateProjectForm>(
    key: Key,
    value: CreateProjectForm[Key]
  ) {
    setProjectForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function updatePlotForm<Key extends keyof CreatePlotForm>(
    projectId: string,
    key: Key,
    value: CreatePlotForm[Key]
  ) {
    setPlotForms((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] ?? initialPlotForm),
        [key]: value,
      },
    }))
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const token = getToken()

    if (!token) {
      setProjectError("Your session has expired. Please log in again.")
      return
    }

    setIsCreatingProject(true)
    setProjectError(null)
    setProjectSuccess(null)

    try {
      const project = await createProject(token, projectForm)
      setProjectForm(initialProjectForm)
      setProjectSuccess(`${project.projectName} created.`)
      await loadOverview()
    } catch (err) {
      setProjectError(getFriendlyApiError(err, "Unable to create project"))
    } finally {
      setIsCreatingProject(false)
    }
  }

  async function handleCreatePlot(
    event: FormEvent<HTMLFormElement>,
    projectId: string
  ) {
    event.preventDefault()

    const token = getToken()

    if (!token) {
      setProjectError("Your session has expired. Please log in again.")
      return
    }

    const plotForm = plotForms[projectId] ?? initialPlotForm
    setCreatingPlotProjectId(projectId)
    setProjectError(null)
    setProjectSuccess(null)

    try {
      const plot = await createPlot(token, projectId, plotForm)
      setPlotForms((current) => ({
        ...current,
        [projectId]: initialPlotForm,
      }))
      setProjectSuccess(`Plot ${plot.plotNumber} added.`)
      await loadOverview()
    } catch (err) {
      setProjectError(getFriendlyApiError(err, "Unable to add plot"))
    } finally {
      setCreatingPlotProjectId(null)
    }
  }

  if (isLoading) {
    return <AdminOverviewSkeleton />
  }

  if (error) {
    return (
      <Card className="rounded-lg border-destructive/30">
        <CardHeader>
          <CardTitle>Admin dashboard unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button type="button" variant="outline" onClick={loadOverview}>
            <RefreshCw className="size-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Lead analytics</h2>
          <p className="text-sm text-muted-foreground">
            Demo-ready snapshot across leads, follow-ups, conversions, and SEs.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadOverview}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_ITEMS.map((item) => (
          <SummaryCard
            key={item.key}
            label={item.label}
            value={summary[item.key]}
            accent={item.accent}
          />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {PROJECT_SUMMARY_ITEMS.map((item) => (
          <SummaryCard
            key={item.key}
            label={item.label}
            value={summary[item.key]}
            accent={item.accent}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Leads by status"
          emptyMessage="No leads found."
          rows={statusRows}
        />
        <ChartCard
          title="Leads by SE"
          emptyMessage="No assigned leads yet."
          rows={leadsBySeRows}
        />
      </div>

      {summary.followUpsDue === 0 ? (
        <EmptyState message="No follow-ups due." />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <ProjectManagementCard
          projects={projects}
          projectForm={projectForm}
          plotForms={plotForms}
          isCreatingProject={isCreatingProject}
          creatingPlotProjectId={creatingPlotProjectId}
          projectError={projectError}
          projectSuccess={projectSuccess}
          onCreateProject={handleCreateProject}
          onCreatePlot={handleCreatePlot}
          onProjectFormChange={updateProjectForm}
          onPlotFormChange={updatePlotForm}
        />
        <RecentBookingsCard bookings={recentBookings} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Create Sales Executive</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreateSalesExecutive}>
              <Field label="SE ID" htmlFor="seId">
                <Input
                  id="seId"
                  value={createForm.seId}
                  disabled={isCreating}
                  onChange={(event) =>
                    updateCreateForm("seId", event.target.value)
                  }
                  required
                />
              </Field>
              <Field label="Email" htmlFor="seEmail">
                <Input
                  id="seEmail"
                  type="email"
                  value={createForm.email}
                  disabled={isCreating}
                  onChange={(event) =>
                    updateCreateForm("email", event.target.value)
                  }
                  required
                />
              </Field>
              <Field label="Temporary password" htmlFor="sePassword">
                <Input
                  id="sePassword"
                  type="password"
                  autoComplete="new-password"
                  value={createForm.password}
                  disabled={isCreating}
                  minLength={12}
                  maxLength={128}
                  onChange={(event) =>
                    updateCreateForm("password", event.target.value)
                  }
                  required
                />
              </Field>
              {formError ? (
                <Alert tone="error" message={formError} />
              ) : formSuccess ? (
                <Alert tone="success" message={formSuccess} />
              ) : null}
              <Button
                type="submit"
                disabled={isCreating}
                aria-busy={isCreating}
              >
                {isCreating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                {isCreating ? "Creating..." : "Create SE"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Pending SE Onboarding Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingUsers.length === 0 ? (
              <EmptyState message="No pending SE onboarding requests." />
            ) : (
              <Table
                aria-label="Pending sales executive onboarding requests"
                className="min-w-[640px]"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>SE</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.seId ?? user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{formatStatus(user.onboardingStatus)}</TableCell>
                      <TableCell>{formatLocalDate(user.updatedAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={actionUserId === user.id}
                            aria-label={`Approve onboarding request for ${
                              user.seId ?? user.name
                            }`}
                            aria-busy={actionUserId === user.id}
                            onClick={() => handleApprove(user.id)}
                          >
                            <Check className="size-4" />
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={actionUserId === user.id}
                            aria-label={`Reject onboarding request for ${
                              user.seId ?? user.name
                            }`}
                            aria-busy={actionUserId === user.id}
                            onClick={() => handleReject(user.id)}
                          >
                            <X className="size-4" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <SalesExecutiveAccountsCard
        users={managedUsers}
        statusFilter={managedStatusFilter}
        actionUserId={actionUserId}
        onStatusFilterChange={setManagedStatusFilter}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <Card id="performance" className="rounded-lg scroll-mt-20">
        <CardHeader>
          <CardTitle>Sales Executive Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {performanceRows.length === 0 ? (
            <EmptyState message="No sales executives found yet." />
          ) : (
            <Table
              aria-label="Sales executive performance"
              className="min-w-[820px]"
            >
              <TableHeader>
                <TableRow>
                  <TableHead>SE name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Total assigned</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Converted</TableHead>
                  <TableHead className="text-right">Cancelled</TableHead>
                  <TableHead className="text-right">Conversion rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performanceRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell className="text-right">{row.total}</TableCell>
                    <TableCell className="text-right">{row.active}</TableCell>
                    <TableCell className="text-right">{row.converted}</TableCell>
                    <TableCell className="text-right">{row.lost}</TableCell>
                    <TableCell className="text-right">
                      {formatPercent(row.conversionRate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SalesExecutiveAccountsCard({
  users,
  statusFilter,
  actionUserId,
  onStatusFilterChange,
  onApprove,
  onReject,
}: {
  users: AuthUser[]
  statusFilter: ManagedStatusFilter
  actionUserId: string | null
  onStatusFilterChange: (value: ManagedStatusFilter) => void
  onApprove: (userId: string) => void
  onReject: (userId: string) => void
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Sales Executive Accounts</CardTitle>
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              onStatusFilterChange(value as ManagedStatusFilter)
            }
          >
            <SelectTrigger className="w-full sm:w-64" aria-label="SE status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MANAGED_STATUS_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <EmptyState message="No sales executive accounts found." />
        ) : (
          <Table
            aria-label="Sales executive accounts"
            className="min-w-[860px]"
          >
            <TableHeader>
              <TableRow>
                <TableHead>SE</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const status = user.onboardingStatus
                const canApprove = canApproveStatus(status)
                const canReject = canRejectStatus(status)

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.seId ?? "SE ID not set"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.username ?? "Not set"}</TableCell>
                    <TableCell>{formatStatus(status)}</TableCell>
                    <TableCell>{formatLocalDate(user.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canApprove ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={actionUserId === user.id}
                            aria-label={`${
                              status === "REJECTED" ? "Re-approve" : "Approve"
                            } sales executive ${user.name}`}
                            aria-busy={actionUserId === user.id}
                            onClick={() => onApprove(user.id)}
                          >
                            <Check className="size-4" />
                            {status === "REJECTED" ? "Re-approve" : "Approve"}
                          </Button>
                        ) : null}
                        {canReject ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={actionUserId === user.id}
                            aria-label={`Reject sales executive ${user.name}`}
                            aria-busy={actionUserId === user.id}
                            onClick={() => onReject(user.id)}
                          >
                            <X className="size-4" />
                            Reject
                          </Button>
                        ) : null}
                        {!canApprove && !canReject ? (
                          <span className="text-xs text-muted-foreground">
                            No action
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function ProjectManagementCard({
  projects,
  projectForm,
  plotForms,
  isCreatingProject,
  creatingPlotProjectId,
  projectError,
  projectSuccess,
  onCreateProject,
  onCreatePlot,
  onProjectFormChange,
  onPlotFormChange,
}: {
  projects: Project[]
  projectForm: CreateProjectForm
  plotForms: Record<string, CreatePlotForm>
  isCreatingProject: boolean
  creatingPlotProjectId: string | null
  projectError: string | null
  projectSuccess: string | null
  onCreateProject: (event: FormEvent<HTMLFormElement>) => void
  onCreatePlot: (
    event: FormEvent<HTMLFormElement>,
    projectId: string
  ) => void
  onProjectFormChange: <Key extends keyof CreateProjectForm>(
    key: Key,
    value: CreateProjectForm[Key]
  ) => void
  onPlotFormChange: <Key extends keyof CreatePlotForm>(
    projectId: string,
    key: Key,
    value: CreatePlotForm[Key]
  ) => void
}) {
  return (
    <Card id="projects" className="rounded-lg scroll-mt-20">
      <CardHeader>
        <CardTitle>Projects and Plots</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          className="grid gap-3 rounded-lg border p-3 md:grid-cols-2"
          onSubmit={onCreateProject}
        >
          <Field label="Project name" htmlFor="projectName">
            <Input
              id="projectName"
              value={projectForm.projectName}
              disabled={isCreatingProject}
              onChange={(event) =>
                onProjectFormChange("projectName", event.target.value)
              }
              required
            />
          </Field>
          <Field label="Location" htmlFor="projectLocation">
            <Input
              id="projectLocation"
              value={projectForm.location}
              disabled={isCreatingProject}
              onChange={(event) =>
                onProjectFormChange("location", event.target.value)
              }
              required
            />
          </Field>
          <Field label="Description" htmlFor="projectDescription">
            <Textarea
              id="projectDescription"
              value={projectForm.description}
              disabled={isCreatingProject}
              className="min-h-20"
              onChange={(event) =>
                onProjectFormChange("description", event.target.value)
              }
            />
          </Field>
          <div className="space-y-3">
            <Field label="Total plots" htmlFor="totalPlots">
              <Input
                id="totalPlots"
                type="number"
                min="0"
                value={projectForm.totalPlots}
                disabled={isCreatingProject}
                onChange={(event) =>
                  onProjectFormChange("totalPlots", event.target.value)
                }
              />
            </Field>
            <Button
              type="submit"
              disabled={isCreatingProject}
              aria-busy={isCreatingProject}
            >
              {isCreatingProject ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {isCreatingProject ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>

        {projectError ? (
          <Alert tone="error" message={projectError} />
        ) : projectSuccess ? (
          <Alert tone="success" message={projectSuccess} />
        ) : null}

        {projects.length === 0 ? (
          <EmptyState message="No projects found. Create a project to add plots." />
        ) : (
          <div className="space-y-4">
            {projects.map((project) => {
              const plotForm = plotForms[project.id] ?? initialPlotForm
              const isAddingPlot = creatingPlotProjectId === project.id

              return (
                <div key={project.id} className="rounded-lg border p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">{project.projectName}</p>
                      <p className="text-sm text-muted-foreground">
                        {project.location}
                      </p>
                      {project.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {project.description}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {project.plots?.length ?? 0}
                      {project.totalPlots ? ` / ${project.totalPlots}` : ""} plots
                    </p>
                  </div>

                  <form
                    className="mt-3 grid gap-2 md:grid-cols-6"
                    onSubmit={(event) => onCreatePlot(event, project.id)}
                  >
                    <Input
                      value={plotForm.plotNumber}
                      disabled={isAddingPlot}
                      placeholder="Plot number"
                      aria-label={`Plot number for ${project.projectName}`}
                      onChange={(event) =>
                        onPlotFormChange(
                          project.id,
                          "plotNumber",
                          event.target.value
                        )
                      }
                      required
                    />
                    <Input
                      value={plotForm.size}
                      disabled={isAddingPlot}
                      placeholder="Size"
                      aria-label={`Plot size for ${project.projectName}`}
                      onChange={(event) =>
                        onPlotFormChange(project.id, "size", event.target.value)
                      }
                    />
                    <Input
                      value={plotForm.facing}
                      disabled={isAddingPlot}
                      placeholder="Facing"
                      aria-label={`Plot facing for ${project.projectName}`}
                      onChange={(event) =>
                        onPlotFormChange(
                          project.id,
                          "facing",
                          event.target.value
                        )
                      }
                    />
                    <Input
                      type="number"
                      min="0"
                      value={plotForm.price}
                      disabled={isAddingPlot}
                      placeholder="Price"
                      aria-label={`Plot price for ${project.projectName}`}
                      onChange={(event) =>
                        onPlotFormChange(project.id, "price", event.target.value)
                      }
                    />
                    <Select
                      value={plotForm.status}
                      disabled={isAddingPlot}
                      onValueChange={(value) =>
                        onPlotFormChange(
                          project.id,
                          "status",
                          value as PlotStatus
                        )
                      }
                    >
                      <SelectTrigger
                        aria-label={`Plot status for ${project.projectName}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLOT_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={isAddingPlot}
                      aria-busy={isAddingPlot}
                    >
                      {isAddingPlot ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Plus className="size-4" />
                      )}
                      Add Plot
                    </Button>
                  </form>

                  <div className="mt-3">
                    {project.plots?.length ? (
                      <Table
                        aria-label={`${project.projectName} plots`}
                        className="min-w-[640px]"
                      >
                        <TableHeader>
                          <TableRow>
                            <TableHead>Plot</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Facing</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {project.plots.map((plot) => (
                            <TableRow key={plot.id}>
                              <TableCell className="font-medium">
                                {plot.plotNumber}
                              </TableCell>
                              <TableCell>{plot.size || "Not set"}</TableCell>
                              <TableCell>{plot.facing || "Not set"}</TableCell>
                              <TableCell>{formatCurrency(plot.price)}</TableCell>
                              <TableCell>{formatPlotStatus(plot.status)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <EmptyState message="No plots added under this project." />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RecentBookingsCard({ bookings }: { bookings: Booking[] }) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>Recent Bookings / Blocks</CardTitle>
      </CardHeader>
      <CardContent>
        {bookings.length === 0 ? (
          <EmptyState message="No bookings or blocks yet." />
        ) : (
          <Table
            aria-label="Recent bookings and plot blocks"
            className="min-w-[640px]"
          >
            <TableHeader>
              <TableRow>
                <TableHead>SE</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Project / plot</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>{booking.salesExecutive?.name ?? "SE"}</TableCell>
                  <TableCell>{booking.lead?.fullName ?? "Lead"}</TableCell>
                  <TableCell>
                    <div>
                      <p>{booking.project?.projectName ?? "Project"}</p>
                      <p className="text-xs text-muted-foreground">
                        Plot {booking.plot?.plotNumber ?? "not set"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{formatPlotStatus(booking.type)}</TableCell>
                  <TableCell>{formatCurrency(booking.amountPaid)}</TableCell>
                  <TableCell>{formatLocalDate(booking.bookingDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function deriveSummary(
  leads: Lead[],
  salesUsers: AuthUser[],
  pendingUsers: AuthUser[],
  projects: Project[]
): AdminSummary {
  const plots = projects.flatMap((project) => project.plots ?? [])

  return {
    total: leads.length,
    newThisWeek: leads.filter((lead) =>
      isDateAfter(lead.createdAt, startOfWeek())
    ).length,
    newThisMonth: leads.filter((lead) =>
      isDateAfter(lead.createdAt, startOfMonth())
    ).length,
    followUpsDue: leads.filter(isFollowUpDue).length,
    converted: leads.filter((lead) => lead.status === "BOOKED").length,
    closed: leads.filter((lead) => lead.status === "CANCELLED").length,
    salesExecutives: salesUsers.length,
    pendingApprovals: pendingUsers.length,
    totalProjects: projects.length,
    totalPlots: plots.length,
    availablePlots: plots.filter((plot) => plot.status === "AVAILABLE").length,
    blockedPlots: plots.filter((plot) => plot.status === "BLOCKED").length,
    bookedPlots: plots.filter((plot) => plot.status === "BOOKED").length,
    cancelledPlots: plots.filter((plot) => plot.status === "CANCELLED").length,
  }
}

function derivePerformance(
  leads: Lead[],
  salesUsers: AuthUser[]
): PerformanceRow[] {
  return salesUsers.map((user) => {
    const assignedLeads = leads.filter(
      (lead) => getAssignedUserId(lead) === user.id
    )
    const converted = assignedLeads.filter((lead) => lead.status === "BOOKED")
      .length

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      total: assignedLeads.length,
      active: assignedLeads.filter(isActiveLead).length,
      converted,
      lost: assignedLeads.filter((lead) => lead.status === "CANCELLED").length,
      conversionRate:
        assignedLeads.length === 0 ? 0 : (converted / assignedLeads.length) * 100,
    }
  })
}

function deriveStatusRows(leads: Lead[]) {
  const statuses: LeadStatus[] = [
    "NEW",
    "FOLLOW_UP",
    "SITE_VISIT",
    "NEGOTIATION",
    "BLOCKED",
    "BOOKED",
    "CANCELLED",
  ]

  return statuses.map((status) => ({
    label: STATUS_LABELS[status],
    value: leads.filter((lead) => lead.status === status).length,
  }))
}

function deriveLeadsBySalesExecutive(leads: Lead[], salesUsers: AuthUser[]) {
  return salesUsers.map((user) => ({
    label: user.name,
    value: leads.filter((lead) => getAssignedUserId(lead) === user.id).length,
  }))
}

function getAssignedUserId(lead: Lead) {
  return lead.assignedToId ?? lead.assignedTo?.id ?? null
}

function isActiveLead(lead: Lead) {
  return ACTIVE_STATUSES.includes(lead.status)
}

function isFollowUpDue(lead: Lead) {
  if (
    !lead.followUpDate ||
    lead.status === "BOOKED" ||
    lead.status === "CANCELLED"
  ) {
    return false
  }

  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  return new Date(lead.followUpDate) <= todayEnd
}

function startOfWeek() {
  const date = new Date()
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfMonth() {
  const date = new Date()
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date
}

function isDateAfter(value: string, date: Date) {
  return new Date(value) >= date
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(value)}%`
}

function formatCurrency(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "Not set"
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

function formatPlotStatus(status?: PlotStatus | Booking["type"] | null) {
  return (
    PLOT_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    "Not set"
  )
}

function formatStatus(status?: AuthUser["onboardingStatus"]) {
  return status ? ONBOARDING_STATUS_LABELS[status] : "Not set"
}

function canApproveStatus(status?: OnboardingStatus) {
  return status ? APPROVABLE_SE_STATUSES.includes(status) : false
}

function canRejectStatus(status?: OnboardingStatus) {
  return status ? REJECTABLE_SE_STATUSES.includes(status) : false
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  return (
    <Card className={cn("rounded-lg border-l-4", accent)}>
      <CardContent className="py-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-normal">{value}</p>
      </CardContent>
    </Card>
  )
}

function ChartCard({
  title,
  rows,
  emptyMessage,
}: {
  title: string
  rows: Array<{ label: string; value: number }>
  emptyMessage: string
}) {
  const maxValue = Math.max(1, ...rows.map((row) => row.value))
  const hasData = rows.some((row) => row.value > 0)

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.label} className="grid gap-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-muted-foreground">
                    {row.label}
                  </span>
                  <span className="font-medium">{row.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.max(4, (row.value / maxValue) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AdminOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="rounded-lg">
            <CardContent className="space-y-3 py-0">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="rounded-lg">
            <CardContent className="space-y-3 py-0">
              {Array.from({ length: 5 }).map((__, rowIndex) => (
                <Skeleton key={rowIndex} className="h-8 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
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

function Alert({
  tone,
  message,
}: {
  tone: "error" | "success"
  message: string
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      {message}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
    >
      {message}
    </div>
  )
}
