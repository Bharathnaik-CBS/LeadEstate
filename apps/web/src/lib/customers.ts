import { apiRequest } from "@/lib/api"
import {
  getBookingsFromLeads,
  getBookingKyc,
  getBookingPayments,
  type BookingKyc,
  type BookingPayment,
  type BookingSummary,
} from "@/lib/bookings"
import {
  getLeads,
  getMyLeads,
  type Lead,
  type LeadStatus,
  type LeadUser,
} from "@/lib/leads"
import { getSiteVisits, type SiteVisit } from "@/lib/site-visits"
import type { UserRole } from "@/lib/auth"

export type CustomerJourneyStatus = "PROSPECT" | "CUSTOMER" | "LOST"
export type FollowUpStatus = "PENDING" | "COMPLETED" | "CANCELLED"

export type CustomerSourceLead = {
  id: string
  fullName: string
  phone: string
  status: LeadStatus
}

export type Customer = {
  id: string
  fullName: string
  phone: string
  email?: string | null
  status: CustomerJourneyStatus
  notes?: string | null
  convertedAt?: string | null
  sourceLeadId?: string | null
  sourceLead?: CustomerSourceLead | null
  assignedToId?: string | null
  assignedTo?: LeadUser | null
  createdById?: string | null
  createdBy?: LeadUser | null
  createdAt: string
  updatedAt: string
}

export type CreateCustomerInput = {
  fullName: string
  phone: string
  email?: string
  status?: CustomerJourneyStatus
  notes?: string
  sourceLeadId?: string
  assignedToId?: string
}

export type FollowUp = {
  id: string
  dueAt: string
  status: FollowUpStatus
  notes?: string | null
  completedAt?: string | null
  leadId?: string | null
  lead?: CustomerSourceLead | null
  customerId?: string | null
  customer?: Pick<Customer, "id" | "fullName" | "phone" | "status"> | null
  assignedToId?: string | null
  assignedTo?: LeadUser | null
  createdById?: string | null
  createdBy?: LeadUser | null
  createdAt: string
  updatedAt: string
}

export type CreateFollowUpInput = {
  dueAt: string
  status?: FollowUpStatus
  notes?: string
  completedAt?: string
  leadId?: string
  customerId?: string
  assignedToId?: string
}

export type UpdateFollowUpInput = Partial<CreateFollowUpInput>

export type ActivityEvent = {
  id: string
  action: string
  targetType: string
  targetId: string
  actorId?: string | null
  actor?: LeadUser | null
  metadata?: Record<string, unknown> | null
  occurredAt: string
}

export type BookingJourneyRecord = BookingSummary & {
  payments: BookingPayment[]
  kyc?: BookingKyc
}

export type TimelineCategory =
  | "Lead"
  | "Follow-up"
  | "Customer"
  | "Plot Block"
  | "Booking"
  | "Payment"
  | "KYC"
  | "Site Visit"
  | "System Activity"

export type TimelineFilter = "all" | "leads" | "follow-ups" | "bookings" | "site-visits" | "other"

export type TimelineEvent = {
  id: string
  timestamp: string
  category: TimelineCategory
  filter: TimelineFilter
  title: string
  description: string
  status?: string
  actor?: string
  sourceType: string
  sourceId: string
  metadata?: Record<string, unknown>
  related?: string[]
}

export type CustomerJourney = {
  customer: Customer
  leads: Lead[]
  followUps: FollowUp[]
  siteVisits: SiteVisit[]
  bookings: BookingJourneyRecord[]
  activityEvents: ActivityEvent[]
  timeline: TimelineEvent[]
  warnings: string[]
}

export function getCustomers(token: string) {
  return apiRequest<Customer[]>("/customers", { token })
}

export function getCustomer(token: string, customerId: string) {
  return apiRequest<Customer>(`/customers/${customerId}`, { token })
}

export function createCustomer(token: string, input: CreateCustomerInput) {
  return apiRequest<Customer>("/customers", {
    method: "POST",
    token,
    body: cleanInput(input),
  })
}

