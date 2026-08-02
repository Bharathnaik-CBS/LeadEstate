import { ApiError, apiRequest } from "@/lib/api"
import { getMyLeads, type Lead, type LeadBooking } from "@/lib/leads"

export type BookingType = "BLOCKED" | "BOOKED"
export type BookingStatus = "ACTIVE" | "CANCELLED" | "CLOSED"
export type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "UPI"
  | "CHEQUE"
  | "CARD"
  | "OTHER"
export type PaymentStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
export type BookingKycStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"

export type BookingPerson = {
  id: string
  name: string
  email: string
}

export type BookingContact = {
  id: string
  fullName: string
  phone: string
  email?: string | null
  status?: string | null
}

export type BookingProject = {
  id: string
  projectName: string
  location: string
}

export type BookingPlot = {
  id: string
  plotNumber: string
  size?: string | null
  facing?: string | null
  price?: string | number | null
  status?: string | null
}

export type BookingSummary = {
  id: string
  type: BookingType
  status: BookingStatus
  amountPaid?: string | number | null
  bookingDate: string
  leadId?: string | null
  customerId?: string | null
  projectId?: string
  plotId?: string
  salesExecutiveId?: string
  cancelledAt?: string | null
  cancellationReason?: string | null
  closedAt?: string | null
  closureNotes?: string | null
  createdAt?: string
  updatedAt?: string
  lead?: BookingContact | null
  customer?: BookingContact | null
  project?: BookingProject | null
  plot?: BookingPlot | null
  salesExecutive?: BookingPerson | null
}

export type BookingPayment = {
  id: string
  bookingId: string
  receivedById?: string | null
  receivedBy?: BookingPerson | null
  amount: string | number
  method: PaymentMethod
  status: PaymentStatus
  paidAt?: string | null
  referenceNumber?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type BookingKyc = {
  id: string
  bookingId: string
  status: BookingKycStatus
  submittedAt?: string | null
  verifiedAt?: string | null
  verifiedById?: string | null
  verifiedBy?: BookingPerson | null
  rejectedAt?: string | null
  rejectedById?: string | null
  rejectedBy?: BookingPerson | null
  rejectionReason?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export type BookingDetail = BookingSummary & {
  payments: BookingPayment[]
  kyc: BookingKyc
}

export type CreateBookingPaymentInput = {
  amount: string | number
  method: PaymentMethod
  status?: PaymentStatus
  paymentDate?: string
  referenceNumber?: string
  notes?: string
}

export type UpdateBookingKycInput = {
  status?: BookingKycStatus
  notes?: string
  rejectionReason?: string
}

export type CancelBookingInput = {
  cancellationReason: string
}

export type CloseSaleInput = {
  closureNotes?: string
}

export async function listBookings(token: string) {
  const leads = await getMyLeads(token)

  return getBookingsFromLeads(leads)
}

export function getBookingsFromLeads(leads: Lead[]) {
  return leads
    .flatMap((lead) =>
      (lead.bookings ?? []).map((booking) => toBookingSummary(lead, booking))
    )
    .sort(
      (a, b) =>
        new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
    )
}

export async function getBooking(token: string, bookingId: string) {
  const bookings = await listBookings(token)
  const booking = bookings.find((item) => item.id === bookingId)

  if (!booking) {
    throw new ApiError(
      "Booking was not found in your assigned booking list.",
      404
    )
  }

  const [payments, kyc] = await Promise.all([
    getBookingPayments(token, bookingId),
    getBookingKyc(token, bookingId),
  ])

  return {
    ...booking,
    payments,
    kyc,
  }
}

export function getBookingPayments(token: string, bookingId: string) {
  return apiRequest<BookingPayment[]>(`/bookings/${bookingId}/payments`, {
    token,
  })
}

export function getBookingKyc(token: string, bookingId: string) {
  return apiRequest<BookingKyc>(`/bookings/${bookingId}/kyc`, { token })
}

export function recordBookingPayment(
  token: string,
  bookingId: string,
  input: CreateBookingPaymentInput
) {
  return apiRequest<BookingPayment>(`/bookings/${bookingId}/payments`, {
    method: "POST",
    token,
    body: cleanInput(input),
  })
}

export function updateBookingKyc(
  token: string,
  bookingId: string,
  input: UpdateBookingKycInput
) {
  return apiRequest<BookingKyc>(`/bookings/${bookingId}/kyc`, {
    method: "PATCH",
    token,
    body: cleanInput(input),
  })
}

export function cancelBooking(
  token: string,
  bookingId: string,
  input: CancelBookingInput
) {
  return apiRequest<BookingSummary>(`/bookings/${bookingId}/cancel`, {
    method: "PATCH",
    token,
    body: cleanInput(input),
  })
}

export function closeSale(
  token: string,
  bookingId: string,
  input: CloseSaleInput
) {
  return apiRequest<BookingSummary>(`/bookings/${bookingId}/close-sale`, {
    method: "PATCH",
    token,
    body: cleanInput(input),
  })
}

export function getCompletedPaymentTotal(payments: BookingPayment[]) {
  return payments
    .filter((payment) => payment.status === "COMPLETED")
    .reduce((total, payment) => total + toNumber(payment.amount), 0)
}

function toBookingSummary(lead: Lead, booking: LeadBooking): BookingSummary {
  const finalPlot =
    lead.finalPlot && lead.finalPlot.id === booking.plot?.id
      ? lead.finalPlot
      : null

  return {
    id: booking.id,
    type: booking.type,
    status: booking.status ?? "ACTIVE",
    amountPaid: booking.amountPaid,
    bookingDate: booking.bookingDate,
    leadId: booking.leadId ?? lead.id,
    customerId: booking.customerId,
    projectId: booking.projectId,
    plotId: booking.plotId,
    salesExecutiveId: booking.salesExecutiveId,
    cancelledAt: booking.cancelledAt,
    cancellationReason: booking.cancellationReason,
    closedAt: booking.closedAt,
    closureNotes: booking.closureNotes,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    lead: {
      id: lead.id,
      fullName: lead.fullName,
      phone: lead.phone,
      email: lead.email,
      status: lead.status,
    },
    customer: null,
    project: booking.project ?? lead.finalProject ?? null,
    plot: booking.plot
      ? {
          ...booking.plot,
          size: finalPlot?.size ?? booking.plot.size,
          facing: finalPlot?.facing ?? booking.plot.facing,
          price: finalPlot?.price ?? booking.plot.price,
        }
      : finalPlot,
    salesExecutive: booking.salesExecutive
      ? {
          ...booking.salesExecutive,
        }
      : null,
  }
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

function toNumber(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value)

  return Number.isFinite(amount) ? amount : 0
}
