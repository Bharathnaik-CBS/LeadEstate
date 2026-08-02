import { apiRequest } from "@/lib/api"
import type { LeadUser } from "@/lib/leads"

export type CustomerJourneyStatus = "PROSPECT" | "CUSTOMER" | "LOST"

export type Customer = {
  id: string
  fullName: string
  phone: string
  email?: string | null
  status: CustomerJourneyStatus
  notes?: string | null
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
  assignedToId?: string
}

export function getCustomers(token: string) {
  return apiRequest<Customer[]>("/customers", { token })
}

export function createCustomer(token: string, input: CreateCustomerInput) {
  return apiRequest<Customer>("/customers", {
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