export function getFollowUps(token: string) {
  return apiRequest<FollowUp[]>("/follow-ups", { token })
}

export function createFollowUp(token: string, input: CreateFollowUpInput) {
  return apiRequest<FollowUp>("/follow-ups", {
    method: "POST",
    token,
    body: cleanInput(input),
  })
}

export function updateFollowUp(
  token: string,
  followUpId: string,
  input: UpdateFollowUpInput
) {
  return apiRequest<FollowUp>(`/follow-ups/${followUpId}`, {
    method: "PATCH",
    token,
    body: cleanInput(input),
  })
}

export function getActivityEvents(
  token: string,
  query: {
    targetType?: string
    targetId?: string
    take?: number
  } = {}
) {
  const params = new URLSearchParams()

  if (query.targetType) {
    params.set("targetType", query.targetType)
  }

  if (query.targetId) {
    params.set("targetId", query.targetId)
  }

  if (query.take) {
    params.set("take", String(query.take))
  }

  const suffix = params.toString() ? `?${params.toString()}` : ""

  return apiRequest<ActivityEvent[]>(`/activity-events${suffix}`, { token })
}

export async function getCustomerJourney(
  token: string,
  customerId: string,
  role: UserRole
): Promise<CustomerJourney> {
  const customer = await getCustomer(token, customerId)
  const warnings: string[] = []

  const [leadsResult, followUpsResult, siteVisitsResult] = await Promise.allSettled([
    getLeadsForRole(token, role),
    getFollowUps(token),
    getSiteVisits(token),
  ])

  const relatedLeadIds = new Set(
    [customer.sourceLeadId, customer.sourceLead?.id].filter(isStringValue)
  )

  const leads =
    leadsResult.status === "fulfilled"
      ? leadsResult.value.filter((lead) => isRelatedLead(lead, customer, relatedLeadIds))
      : []

  if (leadsResult.status === "rejected") {
    warnings.push("Lead activity could not be loaded.")
  }

  for (const lead of leads) {
    relatedLeadIds.add(lead.id)
  }

  const followUps =
    followUpsResult.status === "fulfilled"
      ? followUpsResult.value.filter((followUp) =>
          isRelatedFollowUp(followUp, customer.id, relatedLeadIds)
        )
      : []

  if (followUpsResult.status === "rejected") {
    warnings.push("Follow-up activity could not be loaded.")
  }

  const siteVisits =
    siteVisitsResult.status === "fulfilled"
      ? siteVisitsResult.value.filter((siteVisit) =>
          isRelatedSiteVisit(siteVisit, customer.id, relatedLeadIds)
        )
      : []

  if (siteVisitsResult.status === "rejected") {
    warnings.push("Site visit activity could not be loaded.")
  }

  const bookingSummaries = getBookingsFromLeads(
    leadsResult.status === "fulfilled" ? leadsResult.value : leads
  ).filter((booking) => isRelatedBooking(booking, customer.id, relatedLeadIds))

  const bookings = await loadBookingLifecycle(token, bookingSummaries, warnings)
  const activityEvents =
    role === "ADMIN"
      ? await loadActivityEvents(token, customer, relatedLeadIds, bookings, warnings)
      : []

  return {
    customer,
    leads,
    followUps,
    siteVisits,
    bookings,
    activityEvents,
    timeline: normalizeCustomerJourneyTimeline({
      customer,
      leads,
      followUps,
      siteVisits,
      bookings,
      activityEvents,
    }),
    warnings,
  }
}

