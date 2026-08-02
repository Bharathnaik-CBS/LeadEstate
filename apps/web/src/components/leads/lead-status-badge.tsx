import { Badge } from "@/components/ui/badge"
import type { LeadStatus } from "@/lib/leads"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  FOLLOW_UP: "Follow-up",
  SITE_VISIT: "Site Visit",
  NEGOTIATION: "Negotiation",
  BLOCKED: "Blocked",
  BOOKED: "Booked",
  CANCELLED: "Cancelled",
}

const STATUS_CLASSES: Record<LeadStatus, string> = {
  NEW: "border-sky-200 bg-sky-50 text-sky-700",
  FOLLOW_UP: "border-cyan-200 bg-cyan-50 text-cyan-700",
  SITE_VISIT: "border-violet-200 bg-violet-50 text-violet-700",
  NEGOTIATION: "border-indigo-200 bg-indigo-50 text-indigo-700",
  BLOCKED: "border-amber-200 bg-amber-50 text-amber-800",
  BOOKED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-700",
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("h-6 rounded-md px-2.5", STATUS_CLASSES[status])}
    >
      {STATUS_LABELS[status]}
    </Badge>
  )
}
