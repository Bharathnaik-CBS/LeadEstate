import type { Plot, ProjectLayoutJson } from "@/lib/projects"

export const LAYOUT_GRID_SIZES = [5, 10, 20, 25] as const

export const LAYOUT_DEFAULTS = {
  canvasWidth: 1200,
  canvasHeight: 800,
  gridSize: 20,
  plotWidth: 90,
  plotHeight: 56,
  minPlotWidth: 28,
  minPlotHeight: 24,
  minZoom: 0.35,
  maxZoom: 2.5,
}

export type LayoutViewport = {
  x: number
  y: number
  zoom: number
}

export type LayoutCanvas = {
  width: number
  height: number
  gridSize: number
  snapToGrid: boolean
  viewport: LayoutViewport
  source: Record<string, unknown>
}

export type PlotLayoutNode = {
  plotId: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  label?: string
  source: Record<string, unknown>
  isPositioned: boolean
}

export type NormalizedProjectLayout = {
  version: number
  canvas: LayoutCanvas
  plots: PlotLayoutNode[]
  orphanNodes: PlotLayoutNode[]
  warnings: string[]
  source: Record<string, unknown>
}

export type LayoutBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function normalizeProjectLayout(
  layoutJson: ProjectLayoutJson | null | undefined,
  plots: Plot[]
): NormalizedProjectLayout {
  const rawLayout = layoutJson ?? {}
  const source = Array.isArray(rawLayout)
    ? {}
    : isRecord(rawLayout)
      ? { ...rawLayout }
      : {}
  const rawCanvas = isRecord(source.canvas) ? source.canvas : {}
  const sourceNodes = Array.isArray(rawLayout)
    ? rawLayout
    : Array.isArray(source.plots)
      ? source.plots
      : []
  const plotIds = new Set(plots.map((plot) => plot.id))
  const warnings: string[] = []
  const usedPlotIds = new Set<string>()
  const layoutNodes: PlotLayoutNode[] = []
  const orphanNodes: PlotLayoutNode[] = []

  for (const item of sourceNodes) {
    if (!isRecord(item)) {
      warnings.push("Skipped a layout node that was not an object.")
      continue
    }

    const plotId = getNodePlotId(item)

    if (!plotId) {
      warnings.push("Skipped a layout node without a plotId.")
      continue
    }

    const node = createNodeFromSource(item, plotId)

    if (!node.isPositioned) {
      warnings.push(`Plot ${plotId} did not have complete coordinates.`)
    }

    if (!plotIds.has(plotId)) {
      orphanNodes.push(node)
      warnings.push(`Layout contains a node for plot ${plotId} that is not in this project.`)
      continue
    }

    if (usedPlotIds.has(plotId)) {
      orphanNodes.push(node)
      warnings.push(`Layout contains duplicate nodes for plot ${plotId}.`)
      continue
    }

    usedPlotIds.add(plotId)
    layoutNodes.push(node)
  }

  for (const plot of plots) {
    if (!usedPlotIds.has(plot.id)) {
      layoutNodes.push(createDefaultNode(plot.id, plot.plotNumber))
    }
  }

  const canvas = normalizeCanvas(rawCanvas)

  return {
    version: toPositiveInteger(source.version, 1),
    canvas,
    plots: layoutNodes,
    orphanNodes,
    warnings,
    source,
  }
}

export function serializeProjectLayout(
  layout: NormalizedProjectLayout
): ProjectLayoutJson {
  return {
    ...layout.source,
    version: layout.version,
    canvas: {
      ...layout.canvas.source,
      width: roundNumber(layout.canvas.width),
      height: roundNumber(layout.canvas.height),
      gridSize: layout.canvas.gridSize,
      snapToGrid: layout.canvas.snapToGrid,
      viewport: {
        x: roundNumber(layout.canvas.viewport.x),
        y: roundNumber(layout.canvas.viewport.y),
        zoom: roundNumber(layout.canvas.viewport.zoom),
      },
    },
    plots: [...layout.plots, ...layout.orphanNodes].map(serializeNode),
  }
}