export function normalizeCustomerJourneyTimeline(input: {
  customer: Customer
  leads: Lead[]
  followUps: FollowUp[]
  siteVisits: SiteVisit[]
  bookings: BookingJourneyRecord[]
  activityEvents: ActivityEvent[]
}) {
  const events: TimelineEvent[] = [
    ...getCustomerTimelineEvents(input.customer),
    ...input.leads.flatMap(getLeadTimelineEvents),
    ...input.followUps.flatMap(getFollowUpTimelineEvents),
    ...input.bookings.flatMap(getBookingTimelineEvents),
    ...input.siteVisits.flatMap(getSiteVisitTimelineEvents),
    ...input.activityEvents.map(getSystemActivityTimelineEvent),
  ]

  return dedupeTimeline(events).sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

async function getLeadsForRole(token: string, role: UserRole) {
  return role === "ADMIN" ? getLeads(token) : getMyLeads(token)
}

async function loadBookingLifecycle(
  token: string,
  bookings: BookingSummary[],
  warnings: string[]
): Promise<BookingJourneyRecord[]> {
  const entries = await Promise.all(
    bookings.map(async (booking) => {
      const [paymentsResult, kycResult] = await Promise.allSettled([
        getBookingPayments(token, booking.id),
        getBookingKyc(token, booking.id),
      ])

      if (paymentsResult.status === "rejected") {
        warnings.push(`Payment records for ${formatShortId(booking.id)} could not be loaded.`)
      }

      if (kycResult.status === "rejected") {
        warnings.push(`KYC activity for ${formatShortId(booking.id)} could not be loaded.`)
      }

      return {
        ...booking,
        payments: paymentsResult.status === "fulfilled" ? paymentsResult.value : [],
        kyc: kycResult.status === "fulfilled" ? kycResult.value : undefined,
      }
    })
  )

  return entries
}

async function loadActivityEvents(
  token: string,
  customer: Customer,
  relatedLeadIds: Set<string>,
  bookings: BookingJourneyRecord[],
  warnings: string[]
) {
  const queries = [
    { targetType: "Customer", targetId: customer.id },
    ...Array.from(relatedLeadIds).map((targetId) => ({
      targetType: "Lead",
      targetId,
    })),
    ...bookings.map((booking) => ({
      targetType: "Booking",
      targetId: booking.id,
    })),
  ]

  const results = await Promise.allSettled(
    queries.map((query) => getActivityEvents(token, { ...query, take: 100 }))
  )

  const events: ActivityEvent[] = []

  for (const result of results) {
    if (result.status === "fulfilled") {
      events.push(...result.value)
    } else {
      warnings.push("Some system activity events could not be loaded.")
    }
  }

  return events
}

function getCustomerTimelineEvents(customer: Customer): TimelineEvent[] {
  return [
    {
      id: `customer-created-${customer.id}`,
      timestamp: customer.createdAt,
      category: "Customer",
      filter: "other",
      title: "Customer record created",
      description: `${customer.fullName} entered the customer pipeline.`,
      status: customer.status,
      actor: customer.createdBy?.name,
      sourceType: "Customer",
      sourceId: customer.id,
    },
    ...(customer.convertedAt
      ? [
          {
            id: `customer-converted-${customer.id}`,
            timestamp: customer.convertedAt,
            category: "Customer" as const,
            filter: "other" as const,
            title: "Customer converted from lead",
            description: customer.sourceLead
              ? `Converted from lead ${customer.sourceLead.fullName}.`
              : "Converted from a lead record.",
            status: customer.status,
            actor: customer.assignedTo?.name,
            sourceType: "Customer",
            sourceId: customer.id,
          },
        ]
      : []),
    {
      id: `customer-updated-${customer.id}`,
      timestamp: customer.updatedAt,
      category: "Customer",
      filter: "other",
      title: "Customer status updated",
      description: `Current customer status is ${formatEnum(customer.status)}.`,
      status: customer.status,
      actor: customer.assignedTo?.name,
      sourceType: "Customer",
      sourceId: customer.id,
    },
  ]
}

function getLeadTimelineEvents(lead: Lead): TimelineEvent[] {
  return [
    {
      id: `lead-created-${lead.id}`,
      timestamp: lead.createdAt,
      category: "Lead",
      filter: "leads",
      title: "Lead created",
      description: `${lead.fullName} was captured as a lead from ${formatEnum(lead.source ?? "OTHER")}.`,
      status: lead.status,
      actor: lead.createdBy?.name,
      sourceType: "Lead",
      sourceId: lead.id,
    },
    ...(lead.assignedTo
      ? [
          {
            id: `lead-assigned-${lead.id}`,
            timestamp: lead.updatedAt,
            category: "Lead" as const,
            filter: "leads" as const,
            title: "Lead assigned to sales executive",
            description: `Assigned to ${lead.assignedTo.name}.`,
            status: lead.status,
            actor: lead.assignedTo.name,
            sourceType: "Lead",
            sourceId: lead.id,
          },
        ]
      : []),
    {
      id: `lead-status-${lead.id}`,
      timestamp: lead.updatedAt,
      category: "Lead",
      filter: "leads",
      title: "Lead status updated",
      description: `Current lead status is ${formatEnum(lead.status)}.`,
      status: lead.status,
      actor: lead.assignedTo?.name,
      sourceType: "Lead",
      sourceId: lead.id,
    },
  ]
}

function getFollowUpTimelineEvents(followUp: FollowUp): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: `follow-up-created-${followUp.id}`,
      timestamp: followUp.createdAt,
      category: "Follow-up",
      filter: "follow-ups",
      title: "Follow-up scheduled",
      description: `Due ${formatDateTime(followUp.dueAt)}${followUp.notes ? ` - ${followUp.notes}` : ""}.`,
      status: followUp.status,
      actor: followUp.assignedTo?.name ?? followUp.createdBy?.name,
      sourceType: "FollowUp",
      sourceId: followUp.id,
      metadata: { followUpStatus: followUp.status },
    },
  ]

  if (followUp.completedAt) {
    events.push({
      id: `follow-up-completed-${followUp.id}`,
      timestamp: followUp.completedAt,
      category: "Follow-up",
      filter: "follow-ups",
      title: "Follow-up completed",
      description: followUp.notes ?? "Follow-up was completed.",
      status: followUp.status,
      actor: followUp.assignedTo?.name,
      sourceType: "FollowUp",
      sourceId: followUp.id,
      metadata: { followUpStatus: followUp.status },
    })
  } else if (followUp.status === "CANCELLED") {
    events.push({
      id: `follow-up-cancelled-${followUp.id}`,
      timestamp: followUp.updatedAt,
      category: "Follow-up",
      filter: "follow-ups",
      title: "Follow-up cancelled",
      description: followUp.notes ?? "Follow-up was cancelled.",
      status: followUp.status,
      actor: followUp.assignedTo?.name,
      sourceType: "FollowUp",
      sourceId: followUp.id,
      metadata: { followUpStatus: followUp.status },
    })
  }

  return events
}

