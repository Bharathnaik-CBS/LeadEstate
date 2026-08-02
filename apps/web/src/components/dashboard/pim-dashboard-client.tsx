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
  Blocks,
  Building2,
  LayoutDashboard,
  Loader2,
  Map,
  RefreshCw,
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
import { Textarea } from "@/components/ui/textarea"
import { getFriendlyApiError } from "@/lib/api"
import { getToken } from "@/lib/auth"
import { formatLocalDateTime } from "@/lib/date"
import {
  createPlot,
  createProject,
  getPlotBlocks,
  getPlotPriceHistory,
  getProjectLayout,
  getProjects,
  updatePlot,
  updatePlotPrice,
  updatePlotStatus,
  updateProjectLayout,
  updateProject,
  type CreatePlotInput,
  type Plot,
  type PlotBlock,
  type PlotPriceHistory,
  type PlotStatus,
  type Project,
  type UpdatePlotInput,
} from "@/lib/projects"

const PLOT_STATUSES: PlotStatus[] = [
  "AVAILABLE",
  "BLOCKED",
  "BOOKED",
  "SOLD",
  "CANCELLED",
]

type PlotFormState = {
  plotNumber: string
  size: string
  facing: string
  price: string
  status: PlotStatus
}

type PimDashboardView = "overview" | "projects" | "plots" | "blocks"

const initialPlotForm: PlotFormState = {
  plotNumber: "",
  size: "",
  facing: "",
  price: "",
  status: "AVAILABLE",
}

