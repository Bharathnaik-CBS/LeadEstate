"use client"

import {
  KeyboardEvent,
  PointerEvent,
  WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  Code2,
  Loader2,
  Maximize2,
  MousePointer2,
  RotateCcw,
  Save,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  LAYOUT_DEFAULTS,
  LAYOUT_GRID_SIZES,
  autoArrangeLayout,
  clampZoom,
  getLayoutBounds,
  normalizeProjectLayout,
  serializeProjectLayout,
  snapValue,
  updateLayoutCanvas,
  updateLayoutNode,
  validateProjectLayout,
  type LayoutViewport,
  type NormalizedProjectLayout,
  type PlotLayoutNode,
} from "@/lib/project-layout"
import type { Plot, Project, ProjectLayoutJson, PlotStatus } from "@/lib/projects"

type PlotLayoutEditorProps = {
  project: Project
  plots: Plot[]
  layoutJson: ProjectLayoutJson | null
  isLoading: boolean
  isSaving: boolean
  onSave: (layoutJson: ProjectLayoutJson) => Promise<ProjectLayoutJson | void>
  onDirtyChange?: (isDirty: boolean) => void
}

type Interaction =
  | {
      type: "drag"
      plotId: string
      start: SvgPoint
      node: PlotLayoutNode
    }
  | {
      type: "resize"
      plotId: string
      handle: ResizeHandle
      start: SvgPoint
      node: PlotLayoutNode
    }
  | {
      type: "pan"
      start: SvgPoint
      viewport: LayoutViewport
    }

type SvgPoint = {
  x: number
  y: number
}

type ResizeHandle = "nw" | "ne" | "sw" | "se"

const RESIZE_HANDLES: ResizeHandle[] = ["nw", "ne", "sw", "se"]

export function PlotLayoutEditor({
  project,
  plots,
  layoutJson,
  isLoading,
  isSaving,
  onSave,
  onDirtyChange,
}: PlotLayoutEditorProps) {
  const initialLayout = useMemo(
    () => normalizeProjectLayout(layoutJson, plots),
    [layoutJson, plots]
  )
  const layoutKey = `${project.id}:${stringifyLayout(initialLayout)}`

  return (
    <PlotLayoutEditorContent
      key={layoutKey}
      project={project}
      plots={plots}
      initialLayout={initialLayout}
      isLoading={isLoading}
      isSaving={isSaving}
      onSave={onSave}
      onDirtyChange={onDirtyChange}
    />
  )
}