function getBookingTimelineEvents(booking: BookingJourneyRecord): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: `booking-created-${booking.id}`,
      timestamp: booking.createdAt ?? booking.bookingDate,
      category: booking.type === "BLOCKED" ? "Plot Block" : "Booking",
      filter: "bookings",
      title: booking.type === "BLOCKED" ? "Plot blocked" : "Booking created",
      description: `${booking.project?.projectName ?? "Project"} plot ${booking.plot?.plotNumber ?? "not set"} was ${booking.type === "BLOCKED" ? "blocked" : "booked"}.`,
      status: booking.status,
      actor: booking.salesExecutive?.name,
      sourceType: "Booking",
      sourceId: booking.id,
      related: [formatBookingReference(booking.id)],
    },
    ...booking.payments.map((payment) => ({
      id: `payment-created-${payment.id}`,
      timestamp: payment.paidAt ?? payment.createdAt,
      category: "Payment" as const,
      filter: "bookings" as const,
      title: "Payment record added",
      description: `${formatCurrency(payment.amount)} by ${formatEnum(payment.method)}.`,
      status: payment.status,
      actor: payment.receivedBy?.name,
      sourceType: "BookingPayment",
      sourceId: payment.id,
      related: [formatBookingReference(booking.id)],
    })),
  ]

  if (booking.kyc) {
    const kycTimestamp =
      booking.kyc.verifiedAt ??
      booking.kyc.rejectedAt ??
      booking.kyc.submittedAt ??
      booking.kyc.updatedAt

    events.push({
      id: `kyc-${booking.kyc.id}-${booking.kyc.status}`,
      timestamp: kycTimestamp,
      category: "KYC",
      filter: "bookings",
      title: getKycTitle(booking.kyc.status),
      description: booking.kyc.rejectionReason ?? booking.kyc.notes ?? "KYC status was recorded.",
      status: booking.kyc.status,
      actor: booking.kyc.verifiedBy?.name ?? booking.kyc.rejectedBy?.name,
      sourceType: "BookingKyc",
      sourceId: booking.kyc.id,
      related: [formatBookingReference(booking.id)],
    })
  }

  if (booking.cancelledAt) {
    events.push({
      id: `booking-cancelled-${booking.id}`,
      timestamp: booking.cancelledAt,
      category: "Booking",
      filter: "bookings",
      title: "Booking cancelled",
      description: booking.cancellationReason ?? "Booking was cancelled.",
      status: "CANCELLED",
      actor: booking.salesExecutive?.name,
      sourceType: "Booking",
      sourceId: booking.id,
    })
  }

  if (booking.closedAt) {
    events.push({
      id: `booking-closed-${booking.id}`,
      timestamp: booking.closedAt,
      category: "Booking",
      filter: "bookings",
      title: "Sale closed",
      description: booking.closureNotes ?? "Booking was closed as a completed sale.",
      status: "CLOSED",
      actor: booking.salesExecutive?.name,
      sourceType: "Booking",
      sourceId: booking.id,
    })
  }

  return events
}

