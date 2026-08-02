import { apiRequest } from "@/lib/api"

export type LeadStatus =
  | "NEW"
  | "FOLLOW_UP"
  | "SITE_VISIT"
  | "NEGOTIATION"
  | "BLOCKED"
  | "BOOKED"
  | "CANCELLED"

export type LeadSource =
  | "SE_GENERATED"
  | "ADMIN_GENERATED"
  | "WEBSITE"
  | "REFERRAL"
  | "WALK_IN"
  | "PHONE_CALL"
  | "SOCIAL_MEDIA"
  | "OTHER"

export type LeadUser = {
  id: string
  name: string
  email: string
  role:
    | "ADMIN"
    | "SALES_EXECUTIVE"
    | "PROJECT_INVENTORY_MANAGER"
    | "SITE_VISIT_COORDINATOR"
}

export type LeadProject = {
  id: string
  projectName: string
  location: string
}

export type LeadPlot = {
  id: string
  plotNumber: string
  size?: string | null
  facing?: string | null
  price?: string | number | null
  status?: string
}

export type LeadBooking = {
  id: string
  type: "BOOKED" | "BLOCKED"
  amountPaid?: string | number | null
  bookingDate: string
  project?: LeadProject | null
  plot?: LeadPlot | null
  salesExecutive?: Pick<LeadUser, "id" | "name" | "email"> | null
}

export type Lead = {
  id: string
  fullName: string
  phone: string
  email?: string | null
  propertyType?: string | null
  budget?: string | null
  location?: string | null
  source?: LeadSource | null
  status: LeadStatus
  notes?: string | null
  remarks?: string | null
  followUpDate?: string | null
  interestedProjectIds: string[]
  finalProjectId?: string | null
  finalProject?: LeadProject | null
  finalPlotId?: string | null
  finalPlot?: LeadPlot | null
  bookingAmount?: string | number | null
  bookingDate?: string | null
  bookings?: LeadBooking[]
  createdById?: string | null
  createdBy?: LeadUser | null
  assignedToId?: string | null
  assignedTo?: LeadUser | null
  createdAt: string
  updatedAt: string
}

export type LeadFormInput = {
  fullName: string
  phone: string
  email?: string
  propertyType?: string
  budget?: string
  location?: string
  source?: LeadSource
  notes?: string
  remarks?: string
  followUpDate?: string
  assignedToId?: string
}

export type LeadProgressInput = {
  status?: LeadStatus
  followUpDate?: string
  remarks?: string
  interestedProjectIds?: string[]
}

export const LEAD_STATUSES: Array<{ value: LeadStatus; label: string }> = [
  { value: "NEW", label: "New" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "SITE_VISIT", label: "Site Visit" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "BOOKED", label: "Booked" },
  { value: "CANCELLED", label: "Cancelled" },
]

export const LEAD_SOURCES: Array<{ value: LeadSource; label: string }> = [
  { value: "SE_GENERATED", label: "Sales generated" },
  { value: "ADMIN_GENERATED", label: "Company generated" },
  { value: "WEBSITE", label: "Website" },
  { value: "REFERRAL", label: "Referral" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "PHONE_CALL", label: "Phone call" },
  { value: "SOCIAL_MEDIA", label: "Social media" },
  { value: "OTHER", label: "Other" },
]

export function getLeads(token: string) {
  return apiRequest<Lead[]>("/leads", { token })
}

export function getMyLeads(token: string) {
  return apiRequest<Lead[]>("/leads/my", { token })
}

export function createLead(token: string, input: LeadFormInput) {
  return apiRequest<Lead>("/leads", {
    method: "POST",
    token,
    body: cleanLeadInput(input),
  })
}

export function updateLead(
  token: string,
  leadId: string,
  input: Omit<LeadFormInput, "assignedToId">
) {
  return apiRequest<Lead>(`/leads/${leadId}`, {
    method: "PATCH",
    token,
    body: cleanLeadInput(input),
  })
}

export function deleteLead(token: string, leadId: string) {
  return apiRequest<{ message: string }>(`/leads/${leadId}`, {
    method: "DELETE",
    token,
  })
}

export function assignLead(token: string, leadId: string, assignedToId: string) {
  return apiRequest<Lead>(`/leads/${leadId}/assign`, {
    method: "PATCH",
    token,
    body: { assignedToId },
  })
}

export function updateLeadStatus(
  token: string,
  leadId: string,
  input: LeadStatus | LeadProgressInput
) {
  return apiRequest<Lead>(`/leads/${leadId}/status`, {
    method: "PATCH",
    token,
    body:
      typeof input === "string"
        ? { status: input }
        : cleanLeadProgressInput(input),
  })
}

function cleanLeadInput(input: LeadFormInput) {
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ])
      .filter(([, value]) => value !== "" && value !== undefined)
  )
}

function cleanLeadProgressInput(input: LeadProgressInput) {
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ])
      .filter(([, value]) => value !== "" && value !== undefined)
  )
}
