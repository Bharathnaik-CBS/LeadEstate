"use client"

import { FormEvent, useId, useState } from "react"
import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { AuthUser } from "@/lib/auth"
import { toDateInputValue } from "@/lib/date"
import {
  LEAD_SOURCES,
  type Lead,
  type LeadFormInput,
  type LeadSource,
} from "@/lib/leads"

const EMPTY_SELECT_VALUE = "__empty"

type LeadFormProps = {
  lead?: Lead | null
  salesUsers?: AuthUser[]
  showAssignment?: boolean
  showSource?: boolean
  defaultSource?: LeadSource
  isSubmitting: boolean
  submitLabel: string
  onSubmit: (input: LeadFormInput) => Promise<void>
}

type FormState = {
  fullName: string
  phone: string
  email: string
  propertyType: string
  budget: string
  location: string
  source: LeadSource | typeof EMPTY_SELECT_VALUE
  notes: string
  remarks: string
  followUpDate: string
  assignedToId: string
}

type FieldErrors = Partial<Record<keyof FormState, string>>

function createInitialState(
  lead?: Lead | null,
  defaultSource?: LeadSource
): FormState {
  return {
    fullName: lead?.fullName ?? "",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    propertyType: lead?.propertyType ?? "",
    budget: lead?.budget ?? "",
    location: lead?.location ?? "",
    source: lead
      ? lead.source ?? EMPTY_SELECT_VALUE
      : defaultSource ?? EMPTY_SELECT_VALUE,
    notes: lead?.notes ?? "",
    remarks: lead?.remarks ?? "",
    followUpDate: toDateInputValue(lead?.followUpDate),
    assignedToId: lead?.assignedToId ?? EMPTY_SELECT_VALUE,
  }
}

export function LeadForm({
  lead,
  salesUsers = [],
  showAssignment = false,
  showSource = true,
  defaultSource,
  isSubmitting,
  submitLabel,
  onSubmit,
}: LeadFormProps) {
  const formId = useId()
  const [form, setForm] = useState<FormState>(() =>
    createInitialState(lead, defaultSource)
  )
  const [errors, setErrors] = useState<FieldErrors>({})

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextErrors = validateForm(form)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    await onSubmit({
      fullName: form.fullName,
      phone: form.phone,
      email: form.email,
      propertyType: form.propertyType,
      budget: form.budget,
      location: form.location,
      source: form.source === EMPTY_SELECT_VALUE ? undefined : form.source,
      notes: form.notes,
      remarks: form.remarks,
      followUpDate: form.followUpDate,
      assignedToId:
        form.assignedToId === EMPTY_SELECT_VALUE
          ? undefined
          : form.assignedToId,
    })
  }

  function updateField<Key extends keyof FormState>(
    key: Key,
    value: FormState[Key]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
    setErrors((current) => {
      if (!current[key]) {
        return current
      }

      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function getErrorId(field: keyof FormState) {
    return `${formId}-${field}-error`
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      <p className="text-xs text-muted-foreground">
        Full name and phone are required.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Full name"
          htmlFor="fullName"
          required
          error={errors.fullName}
          errorId={getErrorId("fullName")}
        >
          <Input
            id="fullName"
            value={form.fullName}
            disabled={isSubmitting}
            aria-required="true"
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={
              errors.fullName ? getErrorId("fullName") : undefined
            }
            onChange={(event) => updateField("fullName", event.target.value)}
          />
        </Field>

        <Field
          label="Phone"
          htmlFor="phone"
          required
          error={errors.phone}
          errorId={getErrorId("phone")}
        >
          <Input
            id="phone"
            value={form.phone}
            disabled={isSubmitting}
            aria-required="true"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? getErrorId("phone") : undefined}
            onChange={(event) => updateField("phone", event.target.value)}
          />
        </Field>

        <Field
          label="Email"
          htmlFor="email"
          error={errors.email}
          errorId={getErrorId("email")}
        >
          <Input
            id="email"
            type="email"
            value={form.email}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? getErrorId("email") : undefined}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </Field>

        <Field label="Property type" htmlFor="propertyType">
          <Input
            id="propertyType"
            value={form.propertyType}
            disabled={isSubmitting}
            onChange={(event) =>
              updateField("propertyType", event.target.value)
            }
          />
        </Field>

        <Field label="Budget" htmlFor="budget">
          <Input
            id="budget"
            value={form.budget}
            disabled={isSubmitting}
            onChange={(event) => updateField("budget", event.target.value)}
          />
        </Field>

        <Field label="Location" htmlFor="location">
          <Input
            id="location"
            value={form.location}
            disabled={isSubmitting}
            onChange={(event) => updateField("location", event.target.value)}
          />
        </Field>

        {showSource ? (
          <Field label="Source" htmlFor="source">
            <Select
              value={form.source}
              disabled={isSubmitting}
              onValueChange={(value) =>
                updateField(
                  "source",
                  value as LeadSource | typeof EMPTY_SELECT_VALUE
                )
              }
            >
              <SelectTrigger id="source" className="w-full">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>Not set</SelectItem>
                {LEAD_SOURCES.map((source) => (
                  <SelectItem key={source.value} value={source.value}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <Field label="Follow-up date" htmlFor="followUpDate">
          <Input
            id="followUpDate"
            type="date"
            value={form.followUpDate}
            disabled={isSubmitting}
            onChange={(event) => updateField("followUpDate", event.target.value)}
          />
        </Field>

        {showAssignment ? (
          <Field label="Assign to" htmlFor="assignedToId">
            <Select
              value={form.assignedToId}
              disabled={isSubmitting || salesUsers.length === 0}
              onValueChange={(value) => updateField("assignedToId", value)}
            >
              <SelectTrigger id="assignedToId" className="w-full">
                <SelectValue placeholder="Select sales executive" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY_SELECT_VALUE}>Unassigned</SelectItem>
                {salesUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} - {user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </div>

      <Field label="Notes" htmlFor="notes">
        <Textarea
          id="notes"
          value={form.notes}
          disabled={isSubmitting}
          onChange={(event) => updateField("notes", event.target.value)}
        />
      </Field>

      <Field label="Remarks" htmlFor="remarks">
        <Textarea
          id="remarks"
          value={form.remarks}
          disabled={isSubmitting}
          onChange={(event) => updateField("remarks", event.target.value)}
        />
      </Field>

      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {isSubmitting ? "Saving..." : submitLabel}
      </Button>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  children,
  required = false,
  error,
  errorId,
}: {
  label: string
  htmlFor: string
  children: ReactNode
  required?: boolean
  error?: string
  errorId?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="text-xs font-normal text-muted-foreground">
            Required
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function validateForm(form: FormState): FieldErrors {
  const errors: FieldErrors = {}

  if (!form.fullName.trim()) {
    errors.fullName = "Enter the lead's full name."
  }

  if (!form.phone.trim()) {
    errors.phone = "Enter a phone number."
  }

  if (form.email.trim() && !isValidEmail(form.email)) {
    errors.email = "Enter a valid email address."
  }

  return errors
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}
