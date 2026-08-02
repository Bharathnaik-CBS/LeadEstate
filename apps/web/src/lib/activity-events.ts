import { apiRequest } from "@/lib/api"
import type { UserRole } from "@/lib/auth"

export type ActivityEventActor = {
  id: string
  name: string
  email: string
  role: UserRole
}

export type ActivityEventMetadata = Record<string, unknown>

export type ActivityEvent = {
  id: string
  action: string
  targetType: string
  targetId: string
  actorId?: string | null
  actor?: ActivityEventActor | null
  metadata?: ActivityEventMetadata | null
  occurredAt: string
}

export type ActivityEventQuery = {
  targetType?: string
  targetId?: string
  actorId?: string
  action?: string
  from?: string
  to?: string
  take?: number
  cursor?: string
}

export type ActivityEventPage = {
  events: ActivityEvent[]
  nextCursor?: string
  hasMore: boolean
}

const sensitiveKeyParts = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "hash",
]

export async function listActivityEvents(
  token: string,
  query: ActivityEventQuery = {}
): Promise<ActivityEventPage> {
  const take = query.take ?? 50
  const events = await apiRequest<ActivityEvent[]>(
    `/activity-events${toQueryString({ ...query, take })}`,
    { token }
  )
  const nextCursor =
    events.length === take ? events[events.length - 1]?.id : undefined

  return {
    events,
    nextCursor,
    hasMore: Boolean(nextCursor),
  }
}

export function formatActivityAction(action: string) {
  const labels: Record<string, string> = {
    "lead.created": "Lead created",
    "lead.assigned": "Lead assigned",
    "lead.updated": "Lead updated",
    "lead.deleted": "Lead deleted",
    "customer.created": "Customer created",
    "customer.updated": "Customer updated",
    "follow_up.created": "Follow-up scheduled",
    "follow_up.updated": "Follow-up updated",
    "follow_up.completed": "Follow-up completed",
    "follow_up.cancelled": "Follow-up cancelled",
    "booking.created": "Booking created",
    "booking.cancelled": "Booking cancelled",
    "booking.closed": "Sale closed",
    "payment.created": "Payment recorded",
    "kyc.updated": "KYC updated",
    "site_visit.created": "Site visit scheduled",
    "site_visit.started": "Site visit started",
    "site_visit.completed": "Site visit completed",
    "site_visit.cancelled": "Site visit cancelled",
  }

  return labels[action] ?? titleize(action)
}

export function getActivityStatus(event: ActivityEvent) {
  return (
    getMetadataString(event.metadata, "status") ??
    getMetadataString(event.metadata, "newStatus")
  )
}

export function describeActivityEvent(event: ActivityEvent) {
  const actor = formatActivityActor(event)
  const entity = formatTargetType(event.targetType)
  const reference = getEntityReference(event)
  const transition = getTransitionDescription(event.metadata)
  const status = getActivityStatus(event)
  const details = [
    transition,
    !transition && status ? `Status: ${titleize(status)}` : null,
    getPaymentDescription(event),
  ].filter(isStringValue)
  const actorText = actor ? `${actor} performed` : "System recorded"
  const targetText = reference ? `${entity} ${reference}` : entity

  return details.length > 0
    ? `${actorText} ${formatActivityAction(event.action).toLowerCase()} for ${targetText}. ${details.join(" ")}.`
    : `${actorText} ${formatActivityAction(event.action).toLowerCase()} for ${targetText}.`
}

export function formatActivityActor(event: ActivityEvent) {
  return event.actor?.name || event.actor?.email || undefined
}

export function getEntityReference(event: ActivityEvent) {
  const metadata = event.metadata
  const namedReference =
    getMetadataString(metadata, "customerName") ??
    getMetadataString(metadata, "leadName") ??
    getMetadataString(metadata, "projectName") ??
    getMetadataString(metadata, "plotNumber") ??
    getMetadataString(metadata, "referenceNumber")

  if (namedReference) {
    return namedReference
  }

  return formatShortId(event.targetId)
}

export function getRelatedReferences(event: ActivityEvent) {
  const metadata = event.metadata

  return [
    getMetadataReference(metadata, "projectId", "Project"),
    getMetadataReference(metadata, "plotId", "Plot"),
    getMetadataReference(metadata, "leadId", "Lead"),
    getMetadataReference(metadata, "customerId", "Customer"),
    getMetadataReference(metadata, "bookingId", "Booking"),
    getMetadataReference(metadata, "siteVisitId", "Visit"),
  ].filter(isStringValue)
}

