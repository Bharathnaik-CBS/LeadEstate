import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type StatusBreakdownItem = {
  label: string
  value: number
  accent?: string
}

type StatusBreakdownCardProps = {
  title: string
  description?: string
  items: StatusBreakdownItem[]
  className?: string
}

const numberFormatter = new Intl.NumberFormat("en-IN")

export function StatusBreakdownCard({
  title,
  description,
  items,
  className,
}: StatusBreakdownCardProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const maxValue = Math.max(1, ...items.map((item) => item.value))

  return (
    <Card className={cn("h-full rounded-lg", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className="grid gap-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-muted-foreground">
                  {item.label}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {numberFormatter.format(item.value)}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`${item.label}: ${numberFormatter.format(
                  item.value
                )}`}
                aria-valuemin={0}
                aria-valuemax={Math.max(total, item.value, 1)}
                aria-valuenow={item.value}
              >
                <div
                  className={cn("h-full rounded-full", item.accent ?? "bg-primary")}
                  style={{
                    width:
                      item.value === 0
                        ? "0%"
                        : `${Math.max(6, (item.value / maxValue) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="border-t pt-3 text-xs text-muted-foreground">
          Total: {numberFormatter.format(total)}
        </p>
      </CardContent>
    </Card>
  )
}