export function PimDashboardClient({
  view = "overview",
}: {
  view?: PimDashboardView
}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [selectedPlotId, setSelectedPlotId] = useState("")
  const [plotForm, setPlotForm] = useState<PlotFormState>(initialPlotForm)
  const [statusValue, setStatusValue] = useState<PlotStatus>("AVAILABLE")
  const [priceValue, setPriceValue] = useState("")
  const [priceReason, setPriceReason] = useState("")
  const [layoutText, setLayoutText] = useState("{\n  \"plots\": []\n}")
  const [plotBlocks, setPlotBlocks] = useState<PlotBlock[]>([])
  const [priceHistory, setPriceHistory] = useState<PlotPriceHistory[]>([])
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBlocksLoading, setIsBlocksLoading] = useState(false)
  const [isPriceHistoryLoading, setIsPriceHistoryLoading] = useState(false)
  const [isLayoutLoading, setIsLayoutLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )
  const plots = useMemo(() => selectedProject?.plots ?? [], [selectedProject])
  const selectedPlot =
    plots.find((plot) => plot.id === selectedPlotId) ?? plots[0] ?? null
  const selectedPlotStatusValue = selectedPlotId
    ? statusValue
    : selectedPlot?.status ?? statusValue
  const selectedPlotIdForDetails = selectedPlot?.id ?? ""
  const summary = useMemo(() => createInventorySummary(projects), [projects])
  const showOverview = view === "overview"
  const showProjectWorkflows = view === "projects"
  const showPlotWorkflows = view === "plots"
  const showBlockWorkflows = view === "blocks"

  const loadProjects = useCallback(async () => {
    const token = getToken()

    if (!token) {
      setError("Your session has expired. Please log in again.")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const projectData = await getProjects(token)
      setProjects(projectData)
      setSelectedProjectId((current) =>
        current && projectData.some((project) => project.id === current)
          ? current
          : projectData[0]?.id ?? ""
      )
    } catch (err) {
      setError(getFriendlyApiError(err, "Unable to load inventory"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadBlocks = useCallback(async () => {
    const token = getToken()

    if (!token || !selectedProjectId || !selectedPlotIdForDetails) {
      setPlotBlocks([])
      return
    }

    setIsBlocksLoading(true)

    try {
      setPlotBlocks(
        await getPlotBlocks(token, selectedProjectId, selectedPlotIdForDetails)
      )
    } catch {
      setPlotBlocks([])
    } finally {
      setIsBlocksLoading(false)
    }
  }, [selectedPlotIdForDetails, selectedProjectId])

  const loadPriceHistory = useCallback(async () => {
    const token = getToken()

    if (!token || !selectedProjectId || !selectedPlotIdForDetails) {
      setPriceHistory([])
      return
    }

    setIsPriceHistoryLoading(true)

    try {
      setPriceHistory(
        await getPlotPriceHistory(
          token,
          selectedProjectId,
          selectedPlotIdForDetails
        )
      )
    } catch {
      setPriceHistory([])
    } finally {
      setIsPriceHistoryLoading(false)
    }
  }, [selectedPlotIdForDetails, selectedProjectId])

  const loadLayout = useCallback(async () => {
    const token = getToken()

    if (!token || !selectedProjectId || !showPlotWorkflows) {
      return
    }

    setIsLayoutLoading(true)

    try {
      const layout = await getProjectLayout(token, selectedProjectId)
      setLayoutText(JSON.stringify(layout, null, 2))
    } catch {
      setLayoutText("{\n  \"plots\": []\n}")
    } finally {
      setIsLayoutLoading(false)
    }
  }, [selectedProjectId, showPlotWorkflows])

  useEffect(() => {
    void Promise.resolve().then(loadProjects)
  }, [loadProjects])

  useEffect(() => {
    void Promise.resolve().then(loadBlocks)
    void Promise.resolve().then(loadPriceHistory)
  }, [loadBlocks, loadPriceHistory])

  useEffect(() => {
    void Promise.resolve().then(loadLayout)
  }, [loadLayout])

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const projectName = getFormValue(formData, "projectName")
    const location = getFormValue(formData, "location")

    if (!projectName || !location) {
      setError("Project name and location are required.")
      return
    }

    await runAction(async (token) => {
      const project = await createProject(token, {
        projectName,
        location,
        description: getFormValue(formData, "description"),
        totalPlots: getFormValue(formData, "totalPlots"),
      })
      setSelectedProjectId(project.id)
      form.reset()
      setActionMessage("Project added.")
      await loadProjects()
    })
  }

  async function handleUpdateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedProject) {
      setError("Select a project to update.")
      return
    }

    const formData = new FormData(event.currentTarget)

    await runAction(async (token) => {
      await updateProject(token, selectedProject.id, {
        projectName: getFormValue(formData, "projectName"),
        location: getFormValue(formData, "location"),
        description: getFormValue(formData, "description"),
        totalPlots: getFormValue(formData, "totalPlots"),
      })
      setActionMessage("Project updated.")
      await loadProjects()
    })
  }

  async function handleCreatePlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedProjectId) {
      setError("Select or create a project before adding plots.")
      return
    }

    if (!plotForm.plotNumber.trim()) {
      setError("Plot number is required.")
      return
    }

    await runAction(async (token) => {
      const input: CreatePlotInput = {
        plotNumber: plotForm.plotNumber,
        size: plotForm.size,
        facing: plotForm.facing,
        price: plotForm.price,
        status: plotForm.status,
      }
      const plot = await createPlot(token, selectedProjectId, input)
      setSelectedPlotId(plot.id)
      setPlotForm(initialPlotForm)
      setActionMessage("Plot added.")
      await loadProjects()
    })
  }

  async function handleUpdateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedProjectId || !selectedPlot) {
      setError("Select a project and plot first.")
      return
    }

    await runAction(async (token) => {
      await updatePlotStatus(token, selectedProjectId, selectedPlot.id, {
        status: selectedPlotStatusValue,
      })
      setActionMessage("Plot status updated.")
      await loadProjects()
    })
  }

  async function handleUpdatePlot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedProjectId || !selectedPlot) {
      setError("Select a project and plot first.")
      return
    }

    const formData = new FormData(event.currentTarget)
    const plotNumber = getFormValue(formData, "plotNumber")

    if (!plotNumber) {
      setError("Plot number is required.")
      return
    }

    await runAction(async (token) => {
      const input: UpdatePlotInput = {
        plotNumber,
        size: getFormValue(formData, "size"),
        facing: getFormValue(formData, "facing"),
      }
      await updatePlot(token, selectedProjectId, selectedPlot.id, input)
      setActionMessage("Plot details updated.")
      await loadProjects()
    })
  }

  async function handleUpdatePrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedProjectId || !selectedPlot) {
      setError("Select a project and plot first.")
      return
    }

    if (!priceValue.trim()) {
      setError("New price is required.")
      return
    }

    const nextPrice = Number(priceValue)
    const currentPrice = Number(selectedPlot.price ?? 0)

    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      setError("New price must be a positive value.")
      return
    }

    if (
      currentPrice > 0 &&
      Math.abs(nextPrice - currentPrice) / currentPrice >= 0.1
    ) {
      const confirmed = window.confirm(
        "This changes the plot price by 10% or more. Continue?"
      )

      if (!confirmed) {
        return
      }
    }

    await runAction(async (token) => {
      await updatePlotPrice(token, selectedProjectId, selectedPlot.id, {
        newPrice: priceValue,
        reason: priceReason,
      })
      setPriceValue("")
      setPriceReason("")
      setActionMessage("Plot price updated.")
      await loadProjects()
      await loadPriceHistory()
    })
  }

  async function handleUpdateLayout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedProjectId) {
      setError("Select a project before saving layout JSON.")
      return
    }

    let parsedLayout: Record<string, unknown> | unknown[]

    try {
      const parsed = JSON.parse(layoutText) as unknown

      if (
        parsed === null ||
        (typeof parsed !== "object" && !Array.isArray(parsed))
      ) {
        setError("Layout JSON must be an object or array.")
        return
      }

      parsedLayout = parsed as Record<string, unknown> | unknown[]
    } catch {
      setError("Enter valid layout JSON before saving.")
      return
    }

    await runAction(async (token) => {
      const savedLayout = await updateProjectLayout(
        token,
        selectedProjectId,
        parsedLayout
      )
      setLayoutText(JSON.stringify(savedLayout, null, 2))
      setActionMessage("Project layout saved.")
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
      setError(getFriendlyApiError(err, "Unable to complete inventory action"))
    } finally {
      setIsSubmitting(false)
    }
  }

  function updatePlotForm<Key extends keyof PlotFormState>(
    key: Key,
    value: PlotFormState[Key]
  ) {
    setPlotForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  if (isLoading) {
    return (
      <DashboardLoading
        title="Loading PIM dashboard"
        description="Preparing project and plot inventory."
        rows={6}
        sections={3}
      />
    )
  }

  if (error && projects.length === 0) {
    return (
      <DashboardError
        title="PIM dashboard unavailable"
        message={error}
        onRetry={loadProjects}
      />
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4" aria-labelledby="pim-summary-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="pim-summary-heading" className="text-base font-semibold">
              Inventory summary
            </h2>
            <p className="text-sm text-muted-foreground">
              Projects, plots, and live inventory status.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={loadProjects}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <DashboardMetricCard
            label="Projects"
            value={summary.projects}
            description="Projects in CRM"
            icon={Building2}
          />
          <DashboardMetricCard
            label="Plots"
            value={summary.plots}
            description="Total mapped plots"
            icon={Map}
            accent="border-l-sky-500"
          />
          <DashboardMetricCard
            label="Available"
            value={summary.available}
            description="Ready for blocking"
            icon={LayoutDashboard}
            accent="border-l-emerald-500"
          />
          <DashboardMetricCard
            label="Blocked"
            value={summary.blocked}
            description="Temporarily reserved"
            icon={Blocks}
            accent="border-l-amber-500"
          />
          <DashboardMetricCard
            label="Booked / Sold"
            value={summary.bookedSold}
            description="Committed inventory"
            icon={LayoutDashboard}
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
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Project inventory focus</CardTitle>
              <CardDescription>
                Active projects with mapped plot availability.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <EmptyPanel message="No projects are available yet." />
              ) : (
                <div className="grid gap-3">
                  {projects.slice(0, 5).map((project) => {
                    const projectPlots = project.plots ?? []
                    const available = countByStatus(projectPlots, "AVAILABLE")
                    const committed =
                      countByStatus(projectPlots, "BOOKED") +
                      countByStatus(projectPlots, "SOLD")

                    return (
                      <div
                        key={project.id}
                        className="grid gap-3 rounded-lg border bg-background p-4 sm:grid-cols-[1fr_auto]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {project.projectName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {project.location}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="rounded-md">
                            {projectPlots.length} plots
                          </Badge>
                          <Badge variant="outline" className="rounded-md">
                            {available} available
                          </Badge>
                          <Badge variant="outline" className="rounded-md">
                            {committed} booked/sold
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Selected plot snapshot</CardTitle>
              <CardDescription>
                Fast read on the currently selected project and plot.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedProject && selectedPlot ? (
                <div className="space-y-4">
                  <ProjectSelector
                    projects={projects}
                    selectedProjectId={selectedProjectId}
                    onChange={setSelectedProjectId}
                  />
                  <div className="rounded-lg border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          Plot {selectedPlot.plotNumber}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedPlot.size ?? "Size not set"} -{" "}
                          {selectedPlot.facing ?? "Facing not set"}
                        </p>
                      </div>
                      <StatusBadge status={selectedPlot.status} />
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Price: {formatPrice(selectedPlot.price)}
                    </p>
                  </div>
                </div>
              ) : (
                <EmptyPanel message="Create a project and plot to see inventory focus." />
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {showProjectWorkflows ? (
      <section className="grid gap-4 xl:grid-cols-2" id="projects">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Add project</CardTitle>
            <CardDescription>Create project inventory records.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={handleCreateProject}>
              <Field label="Project name" htmlFor="projectName">
                <Input id="projectName" name="projectName" disabled={isSubmitting} />
              </Field>
              <Field label="Location" htmlFor="location">
                <Input id="location" name="location" disabled={isSubmitting} />
              </Field>
              <Field label="Description" htmlFor="description">
                <Input id="description" name="description" disabled={isSubmitting} />
              </Field>
              <Field label="Total plots" htmlFor="totalPlots">
                <Input
                  id="totalPlots"
                  name="totalPlots"
                  type="number"
                  min="0"
                  disabled={isSubmitting}
                />
              </Field>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Add project
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Manage selected project</CardTitle>
            <CardDescription>Update project name, location, and notes.</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedProject ? (
              <form
                key={selectedProject.id}
                className="grid gap-3"
                onSubmit={handleUpdateProject}
              >
                <ProjectSelector
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  onChange={setSelectedProjectId}
                />
                <Field label="Project name" htmlFor="editProjectName">
                  <Input
                    id="editProjectName"
                    name="projectName"
                    defaultValue={selectedProject.projectName}
                    disabled={isSubmitting}
                  />
                </Field>
                <Field label="Location" htmlFor="editLocation">
                  <Input
                    id="editLocation"
                    name="location"
                    defaultValue={selectedProject.location}
                    disabled={isSubmitting}
                  />
                </Field>
                <Field label="Description" htmlFor="editDescription">
                  <Input
                    id="editDescription"
                    name="description"
                    defaultValue={selectedProject.description ?? ""}
                    disabled={isSubmitting}
                  />
                </Field>
                <Field label="Total plots" htmlFor="editTotalPlots">
                  <Input
                    id="editTotalPlots"
                    name="totalPlots"
                    type="number"
                    min="0"
                    defaultValue={selectedProject.totalPlots ?? ""}
                    disabled={isSubmitting}
                  />
                </Field>
                <Button type="submit" variant="outline" disabled={isSubmitting}>
                  Update project
                </Button>
              </form>
            ) : (
              <EmptyPanel message="Create a project to enable project updates." />
            )}
          </CardContent>
        </Card>
      </section>
      ) : null}

      {showPlotWorkflows ? (
      <>
      <section className="grid gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <Card className="rounded-lg" id="plots">
          <CardHeader>
            <CardTitle>Add plot</CardTitle>
            <CardDescription>
              Add plot inventory under the selected project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedProject ? (
              <form className="grid gap-3" onSubmit={handleCreatePlot}>
                <ProjectSelector
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  onChange={setSelectedProjectId}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Plot number" htmlFor="plotNumber">
                    <Input
                      id="plotNumber"
                      value={plotForm.plotNumber}
                      disabled={isSubmitting}
                      onChange={(event) =>
                        updatePlotForm("plotNumber", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Size / area" htmlFor="plotSize">
                    <Input
                      id="plotSize"
                      value={plotForm.size}
                      disabled={isSubmitting}
                      onChange={(event) =>
                        updatePlotForm("size", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Facing" htmlFor="plotFacing">
                    <Input
                      id="plotFacing"
                      value={plotForm.facing}
                      disabled={isSubmitting}
                      onChange={(event) =>
                        updatePlotForm("facing", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Price" htmlFor="plotPrice">
                    <Input
                      id="plotPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={plotForm.price}
                      disabled={isSubmitting}
                      onChange={(event) =>
                        updatePlotForm("price", event.target.value)
                      }
                    />
                  </Field>
                </div>
                <Field label="Status" htmlFor="plotStatus">
                  <Select
                    value={plotForm.status}
                    disabled={isSubmitting}
                    onValueChange={(value) =>
                      updatePlotForm("status", value as PlotStatus)
                    }
                  >
                    <SelectTrigger id="plotStatus" className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLOT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {toTitleLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Button type="submit" disabled={isSubmitting}>
                  Add plot
                </Button>
              </form>
            ) : (
              <EmptyPanel message="Create a project before adding plots." />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>{selectedProject?.projectName ?? "Plots"}</CardTitle>
            <CardDescription>
              Select a plot to update status, price, and history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {plots.length === 0 ? (
              <EmptyPanel message="No plots are mapped for this project yet." />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <div className="grid grid-cols-[0.8fr_0.85fr_0.85fr_0.85fr_0.9fr] gap-3 bg-muted/60 px-4 py-3 text-xs font-medium text-muted-foreground">
                  <span>Plot</span>
                  <span>Status</span>
                  <span>Size</span>
                  <span>Facing</span>
                  <span>Price</span>
                </div>
                <div className="divide-y">
                  {plots.map((plot) => (
                    <button
                      key={plot.id}
                      type="button"
                      className={`grid w-full grid-cols-[0.8fr_0.85fr_0.85fr_0.85fr_0.9fr] gap-3 px-4 py-3 text-left text-sm ${
                        plot.id === selectedPlot?.id
                          ? "bg-primary/5"
                          : "hover:bg-muted/40"
                      }`}
                      onClick={() => {
                        setSelectedPlotId(plot.id)
                        setStatusValue(plot.status)
                      }}
                    >
                      <span className="font-medium">{plot.plotNumber}</span>
                      <StatusBadge status={plot.status} />
                      <span>{plot.size ?? "-"}</span>
                      <span>{plot.facing ?? "-"}</span>
                      <span>{formatPrice(plot.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Edit plot details</CardTitle>
            <CardDescription>
              Update plot number, size, and facing using the plot update API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedPlot ? (
              <form
                key={selectedPlot.id}
                className="grid gap-3"
                onSubmit={handleUpdatePlot}
              >
                <PlotSelector
                  plots={plots}
                  selectedPlot={selectedPlot}
                  onChange={setSelectedPlotId}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Plot number" htmlFor="editPlotNumber">
                    <Input
                      id="editPlotNumber"
                      name="plotNumber"
                      defaultValue={selectedPlot.plotNumber}
                      disabled={isSubmitting}
                    />
                  </Field>
                  <Field label="Size / area" htmlFor="editPlotSize">
                    <Input
                      id="editPlotSize"
                      name="size"
                      defaultValue={selectedPlot.size ?? ""}
                      disabled={isSubmitting}
                    />
                  </Field>
                  <Field label="Facing" htmlFor="editPlotFacing">
                    <Input
                      id="editPlotFacing"
                      name="facing"
                      defaultValue={selectedPlot.facing ?? ""}
                      disabled={isSubmitting}
                    />
                  </Field>
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Save plot details
                </Button>
              </form>
            ) : (
              <EmptyPanel message="Select a plot to edit details." />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Update plot status</CardTitle>
            <CardDescription>Use exact inventory status values.</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedPlot ? (
              <form className="grid gap-3" onSubmit={handleUpdateStatus}>
                <PlotSelector
                  plots={plots}
                  selectedPlot={selectedPlot}
                  onChange={(plotId) => {
                    const plot = plots.find((item) => item.id === plotId)
                    setSelectedPlotId(plotId)
                    setStatusValue(plot?.status ?? "AVAILABLE")
                  }}
                />
                <Field label="Status" htmlFor="statusValue">
                  <Select
                    value={selectedPlotStatusValue}
                    disabled={isSubmitting}
                    onValueChange={(value) => setStatusValue(value as PlotStatus)}
                  >
                    <SelectTrigger id="statusValue" className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLOT_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {toTitleLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Button type="submit" disabled={isSubmitting}>
                  Update status
                </Button>
              </form>
            ) : (
              <EmptyPanel message="Select a plot to update status." />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg" id="layout">
          <CardHeader>
            <CardTitle>Project layout JSON</CardTitle>
            <CardDescription>
              Store structured layout coordinates or metadata for the selected project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedProject ? (
              <form className="grid gap-3" onSubmit={handleUpdateLayout}>
                <ProjectSelector
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  onChange={setSelectedProjectId}
                />
                <Field label="Layout JSON" htmlFor="layoutJson">
                  <Textarea
                    id="layoutJson"
                    value={layoutText}
                    disabled={isSubmitting || isLayoutLoading}
                    className="min-h-48 font-mono text-sm"
                    spellCheck={false}
                    onChange={(event) => setLayoutText(event.target.value)}
                  />
                </Field>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={isSubmitting || isLayoutLoading}
                >
                  {isLayoutLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Save layout
                </Button>
              </form>
            ) : (
              <EmptyPanel message="Create a project to save layout data." />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg" id="price-history">
          <CardHeader>
            <CardTitle>Price update and history</CardTitle>
            <CardDescription>
              Update plot price and review recent price changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedPlot ? (
              <>
                <form className="grid gap-3" onSubmit={handleUpdatePrice}>
                  <PlotSelector
                    plots={plots}
                    selectedPlot={selectedPlot}
                    onChange={setSelectedPlotId}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="New price" htmlFor="newPrice">
                      <Input
                        id="newPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceValue}
                        disabled={isSubmitting}
                        onChange={(event) => setPriceValue(event.target.value)}
                      />
                    </Field>
                    <Field label="Reason" htmlFor="priceReason">
                      <Input
                        id="priceReason"
                        value={priceReason}
                        disabled={isSubmitting}
                        onChange={(event) => setPriceReason(event.target.value)}
                      />
                    </Field>
                  </div>
                  <Button type="submit" variant="outline" disabled={isSubmitting}>
                    Update price
                  </Button>
                </form>

                {isPriceHistoryLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading price history...
                  </p>
                ) : priceHistory.length === 0 ? (
                  <EmptyPanel message="No price history for this plot yet." />
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <div className="grid grid-cols-[0.8fr_0.8fr_0.9fr_0.9fr_1fr] gap-3 bg-muted/60 px-4 py-3 text-xs font-medium text-muted-foreground">
                      <span>Old</span>
                      <span>New</span>
                      <span>Changed</span>
                      <span>Changed by</span>
                      <span>Reason</span>
                    </div>
                    <div className="divide-y">
                      {priceHistory.slice(0, 5).map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-[0.8fr_0.8fr_0.9fr_0.9fr_1fr] gap-3 px-4 py-3 text-sm"
                        >
                          <span>{formatPrice(item.oldPrice)}</span>
                          <span className="font-medium">
                            {formatPrice(item.newPrice)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatLocalDateTime(item.createdAt)}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {item.changedById ?? "Not set"}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate">
                              {item.reason ?? "No reason"}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyPanel message="Select a plot to update price." />
            )}
          </CardContent>
        </Card>
      </section>
      </>
      ) : null}

      {showBlockWorkflows ? (
      <Card className="rounded-lg" id="blocks">
        <CardHeader>
          <CardTitle>
            Blocks and bookings
            {selectedPlot ? ` - Plot ${selectedPlot.plotNumber}` : ""}
          </CardTitle>
          <CardDescription>
            Recent block lifecycle for the selected plot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isBlocksLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading block history...
            </div>
          ) : plotBlocks.length === 0 ? (
            <EmptyPanel message="No blocks or converted bookings for this plot yet." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {plotBlocks.map((block) => (
                <div key={block.id} className="rounded-lg border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {block.customer?.fullName ?? "Customer"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatLocalDateTime(block.blockedAt)}
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded-md">
                      {toTitleLabel(block.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <p>Expires: {formatLocalDateTime(block.expiresAt)}</p>
                    <p>By: {block.blockedBy?.name ?? "Not set"}</p>
                    <p>Booking: {block.booking?.id ? "Converted" : "Not converted"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      ) : null}
    </div>
  )
}

function ProjectSelector({
  projects,
  selectedProjectId,
  onChange,
}: {
  projects: Project[]
  selectedProjectId: string
  onChange: (projectId: string) => void
}) {
  return (
    <Field label="Project" htmlFor="projectSelector">
      <Select value={selectedProjectId} onValueChange={onChange}>
        <SelectTrigger id="projectSelector" className="w-full">
          <SelectValue placeholder="Select project" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.projectName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function PlotSelector({
  plots,
  selectedPlot,
  onChange,
}: {
  plots: Plot[]
  selectedPlot: Plot
  onChange: (plotId: string) => void
}) {
  return (
    <Field label="Plot" htmlFor="plotSelector">
      <Select value={selectedPlot.id} onValueChange={onChange}>
        <SelectTrigger id="plotSelector" className="w-full">
          <SelectValue placeholder="Select plot" />
        </SelectTrigger>
        <SelectContent>
          {plots.map((plot) => (
            <SelectItem key={plot.id} value={plot.id}>
              Plot {plot.plotNumber} - {toTitleLabel(plot.status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
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

function createInventorySummary(projects: Project[]) {
  const plots = projects.flatMap((project) => project.plots ?? [])

  return {
    projects: projects.length,
    plots: plots.length,
    available: countByStatus(plots, "AVAILABLE"),
    blocked: countByStatus(plots, "BLOCKED"),
    bookedSold: countByStatus(plots, "BOOKED") + countByStatus(plots, "SOLD"),
  }
}

function countByStatus(plots: Plot[], status: PlotStatus) {
  return plots.filter((plot) => plot.status === status).length
}

function StatusBadge({ status }: { status: PlotStatus }) {
  const className =
    status === "AVAILABLE"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "BLOCKED"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : status === "BOOKED" || status === "SOLD"
          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
          : ""

  return (
    <Badge variant="outline" className={`w-fit rounded-md ${className}`}>
      {toTitleLabel(status)}
    </Badge>
  )
}

function formatPrice(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "-"
  }

  const amount = Number(value)

  if (Number.isNaN(amount)) {
    return String(value)
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
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