export function getReliableActivityRoute(event: ActivityEvent) {
  if (event.targetType === "Customer") {
    return {
      href: `/dashboard/sales/customers/${event.targetId}/journey`,
      label: "View customer journey",
    }
  }

  const customerId = getMetadataString(event.metadata, "customerId")

  if (customerId) {
    return {
      href: `/dashboard/sales/customers/${customerId}/journey`,
      label: "View customer journey",
    }
  }

  if (event.targetType === "Lead") {
    return {
      href: "/dashboard/admin/leads",
      label: "Open leads",
    }
  }

  return null
}

export function sanitizeMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadata(item))
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !isSensitiveKey(key))
        .map(([key, item]) => [key, sanitizeMetadata(item)])
    )
  }

  return value
}

export function getMetadataEntries(metadata: ActivityEventMetadata | null | undefined) {
  const sanitized = sanitizeMetadata(metadata)

  if (!isRecord(sanitized)) {
    return []
  }

  return Object.entries(sanitized).map(([key, value]) => ({
    key,
    label: titleize(key),
    value,
  }))
}

export function metadataValueToDisplay(value: unknown) {
  if (value === null || value === undefined) {
    return "Not set"
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value)
  }

  return JSON.stringify(value, null, 2)
}

export function eventMatchesLocalSearch(event: ActivityEvent, search: string) {
  const term = search.trim().toLowerCase()

  if (!term) {
    return true
  }

  const metadataText = getMetadataEntries(event.metadata)
    .map((entry) => metadataValueToDisplay(entry.value))
    .join(" ")
  const haystack = [
    event.action,
    formatActivityAction(event.action),
    event.targetType,
    event.targetId,
    event.actor?.name,
    event.actor?.email,
    describeActivityEvent(event),
    metadataText,
  ]
    .filter(isStringValue)
    .join(" ")
    .toLowerCase()

  return haystack.includes(term)
}

export function formatTargetType(targetType: string) {
  return titleize(targetType)
}

export function titleize(value: string) {
  return value
    .replaceAll(".", "_")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function formatShortId(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`
}

function toQueryString(query: ActivityEventQuery) {
  const params = new URLSearchParams()

  addParam(params, "targetType", query.targetType)
  addParam(params, "targetId", query.targetId)
  addParam(params, "actorId", query.actorId)
  addParam(params, "action", query.action)
  addParam(params, "from", query.from)
  addParam(params, "to", query.to)
  addParam(params, "take", query.take?.toString())
  addParam(params, "cursor", query.cursor)

  const queryString = params.toString()

  return queryString ? `?${queryString}` : ""
}

function addParam(params: URLSearchParams, key: string, value?: string) {
  if (value?.trim()) {
    params.set(key, value.trim())
  }
}

function getMetadataReference(
  metadata: ActivityEventMetadata | null | undefined,
  key: string,
  label: string
) {
  const value = getMetadataString(metadata, key)

  return value ? `${label} ${formatShortId(value)}` : undefined
}

function getMetadataString(
  metadata: ActivityEventMetadata | null | undefined,
  key: string
) {
  const value = metadata?.[key]

  return typeof value === "string" && value.length > 0 ? value : undefined
}

function getPaymentDescription(event: ActivityEvent) {
  const amount = event.metadata?.amount
  const method = getMetadataString(event.metadata, "method")

  if (!amount && !method) {
    return null
  }

  return [amount ? `Amount: ${amount}` : null, method ? `Method: ${titleize(method)}` : null]
    .filter(isStringValue)
    .join(", ")
}

function getTransitionDescription(
  metadata: ActivityEventMetadata | null | undefined
) {
  const previousStatus =
    getMetadataString(metadata, "previousStatus") ??
    getMetadataString(metadata, "fromStatus")
  const nextStatus =
    getMetadataString(metadata, "status") ??
    getMetadataString(metadata, "newStatus") ??
    getMetadataString(metadata, "toStatus")

  if (!previousStatus || !nextStatus || previousStatus === nextStatus) {
    return null
  }

  return `Status: ${titleize(previousStatus)} -> ${titleize(nextStatus)}`
}

function isSensitiveKey(key: string) {
  const normalizedKey = key.toLowerCase()

  return sensitiveKeyParts.some((part) => normalizedKey.includes(part))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isStringValue(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}