function PlotLayoutEditorContent({
  project,
  plots,
  initialLayout,
  isLoading,
  isSaving,
  onSave,
  onDirtyChange,
}: Omit<PlotLayoutEditorProps, "layoutJson"> & {
  initialLayout: NormalizedProjectLayout
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [layout, setLayout] = useState<NormalizedProjectLayout>(() => initialLayout)
  const [baseline, setBaseline] = useState(() => stringifyLayout(initialLayout))
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(
    () => initialLayout.plots[0]?.plotId ?? null
  )
  const [interaction, setInteraction] = useState<Interaction | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false)
  const [jsonText, setJsonText] = useState("")
  const [jsonError, setJsonError] = useState<string | null>(null)

  const serializedLayout = useMemo(() => stringifyLayout(layout), [layout])
  const isDirty = serializedLayout !== baseline
  const selectedNode =
    layout.plots.find((node) => node.plotId === selectedPlotId) ?? null
  const selectedPlot =
    plots.find((plot) => plot.id === selectedNode?.plotId) ?? null
  const plotMap = useMemo(
    () => new Map(plots.map((plot) => [plot.id, plot])),
    [plots]
  )
  const validationErrors = useMemo(() => validateProjectLayout(layout), [layout])
  const warnings = [...layout.warnings, ...validationErrors]

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (!isDirty) {
      return
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isDirty])

  function updateLayout(nextLayout: NormalizedProjectLayout) {
    setLayout(nextLayout)
    setLocalError(null)
  }

  async function handleSave() {
    const errors = validateProjectLayout(layout)

    if (errors.length > 0) {
      setLocalError(errors[0])
      return
    }

    try {
      const savedLayout = await onSave(serializeProjectLayout(layout))
      const normalized = normalizeProjectLayout(savedLayout ?? serializeProjectLayout(layout), plots)
      setLayout(normalized)
      setBaseline(stringifyLayout(normalized))
      setLocalError(null)
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Unable to save project layout."
      )
    }
  }

  function handleDiscard() {
    if (isDirty && !window.confirm("Discard unsaved layout changes?")) {
      return
    }

    setLayout(initialLayout)
    setBaseline(stringifyLayout(initialLayout))
    setLocalError(null)
  }

  function handleAutoArrange(arrangeAll: boolean) {
    updateLayout(autoArrangeLayout(layout, arrangeAll))
  }

  function handleFitToPlots() {
    const bounds = getLayoutBounds(layout.plots)

    if (!bounds) {
      return
    }

    const padding = layout.canvas.gridSize * 2
    const boundsWidth = Math.max(1, bounds.maxX - bounds.minX)
    const boundsHeight = Math.max(1, bounds.maxY - bounds.minY)
    const nextZoom = clampZoom(
      Math.min(
        (layout.canvas.width - padding * 2) / boundsWidth,
        (layout.canvas.height - padding * 2) / boundsHeight
      )
    )
    const viewport = {
      x: (layout.canvas.width - boundsWidth * nextZoom) / 2 - bounds.minX * nextZoom,
      y:
        (layout.canvas.height - boundsHeight * nextZoom) / 2 -
        bounds.minY * nextZoom,
      zoom: nextZoom,
    }

    updateLayout(updateLayoutCanvas(layout, { viewport }))
  }

  function handleResetView() {
    updateLayout(
      updateLayoutCanvas(layout, {
        viewport: {
          x: 0,
          y: 0,
          zoom: 1,
        },
      })
    )
  }

  function setZoom(zoom: number) {
    updateLayout(
      updateLayoutCanvas(layout, {
        viewport: {
          ...layout.canvas.viewport,
          zoom: clampZoom(zoom),
        },
      })
    )
  }

  function handlePointerDownCanvas(event: PointerEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedPlotId(null)
    setInteraction({
      type: "pan",
      start: getSvgPoint(event, svgRef.current),
      viewport: layout.canvas.viewport,
    })
  }

  function handleNodePointerDown(
    event: PointerEvent<SVGGElement>,
    node: PlotLayoutNode
  ) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedPlotId(node.plotId)
    setInteraction({
      type: "drag",
      plotId: node.plotId,
      start: getWorldPoint(event, svgRef.current, layout.canvas.viewport),
      node,
    })
  }

  function handleResizePointerDown(
    event: PointerEvent<SVGRectElement>,
    node: PlotLayoutNode,
    handle: ResizeHandle
  ) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedPlotId(node.plotId)
    setInteraction({
      type: "resize",
      plotId: node.plotId,
      handle,
      start: getWorldPoint(event, svgRef.current, layout.canvas.viewport),
      node,
    })
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!interaction) {
      return
    }

    if (interaction.type === "pan") {
      const current = getSvgPoint(event, svgRef.current)
      updateLayout(
        updateLayoutCanvas(layout, {
          viewport: {
            ...interaction.viewport,
            x: interaction.viewport.x + current.x - interaction.start.x,
            y: interaction.viewport.y + current.y - interaction.start.y,
          },
        })
      )
      return
    }

    const current = getWorldPoint(event, svgRef.current, layout.canvas.viewport)
    const dx = current.x - interaction.start.x
    const dy = current.y - interaction.start.y

    if (interaction.type === "drag") {
      const x = applySnap(interaction.node.x + dx)
      const y = applySnap(interaction.node.y + dy)
      updateLayout(updateLayoutNode(layout, interaction.plotId, { x, y }))
      return
    }

    updateLayout(
      updateLayoutNode(
        layout,
        interaction.plotId,
        getResizePatch(interaction.node, interaction.handle, dx, dy, applySnap)
      )
    )
  }

  function handlePointerUp() {
    setInteraction(null)
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault()
    const direction = event.deltaY > 0 ? -0.08 : 0.08
    setZoom(layout.canvas.viewport.zoom + direction)
  }

  function handleKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (!selectedNode || isFormTarget(event.target)) {
      return
    }

    const step = event.shiftKey ? layout.canvas.gridSize * 5 : layout.canvas.gridSize

    if (event.key === "Escape") {
      setSelectedPlotId(null)
      return
    }

    const movementByKey: Record<string, SvgPoint> = {
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
    }
    const movement = movementByKey[event.key]

    if (!movement) {
      return
    }

    event.preventDefault()
    updateLayout(
      updateLayoutNode(layout, selectedNode.plotId, {
        x: selectedNode.x + movement.x,
        y: selectedNode.y + movement.y,
      })
    )
  }

  function updateSelectedNode(
    key: "x" | "y" | "width" | "height" | "rotation",
    value: string
  ) {
    if (!selectedNode) {
      return
    }

    const numberValue = Number(value)

    if (!Number.isFinite(numberValue)) {
      return
    }

    updateLayout(updateLayoutNode(layout, selectedNode.plotId, { [key]: numberValue }))
  }

  function handleOpenJsonDialog() {
    setJsonText(JSON.stringify(serializeProjectLayout(layout), null, 2))
    setJsonError(null)
    setJsonDialogOpen(true)
  }

  function handleApplyJson() {
    try {
      const parsed = JSON.parse(jsonText) as unknown

      if (
        parsed === null ||
        (typeof parsed !== "object" && !Array.isArray(parsed))
      ) {
        setJsonError("Layout JSON must be an object or array.")
        return
      }

      updateLayout(normalizeProjectLayout(parsed as ProjectLayoutJson, plots))
      setJsonDialogOpen(false)
    } catch {
      setJsonError("Enter valid layout JSON.")
    }
  }

  function applySnap(value: number) {
    return layout.canvas.snapToGrid
      ? snapValue(value, layout.canvas.gridSize)
      : Math.round(value * 100) / 100
  }

  return (
    <div className="space-y-4" onKeyDown={handleKeyboard} tabIndex={0}>
      <div className="flex flex-col gap-3 rounded-lg border bg-background p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={handleSave} disabled={isSaving || isLoading || !isDirty}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save layout
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleDiscard}
            disabled={isSaving || isLoading || !isDirty}
          >
            <RotateCcw className="size-4" />
            Discard
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleAutoArrange(false)}
            disabled={isSaving || isLoading}
          >
            <Sparkles className="size-4" />
            Auto-arrange
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleAutoArrange(true)}
            disabled={isSaving || isLoading}
          >
            <Sparkles className="size-4" />
            Arrange all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setZoom(layout.canvas.viewport.zoom - 0.1)}
            disabled={isSaving || isLoading}
            title="Zoom out"
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setZoom(layout.canvas.viewport.zoom + 0.1)}
            disabled={isSaving || isLoading}
            title="Zoom in"
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={handleFitToPlots}
            disabled={isSaving || isLoading || plots.length === 0}
            title="Fit"
          >
            <Maximize2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={handleResetView}
            disabled={isSaving || isLoading}
            title="Reset view"
          >
            <MousePointer2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenJsonDialog}
            disabled={isSaving || isLoading}
          >
            <Code2 className="size-4" />
            JSON
          </Button>
          <Badge variant="outline" className="rounded-md">
            {Math.round(layout.canvas.viewport.zoom * 100)}%
          </Badge>
          {isDirty ? (
            <Badge variant="outline" className="rounded-md border-amber-300 text-amber-700">
              Unsaved
            </Badge>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(140px,0.3fr)_minmax(140px,0.3fr)_minmax(180px,0.4fr)]">
          <Field label="Grid" htmlFor="layoutGrid">
            <Select
              value={String(layout.canvas.gridSize)}
              disabled={isSaving || isLoading}
              onValueChange={(value) =>
                updateLayout(updateLayoutCanvas(layout, { gridSize: Number(value) }))
              }
            >
              <SelectTrigger id="layoutGrid">
                <SelectValue placeholder="Grid" />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_GRID_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}px
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Snap" htmlFor="layoutSnap">
            <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
              <input
                id="layoutSnap"
                type="checkbox"
                checked={layout.canvas.snapToGrid}
                disabled={isSaving || isLoading}
                onChange={(event) =>
                  updateLayout(
                    updateLayoutCanvas(layout, {
                      snapToGrid: event.target.checked,
                    })
                  )
                }
              />
              Snap to grid
            </label>
          </Field>
          <div className="flex items-end text-sm text-muted-foreground">
            {project.projectName} · {plots.length} plots
          </div>
        </div>
      </div>

      {localError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {localError}
        </p>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {warnings.slice(0, 3).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          {warnings.length > 3 ? <p>{warnings.length - 3} more layout warnings.</p> : null}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="overflow-hidden rounded-lg border bg-muted/20">
          {isLoading ? (
            <div className="flex min-h-[420px] items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading layout
            </div>
          ) : plots.length === 0 ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">
              No plots are mapped for this project yet.
            </div>
          ) : (
            <svg
              ref={svgRef}
              className="h-[560px] w-full cursor-grab touch-none bg-background active:cursor-grabbing"
              viewBox={`0 0 ${layout.canvas.width} ${layout.canvas.height}`}
              role="img"
              aria-label={`${project.projectName} plot layout`}
              onPointerDown={handlePointerDownCanvas}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
            >
              <defs>
                <pattern
                  id="plot-layout-grid"
                  width={layout.canvas.gridSize}
                  height={layout.canvas.gridSize}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d={`M ${layout.canvas.gridSize} 0 L 0 0 0 ${layout.canvas.gridSize}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="0.7"
                    className="text-muted-foreground/30"
                  />
                </pattern>
              </defs>
              <rect
                x="0"
                y="0"
                width={layout.canvas.width}
                height={layout.canvas.height}
                fill="url(#plot-layout-grid)"
              />
              <g
                transform={`translate(${layout.canvas.viewport.x} ${layout.canvas.viewport.y}) scale(${layout.canvas.viewport.zoom})`}
              >
                {layout.plots.map((node) => (
                  <PlotNode
                    key={node.plotId}
                    node={node}
                    plot={plotMap.get(node.plotId)}
                    isSelected={node.plotId === selectedPlotId}
                    onPointerDown={(event) => handleNodePointerDown(event, node)}
                    onSelect={() => setSelectedPlotId(node.plotId)}
                    onResizePointerDown={(event, handle) =>
                      handleResizePointerDown(event, node, handle)
                    }
                  />
                ))}
              </g>
            </svg>
          )}
        </div>

        <div className="space-y-3 rounded-lg border bg-background p-4">
          <div>
            <h3 className="text-sm font-semibold">Selected plot</h3>
            <p className="text-xs text-muted-foreground">
              {selectedPlot ? `Plot ${selectedPlot.plotNumber}` : "No plot selected"}
            </p>
          </div>
          {selectedNode && selectedPlot ? (
            <>
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Status</span>
                  <PlotStatusBadge status={selectedPlot.status} />
                </div>
                <DetailRow label="Size" value={selectedPlot.size ?? "-"} />
                <DetailRow label="Facing" value={selectedPlot.facing ?? "-"} />
                <DetailRow label="Price" value={formatPrice(selectedPlot.price)} />
              </div>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="X" htmlFor="layoutX">
                    <Input
                      id="layoutX"
                      type="number"
                      value={selectedNode.x}
                      disabled={isSaving || isLoading}
                      onChange={(event) => updateSelectedNode("x", event.target.value)}
                    />
                  </Field>
                  <Field label="Y" htmlFor="layoutY">
                    <Input
                      id="layoutY"
                      type="number"
                      value={selectedNode.y}
                      disabled={isSaving || isLoading}
                      onChange={(event) => updateSelectedNode("y", event.target.value)}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Width" htmlFor="layoutWidth">
                    <Input
                      id="layoutWidth"
                      type="number"
                      min={LAYOUT_DEFAULTS.minPlotWidth}
                      value={selectedNode.width}
                      disabled={isSaving || isLoading}
                      onChange={(event) =>
                        updateSelectedNode("width", event.target.value)
                      }
                    />
                  </Field>
                  <Field label="Height" htmlFor="layoutHeight">
                    <Input
                      id="layoutHeight"
                      type="number"
                      min={LAYOUT_DEFAULTS.minPlotHeight}
                      value={selectedNode.height}
                      disabled={isSaving || isLoading}
                      onChange={(event) =>
                        updateSelectedNode("height", event.target.value)
                      }
                    />
                  </Field>
                </div>
                <Field label="Rotation" htmlFor="layoutRotation">
                  <Input
                    id="layoutRotation"
                    type="number"
                    value={selectedNode.rotation}
                    disabled={isSaving || isLoading}
                    onChange={(event) =>
                      updateSelectedNode("rotation", event.target.value)
                    }
                  />
                </Field>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Select a plot on the layout.
            </div>
          )}
        </div>
      </div>

      <Dialog open={jsonDialogOpen} onOpenChange={setJsonDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Advanced layout JSON</DialogTitle>
            <DialogDescription>
              Edit the stored layout payload for {project.projectName}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={jsonText}
            className="min-h-[420px] font-mono text-sm"
            spellCheck={false}
            onChange={(event) => setJsonText(event.target.value)}
          />
          {jsonError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {jsonError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setJsonDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleApplyJson}>
              Apply JSON
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PlotNode({
  node,
  plot,
  isSelected,
  onPointerDown,
  onSelect,
  onResizePointerDown,
}: {
  node: PlotLayoutNode
  plot?: Plot
  isSelected: boolean
  onPointerDown: (event: PointerEvent<SVGGElement>) => void
  onSelect: () => void
  onResizePointerDown: (
    event: PointerEvent<SVGRectElement>,
    handle: ResizeHandle
  ) => void
}) {
  const label = node.label ?? plot?.plotNumber ?? node.plotId
  const status = plot?.status ?? "AVAILABLE"

  return (
    <g
      transform={`translate(${node.x} ${node.y}) rotate(${node.rotation} ${node.width / 2} ${node.height / 2})`}
      onPointerDown={onPointerDown}
      onClick={onSelect}
      className="cursor-move"
    >
      <rect
        width={node.width}
        height={node.height}
        rx="5"
        className={getPlotNodeClass(status, isSelected)}
        strokeWidth={isSelected ? 3 : 1.5}
      />
      <text
        x={node.width / 2}
        y={node.height / 2 - 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="pointer-events-none fill-foreground text-[13px] font-semibold"
      >
        {label}
      </text>
      <text
        x={node.width / 2}
        y={node.height / 2 + 14}
        textAnchor="middle"
        dominantBaseline="central"
        className="pointer-events-none fill-muted-foreground text-[10px]"
      >
        {toTitleLabel(status)}
      </text>
      {isSelected
        ? RESIZE_HANDLES.map((handle) => {
            const point = getHandlePoint(node, handle)

            return (
              <rect
                key={handle}
                x={point.x - 5}
                y={point.y - 5}
                width="10"
                height="10"
                rx="2"
                className="cursor-nwse-resize fill-background stroke-primary"
                strokeWidth="2"
                onPointerDown={(event) => onResizePointerDown(event, handle)}
              />
            )
          })
        : null}
    </g>
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
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </Label>
      {children}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function PlotStatusBadge({ status }: { status: PlotStatus }) {
  return (
    <Badge variant="outline" className={`rounded-md ${getStatusClass(status)}`}>
      {toTitleLabel(status)}
    </Badge>
  )
}

function getResizePatch(
  node: PlotLayoutNode,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  normalize: (value: number) => number
) {
  const minWidth = LAYOUT_DEFAULTS.minPlotWidth
  const minHeight = LAYOUT_DEFAULTS.minPlotHeight
  let x = node.x
  let y = node.y
  let width = node.width
  let height = node.height

  if (handle.includes("e")) {
    width = Math.max(minWidth, node.width + dx)
  }

  if (handle.includes("s")) {
    height = Math.max(minHeight, node.height + dy)
  }

  if (handle.includes("w")) {
    const nextWidth = Math.max(minWidth, node.width - dx)
    x = node.x + node.width - nextWidth
    width = nextWidth
  }

  if (handle.includes("n")) {
    const nextHeight = Math.max(minHeight, node.height - dy)
    y = node.y + node.height - nextHeight
    height = nextHeight
  }

  return {
    x: normalize(x),
    y: normalize(y),
    width: Math.max(minWidth, normalize(width)),
    height: Math.max(minHeight, normalize(height)),
  }
}

function getHandlePoint(node: PlotLayoutNode, handle: ResizeHandle): SvgPoint {
  return {
    x: handle.includes("w") ? 0 : node.width,
    y: handle.includes("n") ? 0 : node.height,
  }
}

function getSvgPoint(
  event: PointerEvent<SVGElement> | WheelEvent<SVGSVGElement>,
  svg: SVGSVGElement | null
): SvgPoint {
  if (!svg) {
    return { x: 0, y: 0 }
  }

  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const matrix = svg.getScreenCTM()

  if (!matrix) {
    return { x: 0, y: 0 }
  }

  const transformed = point.matrixTransform(matrix.inverse())

  return {
    x: transformed.x,
    y: transformed.y,
  }
}

function getWorldPoint(
  event: PointerEvent<SVGElement>,
  svg: SVGSVGElement | null,
  viewport: LayoutViewport
) {
  const point = getSvgPoint(event, svg)

  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  }
}

function isFormTarget(target: EventTarget) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)
}

function stringifyLayout(layout: NormalizedProjectLayout) {
  return JSON.stringify(serializeProjectLayout(layout))
}

function getPlotNodeClass(status: PlotStatus, isSelected: boolean) {
  const base = isSelected ? "stroke-primary" : "stroke-border"

  return `${base} ${getPlotFillClass(status)}`
}

function getPlotFillClass(status: PlotStatus) {
  switch (status) {
    case "AVAILABLE":
      return "fill-emerald-100"
    case "BLOCKED":
      return "fill-amber-100"
    case "BOOKED":
      return "fill-sky-100"
    case "SOLD":
      return "fill-indigo-100"
    case "CANCELLED":
      return "fill-slate-100"
  }
}

function getStatusClass(status: PlotStatus) {
  switch (status) {
    case "AVAILABLE":
      return "border-emerald-200 text-emerald-700"
    case "BLOCKED":
      return "border-amber-200 text-amber-700"
    case "BOOKED":
      return "border-sky-200 text-sky-700"
    case "SOLD":
      return "border-indigo-200 text-indigo-700"
    case "CANCELLED":
      return "border-slate-200 text-slate-700"
  }
}

function formatPrice(value: Plot["price"]) {
  if (value === null || value === undefined || value === "") {
    return "-"
  }

  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return String(value)
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numberValue)
}

function toTitleLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
