"use client"

import Link from "next/link"
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import {
  DashboardError,
  DashboardLoading,
} from "@/components/dashboard/dashboard-state"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { getFriendlyApiError } from "@/lib/api"
import { getToken } from "@/lib/auth"
import {
  cancelBooking,
  closeSale,
  getBooking,
  getCompletedPaymentTotal,
  recordBookingPayment,
  updateBookingKyc,
  type BookingDetail,
  type BookingKycStatus,
  type BookingPayment,
  type BookingStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/bookings"
import { formatLocalDateTime } from "@/lib/date"

type PaymentFormState = {
  amount: string
  method: PaymentMethod
  status: PaymentStatus
  paymentDate: string
  referenceNumber: string
  notes: string
}

type KycFormState = {
  status: BookingKycStatus
  notes: string
  rejectionReason: string
}

const initialPaymentForm: PaymentFormState = {
  amount: "",
  method: "UPI",
  status: "COMPLETED",
  paymentDate: new Date().toISOString().slice(0, 10),
  referenceNumber: "",
  notes: "",
}

const initialKycForm: KycFormState = {
  status: "NOT_STARTED",
  notes: "",
  rejectionReason: "",
}

const paymentMethods: PaymentMethod[] = [
  "CASH",
  "BANK_TRANSFER",
  "UPI",
  "CHEQUE",
  "CARD",
  "OTHER",
]

const paymentStatuses: PaymentStatus[] = [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
]

const kycStatuses: BookingKycStatus[] = [
  "NOT_STARTED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
]

export default function SalesBookingDetailPage() {
  return (
    <ProtectedRoute allowedRoles={["SALES_EXECUTIVE"]}>
      {(user) => (
        <DashboardShell
          user={user}
          title="Booking detail"
          description="Manage payments, KYC, cancellation, and sale closure."
        >
          <BookingDetailClient />
        </DashboardShell>
      )}
    </ProtectedRoute>
  )
}

function BookingDetailClient() {
  const params = useParams()
  const bookingId = getParamValue(params.bookingId)
  const token = useMemo(() => getToken(), [])
  const toast = useToast()
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [paymentForm, setPaymentForm] =
    useState<PaymentFormState>(initialPaymentForm)
  const [kycForm, setKycForm] = useState<KycFormState>(initialKycForm)
  const [cancelReason, setCancelReason] = useState("")
  const [closureNotes, setClosureNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [kycError, setKycError] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false)
  const [isKycSubmitting, setIsKycSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false)
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)

  const totalPaid = useMemo(
    () => (booking ? getCompletedPaymentTotal(booking.payments) : 0),
    [booking]
  )
  const plotPrice = booking?.plot?.price
  const outstandingAmount =
    plotPrice === null || plotPrice === undefined
      ? null
      : Math.max(Number(plotPrice) - totalPaid, 0)
  const canCancel = booking?.status === "ACTIVE"
  const canClose = booking?.status === "ACTIVE" && booking.type === "BOOKED"

  const loadBooking = useCallback(async (showLoading = false) => {
    if (!token) {
      setError("Your session has expired. Please log in again.")
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }

    if (!bookingId) {
      setError("Booking ID is missing.")
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }

    if (showLoading) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }
    setError(null)

    try {
      const bookingData = await getBooking(token, bookingId)
      setBooking(bookingData)
      setKycForm({
        status: bookingData.kyc.status,
        notes: bookingData.kyc.notes ?? "",
        rejectionReason: bookingData.kyc.rejectionReason ?? "",
      })
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to load booking")
      setError(message)

      if (!showLoading) {
        toast.error("Unable to refresh booking", message)
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [bookingId, toast, token])

  useEffect(() => {
    void Promise.resolve().then(() => loadBooking(true))
  }, [loadBooking])

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token || !booking) {
      setPaymentError("Your session has expired. Please log in again.")
      return
    }

    const amount = Number(paymentForm.amount)

    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter a payment amount greater than zero.")
      return
    }

    setIsPaymentSubmitting(true)
    setPaymentError(null)

    try {
      await recordBookingPayment(token, booking.id, {
        amount,
        method: paymentForm.method,
        status: paymentForm.status,
        paymentDate: paymentForm.paymentDate,
        referenceNumber: paymentForm.referenceNumber,
        notes: paymentForm.notes,
      })
      setPaymentForm(initialPaymentForm)
      toast.success("Payment recorded", "The booking payment entry was saved.")
      await loadBooking(false)
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to record payment")
      setPaymentError(message)
      toast.error("Unable to record payment", message)
    } finally {
      setIsPaymentSubmitting(false)
    }
  }

  async function handleKycSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token || !booking) {
      setKycError("Your session has expired. Please log in again.")
      return
    }

    setIsKycSubmitting(true)
    setKycError(null)

    try {
      await updateBookingKyc(token, booking.id, {
        status: kycForm.status,
        notes: kycForm.notes,
        rejectionReason: kycForm.rejectionReason,
      })
      toast.success("KYC updated", "The booking KYC record was saved.")
      await loadBooking(false)
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to update KYC")
      setKycError(message)
      toast.error("Unable to update KYC", message)
    } finally {
      setIsKycSubmitting(false)
    }
  }

  async function handleCancelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token || !booking) {
      setCancelError("Your session has expired. Please log in again.")
      return
    }

    if (!canCancel) {
      setCancelError("Only active bookings can be cancelled.")
      return
    }

    if (!cancelReason.trim()) {
      setCancelError("Cancellation reason is required.")
      return
    }

    setIsCancelling(true)
    setCancelError(null)

    try {
      await cancelBooking(token, booking.id, {
        cancellationReason: cancelReason,
      })
      setCancelReason("")
      setIsCancelDialogOpen(false)
      toast.success("Booking cancelled", "The booking status was refreshed.")
      await loadBooking(false)
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to cancel booking")
      setCancelError(message)
      toast.error("Unable to cancel booking", message)
    } finally {
      setIsCancelling(false)
    }
  }

  async function handleCloseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token || !booking) {
      setCloseError("Your session has expired. Please log in again.")
      return
    }

    if (!canClose) {
      setCloseError("Only active booked bookings can be closed as sales.")
      return
    }

    setIsClosing(true)
    setCloseError(null)

    try {
      await closeSale(token, booking.id, { closureNotes })
      setClosureNotes("")
      setIsCloseDialogOpen(false)
      toast.success("Sale closed", "The plot and booking are now closed.")
      await loadBooking(false)
    } catch (err) {
      const message = getFriendlyApiError(err, "Unable to close sale")
      setCloseError(message)
      toast.error("Unable to close sale", message)
    } finally {
      setIsClosing(false)
    }
  }

  function updatePaymentForm<Key extends keyof PaymentFormState>(
    key: Key,
    value: PaymentFormState[Key]
  ) {
    setPaymentError(null)
    setPaymentForm((current) => ({ ...current, [key]: value }))
  }

  function updateKycForm<Key extends keyof KycFormState>(
    key: Key,
    value: KycFormState[Key]
  ) {
    setKycError(null)
    setKycForm((current) => ({ ...current, [key]: value }))
  }

  if (isLoading) {
    return (
      <DashboardLoading
        title="Loading booking detail"
        description="Fetching booking, payment, and KYC records."
        rows={4}
        sections={2}
      />
    )
  }

  if (error || !booking) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline">
          <Link href="/dashboard/sales/booking">
            <ArrowLeft className="size-4" />
            Back to bookings
          </Link>
        </Button>
        <DashboardError
          title="Booking unavailable"
          message={error ?? "Booking could not be loaded."}
          onRetry={() => loadBooking(true)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline" className="w-fit">
          <Link href="/dashboard/sales/booking">
            <ArrowLeft className="size-4" />
            Back to bookings
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isRefreshing}
          aria-busy={isRefreshing}
          onClick={() => loadBooking(false)}
        >
          <RefreshCw
            className={isRefreshing ? "size-4 animate-spin" : "size-4"}
          />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>{formatBookingRef(booking.id)}</CardTitle>
            <CardDescription>
              {formatEnum(booking.type)} created{" "}
              {formatLocalDateTime(booking.createdAt ?? booking.bookingDate)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Booking status">
              <BookingStatusBadge status={booking.status} />
            </DetailField>
            <DetailField label="KYC status">
              <KycStatusBadge status={booking.kyc.status} />
            </DetailField>
            <DetailField
              label="Buyer"
              value={
                booking.lead?.fullName ??
                booking.customer?.fullName ??
                "Buyer not available"
              }
            />
            <DetailField
              label="Contact"
              value={booking.lead?.phone ?? booking.customer?.phone ?? "Not set"}
            />
            {booking.customerId ? (
              <DetailField label="Customer journey">
                <Button asChild variant="outline" size="sm" className="mt-1">
                  <Link
                    href={`/dashboard/sales/customers/${booking.customerId}/journey`}
                  >
                    Open journey
                  </Link>
                </Button>
              </DetailField>
            ) : null}
            <DetailField
              label="Project"
              value={booking.project?.projectName ?? "Not set"}
            />
            <DetailField
              label="Plot"
              value={booking.plot?.plotNumber ?? "Not set"}
            />
            <DetailField
              label="Plot price"
              value={formatCurrency(booking.plot?.price)}
            />
            <DetailField
              label="Initial amount"
              value={formatCurrency(booking.amountPaid)}
            />
            <DetailField label="Payment records total" value={formatCurrency(totalPaid)} />
            <DetailField
              label="Outstanding"
              value={
                outstandingAmount === null
                  ? "Not available"
                  : formatCurrency(outstandingAmount)
              }
            />
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Lifecycle actions</CardTitle>
            <CardDescription>
              Backend validation remains authoritative for each transition.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {canCancel ? (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => {
                  setCancelError(null)
                  setIsCancelDialogOpen(true)
                }}
              >
                Cancel booking
              </Button>
            ) : null}
            {canClose ? (
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setCloseError(null)
                  setIsCloseDialogOpen(true)
                }}
              >
                Close as sale
              </Button>
            ) : (
              <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Sale closure is available only for active booked bookings.
              </p>
            )}
            {booking.status === "CLOSED" ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                This booking is closed and cannot be cancelled.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Record payment</CardTitle>
            <CardDescription>
              Add a payment entry; no payment gateway is involved.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={handlePaymentSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Amount" htmlFor="paymentAmount">
                  <Input
                    id="paymentAmount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={paymentForm.amount}
                    disabled={isPaymentSubmitting}
                    onChange={(event) =>
                      updatePaymentForm("amount", event.target.value)
                    }
                  />
                </Field>
                <Field label="Payment date" htmlFor="paymentDate">
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentForm.paymentDate}
                    disabled={isPaymentSubmitting}
                    onChange={(event) =>
                      updatePaymentForm("paymentDate", event.target.value)
                    }
                  />
                </Field>
                <EnumSelect
                  label="Method"
                  id="paymentMethod"
                  value={paymentForm.method}
                  values={paymentMethods}
                  disabled={isPaymentSubmitting}
                  onChange={(value) =>
                    updatePaymentForm("method", value as PaymentMethod)
                  }
                />
                <EnumSelect
                  label="Status"
                  id="paymentStatus"
                  value={paymentForm.status}
                  values={paymentStatuses}
                  disabled={isPaymentSubmitting}
                  onChange={(value) =>
                    updatePaymentForm("status", value as PaymentStatus)
                  }
                />
              </div>
              <Field label="Reference number" htmlFor="referenceNumber">
                <Input
                  id="referenceNumber"
                  value={paymentForm.referenceNumber}
                  disabled={isPaymentSubmitting}
                  onChange={(event) =>
                    updatePaymentForm("referenceNumber", event.target.value)
                  }
                />
              </Field>
              <Field label="Notes" htmlFor="paymentNotes">
                <Textarea
                  id="paymentNotes"
                  value={paymentForm.notes}
                  disabled={isPaymentSubmitting}
                  onChange={(event) =>
                    updatePaymentForm("notes", event.target.value)
                  }
                />
              </Field>
              {paymentError ? <Alert message={paymentError} /> : null}
              <Button
                type="submit"
                disabled={isPaymentSubmitting}
                aria-busy={isPaymentSubmitting}
              >
                {isPaymentSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {isPaymentSubmitting ? "Recording..." : "Record payment"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>KYC workflow</CardTitle>
            <CardDescription>
              Update status, notes, and rejection reason where needed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={handleKycSubmit}>
              <EnumSelect
                label="KYC status"
                id="kycStatus"
                value={kycForm.status}
                values={kycStatuses}
                disabled={isKycSubmitting}
                onChange={(value) =>
                  updateKycForm("status", value as BookingKycStatus)
                }
              />
              <Field label="Notes" htmlFor="kycNotes">
                <Textarea
                  id="kycNotes"
                  value={kycForm.notes}
                  disabled={isKycSubmitting}
                  onChange={(event) =>
                    updateKycForm("notes", event.target.value)
                  }
                />
              </Field>
              <Field label="Rejection reason" htmlFor="rejectionReason">
                <Input
                  id="rejectionReason"
                  value={kycForm.rejectionReason}
                  disabled={isKycSubmitting || kycForm.status !== "REJECTED"}
                  onChange={(event) =>
                    updateKycForm("rejectionReason", event.target.value)
                  }
                />
              </Field>
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <p>Submitted: {formatLocalDateTime(booking.kyc.submittedAt)}</p>
                <p>Verified: {formatLocalDateTime(booking.kyc.verifiedAt)}</p>
                <p>
                  Verifier:{" "}
                  {booking.kyc.verifiedBy?.name ??
                    booking.kyc.rejectedBy?.name ??
                    "Not set"}
                </p>
                <p>Updated: {formatLocalDateTime(booking.kyc.updatedAt)}</p>
              </div>
              {kycError ? <Alert message={kycError} /> : null}
              <Button
                type="submit"
                variant="outline"
                disabled={isKycSubmitting}
                aria-busy={isKycSubmitting}
              >
                {isKycSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {isKycSubmitting ? "Saving..." : "Update KYC"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Payment records</CardTitle>
          <CardDescription>
            {booking.payments.length} payment entries recorded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {booking.payments.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 p-6 text-sm text-muted-foreground">
              No payment records have been added yet.
            </p>
          ) : (
            <Table aria-label="Booking payment records" className="min-w-[920px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid at</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Received by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {booking.payments.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Terminal state details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <DetailField
            label="Cancelled at"
            value={formatLocalDateTime(booking.cancelledAt)}
          />
          <DetailField
            label="Cancellation reason"
            value={booking.cancellationReason ?? "Not set"}
          />
          <DetailField
            label="Closed at"
            value={formatLocalDateTime(booking.closedAt)}
          />
          <DetailField
            label="Closure notes"
            value={booking.closureNotes ?? "Not set"}
          />
        </CardContent>
      </Card>

      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel booking</DialogTitle>
            <DialogDescription>
              Confirm cancellation by entering the required reason.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleCancelSubmit}>
            <Field label="Cancellation reason" htmlFor="cancelReason">
              <Textarea
                id="cancelReason"
                value={cancelReason}
                disabled={isCancelling}
                onChange={(event) => {
                  setCancelError(null)
                  setCancelReason(event.target.value)
                }}
              />
            </Field>
            {cancelError ? <Alert message={cancelError} /> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isCancelling}
                onClick={() => setIsCancelDialogOpen(false)}
              >
                Keep booking
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isCancelling}
                aria-busy={isCancelling}
              >
                {isCancelling ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {isCancelling ? "Cancelling..." : "Confirm cancellation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close sale</DialogTitle>
            <DialogDescription>
              Confirm this active booked booking as a completed sale.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleCloseSubmit}>
            <Field label="Closure notes" htmlFor="closureNotes">
              <Textarea
                id="closureNotes"
                value={closureNotes}
                disabled={isClosing}
                onChange={(event) => {
                  setCloseError(null)
                  setClosureNotes(event.target.value)
                }}
              />
            </Field>
            {closeError ? <Alert message={closeError} /> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isClosing}
                onClick={() => setIsCloseDialogOpen(false)}
              >
                Keep active
              </Button>
              <Button type="submit" disabled={isClosing} aria-busy={isClosing}>
                {isClosing ? <Loader2 className="size-4 animate-spin" /> : null}
                {isClosing ? "Closing..." : "Confirm sale closure"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PaymentRow({ payment }: { payment: BookingPayment }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
      <TableCell>{formatEnum(payment.method)}</TableCell>
      <TableCell>
        <PaymentStatusBadge status={payment.status} />
      </TableCell>
      <TableCell>{formatLocalDateTime(payment.paidAt)}</TableCell>
      <TableCell>{payment.referenceNumber ?? "Not set"}</TableCell>
      <TableCell>{payment.receivedBy?.name ?? "Not set"}</TableCell>
    </TableRow>
  )
}

function DetailField({
  label,
  value,
  children,
}: {
  label: string
  value?: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{children ?? value}</div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function EnumSelect({
  label,
  id,
  value,
  values,
  disabled,
  onChange,
}: {
  label: string
  id: string
  value: string
  values: string[]
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Select value={value} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {values.map((item) => (
            <SelectItem key={item} value={item}>
              {formatEnum(item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function Alert({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  )
}

function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const className =
    status === "ACTIVE"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : status === "CLOSED"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-rose-200 bg-rose-50 text-rose-700"

  return (
    <Badge variant="outline" className={`w-fit rounded-md ${className}`}>
      {formatEnum(status)}
    </Badge>
  )
}

function KycStatusBadge({ status }: { status: BookingKycStatus }) {
  const className =
    status === "VERIFIED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "REJECTED"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : status === "PENDING"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-border bg-background text-muted-foreground"

  return (
    <Badge variant="outline" className={`w-fit rounded-md ${className}`}>
      {formatEnum(status)}
    </Badge>
  )
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const className =
    status === "COMPLETED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "FAILED" || status === "CANCELLED"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : status === "REFUNDED"
          ? "border-violet-200 bg-violet-50 text-violet-700"
          : "border-amber-200 bg-amber-50 text-amber-700"

  return (
    <Badge variant="outline" className={`w-fit rounded-md ${className}`}>
      {formatEnum(status)}
    </Badge>
  )
}

function getParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? ""
  }

  return value ?? ""
}

function formatBookingRef(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`
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

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1))
    .join(" ")
}
