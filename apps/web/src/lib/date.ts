const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

export function formatLocalDate(
  value?: string | Date | null,
  fallback = "Not set"
) {
  return formatDateValue(value, fallback, dateFormatter)
}

export function formatLocalDateTime(
  value?: string | Date | null,
  fallback = "Not set"
) {
  return formatDateValue(value, fallback, dateTimeFormatter)
}

export function toDateInputValue(value?: string | Date | null) {
  const date = toValidDate(value)

  if (!date) {
    return ""
  }

  return date.toISOString().slice(0, 10)
}

function formatDateValue(
  value: string | Date | null | undefined,
  fallback: string,
  formatter: Intl.DateTimeFormat
) {
  const date = toValidDate(value)

  if (!date) {
    return fallback
  }

  return formatter.format(date)
}

function toValidDate(value?: string | Date | null) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}
