"use client"

import { useId } from "react"
import { Clock } from "lucide-react"
import { DashboardEmpty } from "@/components/dashboard/dashboard-state"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  DashboardPendingActionItem,
  DashboardPendingActionPriority,
} from "@/lib/dashboard"
import { formatLocalDateTime } from "@/lib/date"
import { cn } from "@/lib/utils"

type PendingActionsCardProps = {
  items: DashboardPendingActionItem[]
  title?: string
  description?: string
  emptyMessage?: string
  className?: string
}

export function PendingActionsCard({
  items,
  title = "Pending actions",
  description = "Work that needs attention soon.",
  emptyMessage = "There are no pending dashboard actions.",
  className,
}: PendingActionsCardProps) {
  const headingId = useId()

  if (items.length === 0) {
    return (
      <DashboardEmpty
        title={title}
        message={emptyMessage}
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
      <CardContent className="min-h-0">
        <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-medium leading-5">
                    {item.title}
                  </p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {item.entity.label}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-6 shrink-0 self-start rounded-md px-2.5",
                    priorityClasses[item.priority]
                  )}
                  aria-label={`${formatPriority(item.priority)} priority`}
                >
                  {formatPriority(item.priority)}
                </Badge>
              </div>
              {item.dueAt ? (
                <time
                  dateTime={item.dueAt}
                  className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Clock className="size-3.5" />
                  {formatLocalDateTime(item.dueAt)}
                </time>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const priorityClasses: Record<DashboardPendingActionPriority, string> = {
  HIGH: "border-rose-200 bg-rose-50 text-rose-700",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-800",
  LOW: "border-sky-200 bg-sky-50 text-sky-700",
}

function formatPriority(priority: DashboardPendingActionPriority) {
  return priority.charAt(0) + priority.slice(1).toLowerCase()
}