export function validateProjectLayout(
  layout: NormalizedProjectLayout
): string[] {
  const errors: string[] = []
  const seenPlotIds = new Set<string>()

  if (!isFinitePositive(layout.canvas.width)) {
    errors.push("Canvas width must be a positive number.")
  }

  if (!isFinitePositive(layout.canvas.height)) {
    errors.push("Canvas height must be a positive number.")
  }

  for (const node of [...layout.plots, ...layout.orphanNodes]) {
    if (!node.plotId.trim()) {
      errors.push("Every layout node must have a plotId.")
    }

    if (seenPlotIds.has(node.plotId)) {
      errors.push(`Duplicate layout node for plot ${node.plotId}.`)
    }

    seenPlotIds.add(node.plotId)

    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      errors.push(`Plot ${node.plotId} must have finite x and y coordinates.`)
    }

    if (!isFinitePositive(node.width) || !isFinitePositive(node.height)) {
      errors.push(`Plot ${node.plotId} must have positive width and height.`)
    }
  }

  return errors
}

export function updateLayoutNode(
  layout: NormalizedProjectLayout,
  plotId: string,
  patch: Partial<Pick<PlotLayoutNode, "x" | "y" | "width" | "height" | "rotation" | "label">>
): NormalizedProjectLayout {
  return {
    ...layout,
    plots: layout.plots.map((node) =>
      node.plotId === plotId
        ? normalizeNodePatch({
            ...node,
            ...patch,
            isPositioned: true,
          })
        : node
    ),
  }
}

export function updateLayoutCanvas(
  layout: NormalizedProjectLayout,
  patch: Partial<Pick<LayoutCanvas, "width" | "height" | "gridSize" | "snapToGrid" | "viewport">>
): NormalizedProjectLayout {
  return {
    ...layout,
    canvas: {
      ...layout.canvas,
      ...patch,
      width: patch.width === undefined ? layout.canvas.width : normalizeDimension(patch.width, LAYOUT_DEFAULTS.canvasWidth),
      height: patch.height === undefined ? layout.canvas.height : normalizeDimension(patch.height, LAYOUT_DEFAULTS.canvasHeight),
      gridSize:
        patch.gridSize === undefined
          ? layout.canvas.gridSize
          : normalizeGridSize(patch.gridSize),
      viewport:
        patch.viewport === undefined
          ? layout.canvas.viewport
          : normalizeViewport(patch.viewport),
    },
  }
}

export function autoArrangeLayout(
  layout: NormalizedProjectLayout,
  arrangeAll = false
): NormalizedProjectLayout {
  const margin = layout.canvas.gridSize * 2
  const gap = layout.canvas.gridSize
  const nodeWidth = LAYOUT_DEFAULTS.plotWidth
  const nodeHeight = LAYOUT_DEFAULTS.plotHeight
  const usableWidth = Math.max(nodeWidth, layout.canvas.width - margin * 2)
  const columns = Math.max(1, Math.floor((usableWidth + gap) / (nodeWidth + gap)))
  let arrangedIndex = 0

  return {
    ...layout,
    plots: layout.plots.map((node) => {
      if (!arrangeAll && node.isPositioned) {
        return node
      }

      const column = arrangedIndex % columns
      const row = Math.floor(arrangedIndex / columns)
      arrangedIndex += 1

      return {
        ...node,
        x: snapValue(margin + column * (nodeWidth + gap), layout.canvas.gridSize),
        y: snapValue(margin + row * (nodeHeight + gap), layout.canvas.gridSize),
        width: node.width > 0 ? node.width : nodeWidth,
        height: node.height > 0 ? node.height : nodeHeight,
        isPositioned: true,
      }
    }),
  }
}

export function snapValue(value: number, gridSize: number) {
  const safeGridSize = normalizeGridSize(gridSize)
  return roundNumber(Math.round(value / safeGridSize) * safeGridSize)
}

export function clampZoom(zoom: number) {
  if (!Number.isFinite(zoom)) {
    return 1
  }

  return Math.min(LAYOUT_DEFAULTS.maxZoom, Math.max(LAYOUT_DEFAULTS.minZoom, zoom))
}

export function getLayoutBounds(nodes: PlotLayoutNode[]): LayoutBounds | null {
  if (nodes.length === 0) {
    return null
  }

  return nodes.reduce<LayoutBounds>(
    (bounds, node) => ({
      minX: Math.min(bounds.minX, node.x),
      minY: Math.min(bounds.minY, node.y),
      maxX: Math.max(bounds.maxX, node.x + node.width),
      maxY: Math.max(bounds.maxY, node.y + node.height),
    }),
    {
      minX: nodes[0].x,
      minY: nodes[0].y,
      maxX: nodes[0].x + nodes[0].width,
      maxY: nodes[0].y + nodes[0].height,
    }
  )
}

