import { apiRequest } from "@/lib/api"
import type { LeadProject, LeadUser } from "@/lib/leads"

export type SiteVisitStatus = "SCHEDULED" | "STARTED" | "COMPLETED" | "CANCELLED"

export type Vehicle = {
  id: string
  registrationNumber: string
  name?: string | null
  type?: string | null
  capacity?: number | null
  notes?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type Driver = {
  id: string
  fullName: string
  phone: string
  licenseNumber?: string | null
  notes?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type SiteVisit = {
  id: string
  scheduledAt: string
  status: SiteVisitStatus
  startedAt?: string | null
  completedAt?: string | null
  cancelledAt?: string | null
  cancellationReason?: string | null
  outcomeNotes?: string | null
  notes?: string | null
  lead?: {
    id: string
    fullName: string
    phone: string
    status: string
  } | null
  customer?: {
    id: string
    fullName: string
    phone: string
    status: string
  } | null
  project?: LeadProject | null
  booking?: {
    id: string
    type: string
    status: string
    bookingDate: string
  } | null
  vehicle?: Vehicle | null
  driver?: Driver | null
  assignedTo?: LeadUser | null
  createdBy?: LeadUser | null
}

export type CreateSiteVisitInput = {
  scheduledAt: string
  notes?: string
  leadId?: string
  customerId?: string
  projectId?: string
  bookingId?: string
  vehicleId?: string
  driverId?: string
  assignedToId?: string
}

export type CreateVehicleInput = {
  registrationNumber: string
  name?: string
  type?: string
  capacity?: string | number
  notes?: string
}

export type CreateDriverInput = {
  fullName: string
  phone: string
  licenseNumber?: string
  notes?: string
}

export function getSiteVisits(token: string) {
  return apiRequest<SiteVisit[]>("/site-visits", { token })
}

export function createSiteVisit(token: string, input: CreateSiteVisitInput) {
  return apiRequest<SiteVisit>("/site-visits", {
    method: "POST",
    token,
    body: cleanInput(input),
  })
}

export function startSiteVisit(token: string, visitId: string) {
  return apiRequest<SiteVisit>(`/site-visits/${visitId}/start`, {
    method: "PATCH",
    token,
  })
}

export function completeSiteVisit(
  token: string,
  visitId: string,
  outcomeNotes?: string
) {
  return apiRequest<SiteVisit>(`/site-visits/${visitId}/complete`, {
    method: "PATCH",
    token,
    body: cleanInput({ outcomeNotes }),
  })
}

export function cancelSiteVisit(
  token: string,
  visitId: string,
  cancellationReason: string
) {
  return apiRequest<SiteVisit>(`/site-visits/${visitId}/cancel`, {
    method: "PATCH",
    token,
    body: cleanInput({ cancellationReason }),
  })
}

export function getVehicles(token: string) {
  return apiRequest<Vehicle[]>("/vehicles", { token })
}

export function createVehicle(token: string, input: CreateVehicleInput) {
  return apiRequest<Vehicle>("/vehicles", {
    method: "POST",
    token,
    body: cleanInput(input),
  })
}

export function getDrivers(token: string) {
  return apiRequest<Driver[]>("/drivers", { token })
}

export function createDriver(token: string, input: CreateDriverInput) {
  return apiRequest<Driver>("/drivers", {
    method: "POST",
    token,
    body: cleanInput(input),
  })
}

function cleanInput(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input)
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ])
      .filter(([, value]) => value !== "" && value !== undefined)
  )
}
