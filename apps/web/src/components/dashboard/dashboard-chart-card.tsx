"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type ChartPoint = {
  label: string
  count: number
}

type DashboardChartCardProps = {
  title: string
  description?: string
  points: ChartPoint[]
  type?: "bar" | "line"
  className?: string
}

export function DashboardChartCard({
  title,
  description,
  points,
  type = "bar",
  className,
}: DashboardChartCardProps) {
  const hasData = points.some((point) => point.count > 0)

  return (
    <Card className={cn("rounded-lg", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {points.length === 0 || !hasData ? (
          <div className="flex h-52 items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 text-center text-sm text-muted-foreground">
            No matching data yet.
          </div>
        ) : type === "line" ? (
          <LineChart points={points} />
        ) : (
          <BarChart points={points} />
        )}
      </CardContent>
    </Card>
  )
}

function BarChart({ points }: { points: ChartPoint[] }) {
  const max = Math.max(...points.map((point) => point.count), 1)

  return (
    <div className="flex h-56 items-end gap-2 overflow-hidden rounded-lg border bg-muted/20 px-4 py-3">
      {points.map((point) => {
        const height = Math.max((point.count / max) * 100, point.count ? 8 : 0)

        return (
          <div
            key={point.label}
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            <div className="flex h-40 w-full items-end">
              <div
                className="w-full rounded-t-md bg-primary/80 shadow-sm"
                style={{ height: `${height}%` }}
                aria-label={`${point.label}: ${point.count}`}
                title={`${point.label}: ${point.count}`}
              />
            </div>
            <span className="max-w-full truncate text-xs text-muted-foreground">
              {point.label}
            </span>
            <span className="text-xs font-semibold">{point.count}</span>
          </div>
        )
      })}
    </div>
  )
}

function LineChart({ points }: { points: ChartPoint[] }) {
  const max = Math.max(...points.map((point) => point.count), 1)
  const width = 420
  const height = 180
  const padX = 18
  const padY = 18
  const usableWidth = width - padX * 2
  const usableHeight = height - padY * 2
  const coordinates = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padX + (index / (points.length - 1)) * usableWidth
    const y = height - padY - (point.count / max) * usableHeight

    return { x, y, point }
  })
  const path = coordinates
    .map((coordinate, index) =>
      `${index === 0 ? "M" : "L"} ${coordinate.x.toFixed(2)} ${coordinate.y.toFixed(2)}`
    )
    .join(" ")

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Lead trend chart"
        className="h-48 w-full"
        preserveAspectRatio="none"
      >
        <path
          d={`M ${padX} ${height - padY} H ${width - padX}`}
          className="stroke-border"
          strokeWidth="1"
          fill="none"
        />
        <path
          d={path}
          className="stroke-primary"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {coordinates.map((coordinate) => (
          <circle
            key={`${coordinate.point.label}-${coordinate.x}`}
            cx={coordinate.x}
            cy={coordinate.y}
            r="4"
            className="fill-background stroke-primary"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{points[0]?.label}</span>
        <span className="font-medium text-foreground">
          {points.at(-1)?.count ?? 0} total
        </span>
        <span>{points.at(-1)?.label}</span>
      </div>
    </div>
  )
}
