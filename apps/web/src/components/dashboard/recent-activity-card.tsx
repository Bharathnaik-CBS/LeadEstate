"use client"

import { useId } from "react"
import { Loader2 } from "lucide-react"
import { DashboardEmpty } from "@/components/dashboard/dashboard-state"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { DashboardRecentActivityItem } from "@/lib/dashboard"
import { formatLocalDateTime } from "@/lib/date"
import { cn } from "@/lib/utils"

type RecentActivityCardProps = {
  items: DashboardRecentActivityItem[]
  title?: string
  description?: string
  nextCursor?: string | null
  isLoadingMore?: boolean
  onLoadMore?: () => void
  className?: string
}

export function RecentActivityCard({
  items,
  title = "Recent activity",
  description = "Latest CRM changes and updates.",
  nextCursor,
  isLoadingMore = false,
  onLoadMore,
  className,
}: RecentActivityCardProps) {
  const headingId = useId()

  if (items.length === 0) {
    return (
      <DashboardEmpty
        title={title}
        message="No recent activity has been recorded yet."
        className={cn("h-full", className)}
      />
    )
  }

  return (
    <Card
      className={cn("h-full rounded-lg", className)}
      role="region"
      aria-labelledby={headingId}
    >
      <CardHeader>
        <CardTitle id={headingId}>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-col gap-4">
        <div className="max-h-[32rem] space-y-4 overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className="relative pl-5">
              <span className="absolute left-0 top-1.5 size-2 rounded-full bg-primary" />
              <div className="space-y-1">
                <p className="break-words font-medium leading-5">
                  {formatActivityAction(item.action)}
                </p>
                <p className="break-words text-sm text-muted-foreground">
                  {item.targetType} updated
                  {item.actor ? ` by ${item.actor.name}` : ""}
                </p>
                <time
                  dateTime={item.occurredAt}
                  className="block text-xs text-muted-foreground"
                >
                  {formatLocalDateTime(item.occurredAt)}
                </time>
              </div>
            </div>
          ))}
        </div>
        {nextCursor && onLoadMore ? (
          <Button
            type="button"
            variant="outline"
            className="self-start"
            disabled={isLoadingMore}
            aria-busy={isLoadingMore}
            onClick={onLoadMore}
          >
            {isLoadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

function formatActivityAction(action: string) {
  return action
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}