function getSiteVisitTimelineEvents(siteVisit: SiteVisit): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: `site-visit-created-${siteVisit.id}`,
      timestamp: siteVisit.createdAt ?? siteVisit.scheduledAt,
      category: "Site Visit",
      filter: "site-visits",
      title: "Site visit scheduled",
      description: `Scheduled for ${formatDateTime(siteVisit.scheduledAt)}${siteVisit.project ? ` at ${siteVisit.project.projectName}` : ""}.`,
      status: siteVisit.status,
      actor: siteVisit.assignedTo?.name ?? siteVisit.createdBy?.name,
      sourceType: "SiteVisit",
      sourceId: siteVisit.id,
    },
  ]

  if (siteVisit.startedAt) {
    events.push({
      id: `site-visit-started-${siteVisit.id}`,
      timestamp: siteVisit.startedAt,
      category: "Site Visit",
      filter: "site-visits",
      title: "Site visit started",
      description: siteVisit.project
        ? `Visit started at ${siteVisit.project.projectName}.`
        : "Site visit was started.",
      status: siteVisit.status,
      actor: siteVisit.startedBy?.name,
      sourceType: "SiteVisit",
      sourceId: siteVisit.id,
    })
  }

  if (siteVisit.completedAt) {
    events.push({
      id: `site-visit-completed-${siteVisit.id}`,
      timestamp: siteVisit.completedAt,
      category: "Site Visit",
      filter: "site-visits",
      title: "Site visit completed",
      description: siteVisit.outcomeNotes ?? "Site visit was completed.",
      status: siteVisit.status,
      actor: siteVisit.completedBy?.name,
      sourceType: "SiteVisit",
      sourceId: siteVisit.id,
    })
  }

  if (siteVisit.cancelledAt) {
    events.push({
      id: `site-visit-cancelled-${siteVisit.id}`,
      timestamp: siteVisit.cancelledAt,
      category: "Site Visit",
      filter: "site-visits",
      title: "Site visit cancelled",
      description: siteVisit.cancellationReason ?? "Site visit was cancelled.",
      status: siteVisit.status,
      actor: siteVisit.cancelledBy?.name,
      sourceType: "SiteVisit",
      sourceId: siteVisit.id,
    })
  }

  return events
}