function normalizeCanvas(source: Record<string, unknown>): LayoutCanvas {
  return {
    width: normalizeDimension(source.width, LAYOUT_DEFAULTS.canvasWidth),
    height: normalizeDimension(source.height, LAYOUT_DEFAULTS.canvasHeight),
    gridSize: normalizeGridSize(source.gridSize),
    snapToGrid:
      typeof source.snapToGrid === "boolean" ? source.snapToGrid : true,
    viewport: normalizeViewport(
      isRecord(source.viewport) ? source.viewport : undefined
    ),
    source: { ...source },
  }
}

function normalizeViewport(source?: Record<string, unknown>): LayoutViewport {
  return {
    x: toFiniteNumber(source?.x, 0),
    y: toFiniteNumber(source?.y, 0),
    zoom: clampZoom(toFiniteNumber(source?.zoom, 1)),
  }
}

function createNodeFromSource(
  source: Record<string, unknown>,
  plotId: string
): PlotLayoutNode {
  const hasX = Number.isFinite(toNullableNumber(source.x))
  const hasY = Number.isFinite(toNullableNumber(source.y))
  const hasWidth = isFinitePositive(toNullableNumber(source.width))
  const hasHeight = isFinitePositive(toNullableNumber(source.height))

  return normalizeNodePatch({
    plotId,
    x: toFiniteNumber(source.x, 0),
    y: toFiniteNumber(source.y, 0),
    width: normalizeDimension(source.width, LAYOUT_DEFAULTS.plotWidth),
    height: normalizeDimension(source.height, LAYOUT_DEFAULTS.plotHeight),
    rotation: toFiniteNumber(source.rotation, 0),
    label: typeof source.label === "string" ? source.label : undefined,
    source: { ...source },
    isPositioned: hasX && hasY && hasWidth && hasHeight,
  })
}

function createDefaultNode(plotId: string, label: string): PlotLayoutNode {
  return {
    plotId,
    x: 0,
    y: 0,
    width: LAYOUT_DEFAULTS.plotWidth,
    height: LAYOUT_DEFAULTS.plotHeight,
    rotation: 0,
    label,
    source: {},
    isPositioned: false,
  }
}

function normalizeNodePatch(node: PlotLayoutNode): PlotLayoutNode {
  return {
    ...node,
    x: toFiniteNumber(node.x, 0),
    y: toFiniteNumber(node.y, 0),
    width: normalizeDimension(node.width, LAYOUT_DEFAULTS.plotWidth),
    height: normalizeDimension(node.height, LAYOUT_DEFAULTS.plotHeight),
    rotation: toFiniteNumber(node.rotation, 0),
  }
}

function serializeNode(node: PlotLayoutNode): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    ...node.source,
    plotId: node.plotId,
    x: roundNumber(node.x),
    y: roundNumber(node.y),
    width: roundNumber(node.width),
    height: roundNumber(node.height),
    rotation: roundNumber(node.rotation),
  }

  if (node.label !== undefined) {
    serialized.label = node.label
  }

  return serialized
}

function getNodePlotId(source: Record<string, unknown>) {
  if (typeof source.plotId === "string" && source.plotId.trim()) {
    return source.plotId
  }

  if (typeof source.id === "string" && source.id.trim()) {
    return source.id
  }

  return null
}

function normalizeGridSize(value: unknown) {
  const numberValue = toFiniteNumber(value, LAYOUT_DEFAULTS.gridSize)
  const available = [...LAYOUT_GRID_SIZES]

  return available.reduce((closest, candidate) =>
    Math.abs(candidate - numberValue) < Math.abs(closest - numberValue)
      ? candidate
      : closest
  )
}

function normalizeDimension(value: unknown, fallback: number) {
  const numberValue = toFiniteNumber(value, fallback)

  return Math.max(1, numberValue)
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function toPositiveInteger(value: unknown, fallback: number) {
  const numberValue = toFiniteNumber(value, fallback)

  return Math.max(1, Math.round(numberValue))
}

function toFiniteNumber(value: unknown, fallback: number) {
  const numberValue = toNullableNumber(value)

  return numberValue === null ? fallback : numberValue
}

function toNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const numberValue = Number(value)

    return Number.isFinite(numberValue) ? numberValue : null
  }

  return null
}

function roundNumber(value: number) {
  return Math.round(value * 100) / 100
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
