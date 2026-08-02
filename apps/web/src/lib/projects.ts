import { apiRequest } from "@/lib/api"
import type { Lead, LeadProject, LeadUser } from "@/lib/leads"

export type PlotStatus =
  | "AVAILABLE"
  | "BLOCKED"
  | "BOOKED"
  | "SOLD"
  | "CANCELLED"
export type BookingType = "BOOKED" | "BLOCKED"
export type PlotBlockStatus = "ACTIVE" | "CANCELLED" | "EXPIRED" | "CONVERTED"

export type Plot = {
  id: string
  plotNumber: string
  projectId: string
  size?: string | null
  facing?: string | null
  price?: string | number | null
  status: PlotStatus
  createdAt: string
  updatedAt: string
}

export type Project = LeadProject & {
  description?: string | null
  totalPlots?: number | null
  plots?: Plot[]
  createdAt: string
  updatedAt: string
}

export type CreateProjectInput = {
  projectName: string
  location: string
  description?: string
  totalPlots?: string | number
}

export type CreatePlotInput = {
  plotNumber: string
  size?: string
  facing?: string
  price?: string | number
  status?: PlotStatus
}

export type UpdateProjectInput = Partial<CreateProjectInput>

export type UpdatePlotStatusInput = {
  status: PlotStatus
}

export type UpdatePlotPriceInput = {
  newPrice: string | number
  reason?: string
}

export type ProjectLayoutJson = Record<string, unknown> | unknown[]

export type Booking = {
  id: string
  type: BookingType
  amountPaid?: string | number | null
  bookingDate: string
  lead?: Pick<Lead, "id" | "fullName" | "phone" | "email" | "status"> | null
  project?: LeadProject | null
  plot?: Pick<Plot, "id" | "plotNumber" | "status"> | null
  salesExecutive?: Pick<LeadUser, "id" | "name" | "email"> | null
  createdAt: string
  updatedAt: string
}

export type PlotBlock = {
  id: string
  projectId: string
  plotId: string
  customer?: {
    id: string
    fullName: string
    phone: string
    email?: string | null
  } | null
  blockedBy?: Pick<LeadUser, "id" | "name" | "email"> | null
  status: PlotBlockStatus
  blockedAt: string
  expiresAt?: string | null
  cancelledAt?: string | null
  convertedAt?: string | null
  booking?: Booking | null
  createdAt: string
  updatedAt: string
}

export type PlotPriceHistory = {
  id: string
  plotId: string
  oldPrice?: string | number | null
  newPrice: string | number
  changedById?: string | null
  reason?: string | null
  createdAt: string
}

export type CreateBookingInput = {
  leadId: string
  projectId: string
  plotId: string
  type: BookingType
  amountPaid?: string | number
  bookingDate?: string
}

export function getProjects(token: string) {
  return apiRequest<Project[]>("/projects", { token })
}

export function createProject(token: string, input: CreateProjectInput) {
  return apiRequest<Project>("/projects", {
    method: "POST",
    token,
    body: cleanInput(input),
  })
}

export function updateProject(
  token: string,
  projectId: string,
  input: UpdateProjectInput
) {
  return apiRequest<Project>(`/projects/${projectId}`, {
    method: "PATCH",
    token,
    body: cleanInput(input),
  })
}

export function getProjectPlots(token: string, projectId: string) {
  return apiRequest<Plot[]>(`/projects/${projectId}/plots`, { token })
}

export function getProjectLayout(token: string, projectId: string) {
  return apiRequest<ProjectLayoutJson>(`/projects/${projectId}/layout`, { token })
}

export function updateProjectLayout(
  token: string,
  projectId: string,
  layoutJson: ProjectLayoutJson
) {
  return apiRequest<ProjectLayoutJson>(`/projects/${projectId}/layout`, {
    method: "PUT",
    token,
    body: layoutJson,
  })
}

export function getPlotBlocks(
  token: string,
  projectId: string,
  plotId: string
) {
  return apiRequest<PlotBlock[]>(
    `/projects/${projectId}/plots/${plotId}/blocks`,
    { token }
  )
}

export function createPlot(
  token: string,
  projectId: string,
  input: CreatePlotInput
) {
  return apiRequest<Plot>(`/projects/${projectId}/plots`, {
    method: "POST",
    token,
    body: cleanInput(input),
  })
}

export function updatePlotStatus(
  token: string,
  projectId: string,
  plotId: string,
  input: UpdatePlotStatusInput
) {
  return apiRequest<Plot>(`/projects/${projectId}/plots/${plotId}/status`, {
    method: "PATCH",
    token,
    body: cleanInput(input),
  })
}

export function updatePlotPrice(
  token: string,
  projectId: string,
  plotId: string,
  input: UpdatePlotPriceInput
) {
  return apiRequest<Plot>(`/projects/${projectId}/plots/${plotId}/price`, {
    method: "PATCH",
    token,
    body: cleanInput(input),
  })
}

export function getPlotPriceHistory(
  token: string,
  projectId: string,
  plotId: string
) {
  return apiRequest<PlotPriceHistory[]>(
    `/projects/${projectId}/plots/${plotId}/price-history`,
    { token }
  )
}

export function createBooking(token: string, input: CreateBookingInput) {
  return apiRequest<Booking>("/bookings", {
    method: "POST",
    token,
    body: cleanInput(input),
  })
}

export function getRecentBookings(token: string) {
  return apiRequest<Booking[]>("/bookings/recent", { token })
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