function getSystemActivityTimelineEvent(event: ActivityEvent): TimelineEvent {
  return {
    id: `activity-${event.id}`,
    timestamp: event.occurredAt,
    category: "System Activity",
    filter: "other",
    title: getActivityTitle(event.action),
    description: getActivityDescription(event),
    status: getMetadataString(event.metadata, "status"),
    actor: event.actor?.name,
    sourceType: event.targetType,
    sourceId: event.targetId,
    metadata: event.metadata ?? undefined,
  }
}

function isRelatedLead(
  lead: Lead,
  customer: Customer,
  relatedLeadIds: Set<string>
) {
  return (
    relatedLeadIds.has(lead.id) ||
    lead.phone === customer.phone ||
    Boolean(lead.email && customer.email && lead.email === customer.email)
  )
}

function isRelatedFollowUp(
  followUp: FollowUp,
  customerId: string,
  relatedLeadIds: Set<string>
) {
  return (
    followUp.customerId === customerId ||
    Boolean(followUp.leadId && relatedLeadIds.has(followUp.leadId))
  )
}

function isRelatedSiteVisit(
  siteVisit: SiteVisit,
  customerId: string,
  relatedLeadIds: Set<string>
) {
  return (
    siteVisit.customer?.id === customerId ||
    Boolean(siteVisit.lead?.id && relatedLeadIds.has(siteVisit.lead.id))
  )
}

function isRelatedBooking(
  booking: BookingSummary,
  customerId: string,
  relatedLeadIds: Set<string>
) {
  return (
    booking.customerId === customerId ||
    Boolean(booking.leadId && relatedLeadIds.has(booking.leadId))
  )
}

function dedupeTimeline(events: TimelineEvent[]) {
  const seen = new Set<string>()

  return events.filter((event) => {
    const key = [
      event.sourceType,
      event.sourceId,
      event.title,
      event.status ?? "",
    ].join(":")

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function cleanInput<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ])
      .filter(([, value]) => value !== "" && value !== undefined)
  )
}

function getActivityTitle(action: string) {
  const labels: Record<string, string> = {
    "lead.created": "Lead created",
    "lead.assigned": "Lead assigned to sales executive",
    "lead.updated": "Lead status updated",
    "customer.created": "Customer record created",
    "customer.updated": "Customer status updated",
    "follow_up.created": "Follow-up scheduled",
    "follow_up.completed": "Follow-up completed",
    "follow_up.cancelled": "Follow-up cancelled",
    "booking.created": "Booking created",
    "booking.cancelled": "Booking cancelled",
    "booking.closed": "Sale closed",
    "payment.created": "Payment record added",
    "kyc.updated": "KYC activity updated",
    "site_visit.created": "Site visit scheduled",
    "site_visit.started": "Site visit started",
    "site_visit.completed": "Site visit completed",
    "site_visit.cancelled": "Site visit cancelled",
  }

  return labels[action] ?? formatEnum(action.replaceAll(".", "_"))
}

function getActivityDescription(event: ActivityEvent) {
  const status = getMetadataString(event.metadata, "status")
  const bookingId = getMetadataString(event.metadata, "bookingId")
  const plotId = getMetadataString(event.metadata, "plotId")
  const parts = [
    status ? `Status ${formatEnum(status)}` : null,
    bookingId ? `Booking ${formatShortId(bookingId)}` : null,
    plotId ? `Plot ${formatShortId(plotId)}` : null,
  ].filter(isStringValue)

  return parts.length > 0
    ? parts.join(" - ")
    : `System activity recorded for ${event.targetType}.`
}

function getKycTitle(status: BookingKyc["status"]) {
  if (status === "VERIFIED") {
    return "KYC verified"
  }

  if (status === "REJECTED") {
    return "KYC rejected"
  }

  if (status === "PENDING") {
    return "KYC submitted"
  }

  return "KYC record created"
}

function getMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key]

  return typeof value === "string" ? value : undefined
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatCurrency(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "Not set"
  }

  const numericValue = Number(value)

  if (Number.isNaN(numericValue)) {
    return String(value)
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(numericValue)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatBookingReference(id: string) {
  return `Booking ${formatShortId(id)}`
}

function formatShortId(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`
}

function isStringValue(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}
