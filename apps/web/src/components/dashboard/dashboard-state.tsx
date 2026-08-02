"use client"

import type { ReactNode } from "react"
import { AlertCircle, Inbox, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type DashboardStateProps = {
  className?: string
}

type DashboardLoadingProps = DashboardStateProps & {
  title?: string
  description?: string
  rows?: number
  sections?: number
}

type DashboardErrorProps = DashboardStateProps & {
  title?: string
  message: string
  retryLabel?: string
  onRetry?: () => void
}

type DashboardEmptyProps = DashboardStateProps & {
  title?: string
  message: string
  action?: ReactNode
}

export function DashboardLoading({
  title = "Loading dashboard",
  description = "Preparing the latest dashboard data.",
  rows = 4,
  sections = 0,
  className,
}: DashboardLoadingProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("space-y-4", className)}
    >
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>

      {rows > 0 ? (
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-hidden
        >
          {Array.from({ length: rows }).map((_, index) => (
            <Card key={index} className="min-h-36 rounded-lg">
              <CardContent className="space-y-3 py-0">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-3 w-36" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {sections > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2" aria-hidden>
          {Array.from({ length: sections }).map((_, index) => (
            <Card key={index} className="min-h-64 rounded-lg">
              <CardContent className="space-y-4 py-0">
                <Skeleton className="h-5 w-36" />
                {Array.from({ length: 5 }).map((__, rowIndex) => (
                  <div key={rowIndex} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function DashboardError({
  title = "Dashboard unavailable",
  message,
  retryLabel = "Retry",
  onRetry,
  className,
}: DashboardErrorProps) {
  return (
    <Card
      role="alert"
      aria-live="assertive"
      className={cn("rounded-lg border-destructive/30", className)}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="size-4 text-destructive" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{message}</p>
        {onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            <RefreshCw className="size-4" />
            {retryLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function DashboardEmpty({
  title = "No dashboard data",
  message,
  action,
  className,
}: DashboardEmptyProps) {
  return (
    <Card
      role="status"
      aria-live="polite"
      className={cn("rounded-lg border-dashed", className)}
    >
      <CardContent className="flex flex-col items-start gap-4 py-0">
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Inbox className="size-5" />
        </span>
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  )
}
