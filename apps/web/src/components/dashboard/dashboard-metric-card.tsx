import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type DashboardMetricCardProps = {
  label: string
  value: number | string
  description?: string
  icon?: LucideIcon
  accent?: string
  className?: string
}

const numberFormatter = new Intl.NumberFormat("en-IN")

export function DashboardMetricCard({
  label,
  value,
  description,
  icon: Icon,
  accent = "border-l-primary",
  className,
}: DashboardMetricCardProps) {
  return (
    <Card className={cn("min-h-36 rounded-lg border-l-4", accent, className)}>
      <CardContent className="flex h-full flex-col justify-between py-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 break-words text-3xl font-semibold leading-tight tracking-normal tabular-nums [overflow-wrap:anywhere]">
              {formatMetricValue(value)}
            </p>
            {description ? (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {Icon ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="size-4" />
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function formatMetricValue(value: number | string) {
  return typeof value === "number" ? numberFormatter.format(value) : value
}
